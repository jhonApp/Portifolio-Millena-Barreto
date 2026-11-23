import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { POST as register } from "@/app/api/diagnostico/attempts/route";
import { PUT as saveAnswerRoute } from "@/app/api/diagnostico/answers/route";
import { POST as checkout } from "@/app/api/diagnostico/checkout/route";
import { handleWebhook } from "@/app/api/diagnostico/webhooks/abacatepay/handler";
import { DIAGNOSIS_BUCKET, diagnosisPdfPath, downloadDiagnosisPdf } from "@/lib/diagnostico/diagnosis-storage";
import { startGeneration } from "@/lib/diagnostico/generation-hook";
import { OrderNotApprovedError } from "@/lib/diagnostico/order-guard";
import { getScoredAnswers, loadQuestionBank, getScoringRules } from "@/lib/diagnostico/question-bank";
import { scoreAnswers } from "@/lib/diagnostico/scoring";
import { adminClient, readPdf, recordingGateway } from "./helpers";

// Hand-off tests of RF-07 as the consumer of RF-02 (name, preference), RF-03 (scoring),
// RF-04 (saved answers) and RF-06 (approved order). The real routes of the earlier features
// feed the real generation hook; only the payment provider is replaced by a recording fake.

const db = adminClient();
const emails: string[] = [];
const orderIds: string[] = [];
const eventIds: string[] = [];

const SECRET = "g".repeat(40);
const PUBLIC_KEY = "test-public-key-not-real";
const compact = (text: string) => text.toLowerCase().replace(/\s+/g, "");

function randomIp(): string {
  const n = () => Math.floor(Math.random() * 250) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

async function registerCustomer(fullName: string, deliveryPreference: "email" | "whatsapp" | "both") {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const response = await register(
    new Request("http://localhost/api/diagnostico/attempts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": randomIp() },
      body: JSON.stringify({
        fullName,
        email,
        whatsapp: "(11) 91234-5678",
        deliveryPreference,
        consent: true,
        idempotencyKey: randomUUID(),
      }),
    }),
  );
  expect(response.status).toBe(201);
  const { attemptId } = await response.json();
  return { attemptId: attemptId as string, cookie: (response.headers.get("set-cookie") ?? "").split(";")[0] };
}

/** Saves the 15 answers through the real RF-04 route, choosing the alternative at `index(position)`. */
async function saveAnswers(cookie: string, index: (position: number) => number) {
  const bank = await loadQuestionBank(db);
  for (const question of bank.questions) {
    const response = await saveAnswerRoute(
      new Request("http://localhost/api/diagnostico/answers", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ questionId: question.id, alternativeId: question.alternatives[index(question.position) % question.alternatives.length].id }),
      }),
    );
    expect(response.status).toBe(200);
  }
}

async function openCheckout(cookie: string) {
  const response = await checkout(
    new Request("http://localhost/api/diagnostico/checkout", { method: "POST", headers: { cookie } }),
  );
  expect(response.status).toBe(201);
  const { orderId } = await response.json();
  orderIds.push(orderId);
  const { data: payment } = await db.from("payments").select("provider_charge_id").eq("order_id", orderId).single();
  return { orderId: orderId as string, chargeId: payment!.provider_charge_id };
}

function signedEvent(chargeId: string) {
  const id = `evt_${randomUUID()}`;
  eventIds.push(id);
  const raw = JSON.stringify({
    id,
    event: "transparent.completed",
    apiVersion: 2,
    devMode: false,
    data: { transparent: { id: chargeId, amount: 990, status: "PAID" } },
  });
  return new Request("http://localhost/api/diagnostico/webhooks/abacatepay", {
    method: "POST",
    headers: {
      "x-webhook-secret": SECRET,
      "x-webhook-signature": createHmac("sha256", PUBLIC_KEY).update(raw).digest("base64"),
    },
    body: raw,
  });
}

beforeEach(() => {
  vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "true");
  vi.stubEnv("PAYMENT_SIMULATION_FAIL", "false");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ABACATEPAY_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("ABACATEPAY_WEBHOOK_PUBLIC_KEY", PUBLIC_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  if (orderIds.length) {
    await db.storage.from(DIAGNOSIS_BUCKET).remove(orderIds.map(diagnosisPdfPath));
    await db.from("automation_errors").delete().in("order_id", orderIds);
  }
  if (emails.length) await db.from("customers").delete().in("email", emails);
  if (eventIds.length) await db.from("webhook_events").delete().in("event_id", eventIds);
  await db.from("rate_limits").delete().or("key.like.attempt:%,key.like.checkout:%");
});

describe("RF-02, RF-03, RF-04 and RF-06 to RF-07 hand-off", () => {
  it("an order approved through the real RF-06 webhook is generated from the real answers name and scoring", async () => {
    const index = (position: number) => (position * 5) % 4;
    const customer = await registerCustomer("Maria Souza Lima", "both");
    await saveAnswers(customer.cookie, index);
    const { orderId, chargeId } = await openCheckout(customer.cookie);

    // RF-06 approves the order and calls the real generation hook (no injected startGeneration).
    const { gateway } = recordingGateway({ status: "PAID" });
    const response = await handleWebhook(signedEvent(chargeId), { gateway });
    expect(response.status).toBe(200);
    expect((await response.json()).result).toBe("approved");

    // The order was generated and, with RF-08 in place, its e-mail was accepted (development provider).
    const { data: order } = await db.from("orders").select("status").eq("id", orderId).single();
    expect(order!.status).toBe("DELIVERED");
    const { data: result } = await db.from("results").select("*").eq("order_id", orderId).single();

    // RF-03 + RF-04: the points are the scoring engine's output on the answers saved by the route.
    const expected = scoreAnswers(await getScoredAnswers(db, customer.attemptId), await getScoringRules(db, customer.attemptId));
    expect(result!.points).toEqual(expected.points);
    expect(result!.predominant_style).toBe(expected.predominant);
    expect(result!.secondary_style).toBe(expected.secondary);

    // RF-02: the first name and the delivery preference typed in the registration.
    const content = result!.content as unknown as { customer: { firstName: string; deliveryPreference: string } };
    expect(content.customer).toEqual({ firstName: "Maria", deliveryPreference: "both" });

    // The stored PDF carries the full name on its cover.
    const bytes = await downloadDiagnosisPdf(db, orderId);
    expect(bytes).not.toBeNull();
    const pdf = await readPdf(bytes!);
    expect(compact(pdf.pages[0])).toContain(compact("Maria Souza Lima"));
  });

  it("a PENDING order is refused by startGeneration and creates nothing", async () => {
    const customer = await registerCustomer("Joana Prado", "email");
    await saveAnswers(customer.cookie, () => 0);
    const { orderId } = await openCheckout(customer.cookie); // PENDING: never paid

    await expect(startGeneration(orderId, "plain-token")).rejects.toBeInstanceOf(OrderNotApprovedError);

    const { data: order } = await db.from("orders").select("status, generation_attempts").eq("id", orderId).single();
    expect(order).toMatchObject({ status: "PENDING", generation_attempts: 0 });
    const { count } = await db.from("results").select("*", { count: "exact", head: true }).eq("order_id", orderId);
    expect(count).toBe(0);
    expect(await downloadDiagnosisPdf(db, orderId)).toBeNull();
  });
});
