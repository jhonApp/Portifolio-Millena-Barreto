import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { POST as register } from "@/app/api/diagnostico/attempts/route";
import { PUT as saveAnswerRoute } from "@/app/api/diagnostico/answers/route";
import { POST as checkout } from "@/app/api/diagnostico/checkout/route";
import { handleResultPdf } from "@/app/api/diagnostico/result/pdf/handler";
import { handleWebhook } from "@/app/api/diagnostico/webhooks/abacatepay/handler";
import { DIAGNOSIS_BUCKET, diagnosisPdfPath, downloadDiagnosisPdf } from "@/lib/diagnostico/diagnosis-storage";
import { loadQuestionBank } from "@/lib/diagnostico/question-bank";
import { loadResultByToken } from "@/lib/diagnostico/result-page";
import { adminClient, recordingGateway } from "./helpers";

// Hand-off test of RF-08 as the consumer of RF-06 (approved order, token) and RF-07 (diagnosis, PDF).
// The real routes of RF-02, RF-04, RF-05 and RF-06 feed the real generation and the real delivery;
// the e-mail goes through the development provider, and the link is read from the e-mail itself.

const db = adminClient();
const emails: string[] = [];
const orderIds: string[] = [];
const eventIds: string[] = [];

const SECRET = "r".repeat(40);
const PUBLIC_KEY = "test-public-key-not-real";

function randomIp(): string {
  const n = () => Math.floor(Math.random() * 250) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

async function purchase(fullName: string, choose: (position: number) => number) {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const registered = await register(
    new Request("http://localhost/api/diagnostico/attempts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": randomIp() },
      body: JSON.stringify({
        fullName,
        email,
        whatsapp: "(11) 91234-5678",
        deliveryPreference: "whatsapp",
        consent: true,
        idempotencyKey: randomUUID(),
      }),
    }),
  );
  expect(registered.status).toBe(201);
  const cookie = (registered.headers.get("set-cookie") ?? "").split(";")[0];

  const bank = await loadQuestionBank(db);
  for (const question of bank.questions) {
    const saved = await saveAnswerRoute(
      new Request("http://localhost/api/diagnostico/answers", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ questionId: question.id, alternativeId: question.alternatives[choose(question.position) % question.alternatives.length].id }),
      }),
    );
    expect(saved.status).toBe(200);
  }

  const opened = await checkout(new Request("http://localhost/api/diagnostico/checkout", { method: "POST", headers: { cookie } }));
  expect(opened.status).toBe(201);
  const { orderId } = await opened.json();
  orderIds.push(orderId);
  const { data: payment } = await db.from("payments").select("provider_charge_id").eq("order_id", orderId).single();

  const eventId = `evt_${randomUUID()}`;
  eventIds.push(eventId);
  const raw = JSON.stringify({
    id: eventId,
    event: "transparent.completed",
    apiVersion: 2,
    devMode: false,
    data: { transparent: { id: payment!.provider_charge_id, amount: 990, status: "PAID" } },
  });
  const { gateway } = recordingGateway({ status: "PAID" });
  const approved = await handleWebhook(
    new Request("http://localhost/api/diagnostico/webhooks/abacatepay", {
      method: "POST",
      headers: {
        "x-webhook-secret": SECRET,
        "x-webhook-signature": createHmac("sha256", PUBLIC_KEY).update(raw).digest("base64"),
      },
      body: raw,
    }),
    { gateway }, // the real generation hook and the real delivery hook run
  );
  expect(approved.status).toBe(200);
  return { orderId: orderId as string, email };
}

/** The plain token of the link in the e-mail that the development provider wrote for this address. */
function tokenFromMail(email: string): string {
  const dir = process.env.LOCAL_MAIL_DIR!;
  const file = readdirSync(dir).find((name) => name.endsWith(".html") && name.includes(email.toLowerCase()));
  if (!file) throw new Error(`no e-mail was written for ${email}`);
  const match = /\/diagnostico-estilo\/resultado\/([A-Za-z0-9_-]{43})/.exec(readFileSync(path.join(dir, file), "utf8"));
  if (!match) throw new Error("the e-mail has no result link");
  return match[1];
}

beforeEach(() => {
  vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "true");
  vi.stubEnv("PAYMENT_SIMULATION_FAIL", "false");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ABACATEPAY_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("ABACATEPAY_WEBHOOK_PUBLIC_KEY", PUBLIC_KEY);
  vi.stubEnv("APP_URL", "http://localhost:3001");
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
  await db.from("rate_limits").delete().or("key.like.attempt:%,key.like.checkout:%,key.like.pdf:%");
});

describe("RF-06 and RF-07 to RF-08 hand-off", () => {
  it("a diagnosis generated through the real RF-06 and RF-07 flow is shown by the result link with its own PDF", async () => {
    const mine = await purchase("Maria Souza Lima", (p) => (p * 5) % 4);
    const other = await purchase("Joana Prado", (p) => (p * 3 + 1) % 4);

    // The order was approved, generated and delivered by the real flow.
    const { data: order } = await db.from("orders").select("status").eq("id", mine.orderId).single();
    expect(order!.status).toBe("DELIVERED");
    const { data: row } = await db.from("results").select("*").eq("order_id", mine.orderId).single();

    // RF-08 opens the link of the e-mail and shows exactly that diagnosis.
    const token = tokenFromMail(mine.email);
    const state = await loadResultByToken(db, token);
    if (state.state !== "ready") throw new Error(`expected the ready state, got ${state.state}`);
    expect(state.orderId).toBe(mine.orderId);
    expect(state.content.predominant.style).toBe(row!.predominant_style);
    expect(state.content.secondary.style).toBe(row!.secondary_style);
    expect(state.content).toEqual(row!.content);
    expect(state.content.customer.firstName).toBe("Maria");

    // The PDF behind the button is the file stored for this order.
    const response = await handleResultPdf(
      new Request("http://localhost/api/diagnostico/result/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    expect(response.status).toBe(200);
    const { url } = await response.json();
    const downloaded = new Uint8Array(await (await fetch(url)).arrayBuffer());
    expect(downloaded).toEqual((await downloadDiagnosisPdf(db, mine.orderId))!);

    // Another customer's link shows another order and never this one.
    const otherState = await loadResultByToken(db, tokenFromMail(other.email));
    expect(otherState.state === "ready" && otherState.orderId).toBe(other.orderId);
    expect(otherState.state === "ready" && otherState.orderId).not.toBe(mine.orderId);
  });
});
