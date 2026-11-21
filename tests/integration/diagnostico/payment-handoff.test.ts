import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { POST as register } from "@/app/api/diagnostico/attempts/route";
import { PUT as saveAnswerRoute } from "@/app/api/diagnostico/answers/route";
import { POST as checkout } from "@/app/api/diagnostico/checkout/route";
import { handleWebhook } from "@/app/api/diagnostico/webhooks/abacatepay/handler";
import { loadQuestionBank } from "@/lib/diagnostico/question-bank";
import { adminClient, recordingGateway } from "./helpers";

// Hand-off test of RF-06 as the consumer of RF-05 (order and charge), through RF-02 and RF-04.
// The real registration, save and checkout routes feed a signed notification.

const db = adminClient();
const emails: string[] = [];
const eventIds: string[] = [];

const SECRET = "h".repeat(40);
const PUBLIC_KEY = "test-public-key-not-real";

function randomIp(): string {
  const n = () => Math.floor(Math.random() * 250) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

async function registerCustomer() {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const response = await register(
    new Request("http://localhost/api/diagnostico/attempts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": randomIp() },
      body: JSON.stringify({
        fullName: "Maria Souza",
        email,
        whatsapp: "(11) 91234-5678",
        deliveryPreference: "both",
        consent: true,
        idempotencyKey: randomUUID(),
      }),
    }),
  );
  expect(response.status).toBe(201);
  const { attemptId } = await response.json();
  return { attemptId: attemptId as string, cookie: (response.headers.get("set-cookie") ?? "").split(";")[0] };
}

async function saveAllAnswers(cookie: string) {
  const bank = await loadQuestionBank(db);
  for (const question of bank.questions) {
    const response = await saveAnswerRoute(
      new Request("http://localhost/api/diagnostico/answers", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ questionId: question.id, alternativeId: question.alternatives[0].id }),
      }),
    );
    expect(response.status).toBe(200);
  }
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
  if (emails.length) await db.from("customers").delete().in("email", emails);
  if (eventIds.length) await db.from("webhook_events").delete().in("event_id", eventIds);
  await db.from("rate_limits").delete().or("key.like.attempt:%,key.like.checkout:%");
});

describe("RF-05 to RF-06 hand-off", () => {
  it("a real registration, saved answers and checkout produce a charge whose notification approves that order", async () => {
    const customer = await registerCustomer();
    const bystander = await registerCustomer();
    await saveAllAnswers(customer.cookie);
    await saveAllAnswers(bystander.cookie);

    // RF-05 creates the order and the charge.
    const opened = await checkout(
      new Request("http://localhost/api/diagnostico/checkout", { method: "POST", headers: { cookie: customer.cookie } }),
    );
    expect(opened.status).toBe(201);
    const { orderId } = await opened.json();
    const otherOpened = await checkout(
      new Request("http://localhost/api/diagnostico/checkout", { method: "POST", headers: { cookie: bystander.cookie } }),
    );
    const { orderId: otherOrderId } = await otherOpened.json();

    // The charge identifier is read from what RF-05 stored; the provider reports it as paid.
    const { data: payment } = await db.from("payments").select("provider_charge_id").eq("order_id", orderId).single();
    const { gateway, checks } = recordingGateway({ status: "PAID" });
    const startGeneration = vi.fn().mockResolvedValue(undefined);

    const response = await handleWebhook(signedEvent(payment!.provider_charge_id), { gateway, startGeneration });
    expect(response.status).toBe(200);
    expect((await response.json()).result).toBe("approved");

    // The order created by RF-05 is the one approved, matched by charge identifier.
    expect(checks).toEqual([payment!.provider_charge_id]);
    const { data: order } = await db.from("orders").select("status, attempt_id, approved_at").eq("id", orderId).single();
    expect(order).toMatchObject({ status: "APPROVED", attempt_id: customer.attemptId });
    expect(order!.approved_at).not.toBeNull();
    const { data: paid } = await db.from("payments").select("status, paid_at").eq("order_id", orderId).single();
    expect(paid).toMatchObject({ status: "PAID" });
    expect(paid!.paid_at).not.toBeNull();
    const { data: tokens } = await db.from("result_tokens").select("id").eq("order_id", orderId);
    expect(tokens).toHaveLength(1);
    expect(startGeneration).toHaveBeenCalledWith(orderId, expect.any(String));

    // Nothing else changed: the other customer's order is still waiting for payment.
    const { data: other } = await db.from("orders").select("status").eq("id", otherOrderId).single();
    expect(other!.status).toBe("PENDING");
  });
});
