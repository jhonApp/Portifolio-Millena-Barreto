import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { POST as register } from "@/app/api/diagnostico/attempts/route";
import { PUT as saveAnswerRoute } from "@/app/api/diagnostico/answers/route";
import { POST as checkout } from "@/app/api/diagnostico/checkout/route";
import { handleDeletionConfirm } from "@/app/api/diagnostico/privacy/deletion/confirm/handler";
import { handleDeletionRequest } from "@/app/api/diagnostico/privacy/deletion/request/handler";
import { handleWebhook } from "@/app/api/diagnostico/webhooks/abacatepay/handler";
import { DIAGNOSIS_BUCKET, diagnosisPdfPath, downloadDiagnosisPdf } from "@/lib/diagnostico/diagnosis-storage";
import { loadQuestionBank } from "@/lib/diagnostico/question-bank";
import { adminClient, recordingGateway } from "./helpers";

// Hand-off tests of RF-09 as the consumer of RF-02 (consent record, contact data) and RF-07 (stored PDF).
// The real routes of RF-02, RF-04, RF-05 and RF-06 feed the real generation (RF-07) and delivery
// (RF-08); the deletion is then asked and confirmed through the real RF-09 routes, and the links are
// read from the e-mails that the development provider wrote.

const db = adminClient();
const startedAt = new Date().toISOString();
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


/** The deletion confirmation token in the e-mail the development provider wrote for this address. */
function deletionTokenFromMail(email: string): string {
  const dir = process.env.LOCAL_MAIL_DIR!;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".html") || !name.includes(email.toLowerCase())) continue;
    const match = /\/privacidade\/exclusao\/([A-Za-z0-9_-]{43})/.exec(readFileSync(path.join(dir, name), "utf8"));
    if (match) return match[1];
  }
  throw new Error(`no deletion e-mail was written for ${email}`);
}

function post(route: string, body: unknown): Request {
  return new Request(`http://localhost/api/diagnostico/privacy/deletion/${route}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": randomIp() },
    body: JSON.stringify(body),
  });
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
    await db.from("orders").delete().in("id", orderIds);
  }
  if (emails.length) await db.from("customers").delete().in("email", emails);
  if (eventIds.length) await db.from("webhook_events").delete().in("event_id", eventIds);
  await db.from("deletion_requests").delete().gte("created_at", startedAt);
  await db.from("rate_limits").delete().or("key.like.attempt:%,key.like.checkout:%,key.like.deletionreq:%,key.like.deletionconfirm:%");
});

describe("RF-02 and RF-07 to RF-09 hand-off", () => {
  it("a PDF generated through the real RF-02 to RF-08 flow is removed from storage when the customer's data is deleted", async () => {
    const mine = await purchase("Maria Souza Lima", (p) => (p * 5) % 4);
    const { data: before } = await db.from("orders").select("status").eq("id", mine.orderId).single();
    expect(before!.status).toBe("DELIVERED"); // generated by RF-07 and delivered by RF-08
    expect(await downloadDiagnosisPdf(db, mine.orderId)).not.toBeNull();

    // RF-09: ask for the deletion, read the link from the e-mail, confirm.
    const asked = await handleDeletionRequest(post("request", { email: mine.email }));
    expect(asked.status).toBe(200);
    const confirmed = await handleDeletionConfirm(post("confirm", { token: deletionTokenFromMail(mine.email) }));
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toEqual({ state: "completed" });

    // The stored file of that order is gone, and so are the diagnosis rows.
    expect(await downloadDiagnosisPdf(db, mine.orderId)).toBeNull();
    expect((await db.from("results").select("id").eq("order_id", mine.orderId)).data).toEqual([]);
    expect((await db.from("result_tokens").select("id").eq("order_id", mine.orderId)).data).toEqual([]);
    // Only the anonymized order and payment remain, with no attempt.
    const { data: order } = await db.from("orders").select("attempt_id, status, amount_cents").eq("id", mine.orderId).single();
    expect(order).toEqual({ attempt_id: null, status: "DELIVERED", amount_cents: 990 });
    expect((await db.from("payments").select("id").eq("order_id", mine.orderId)).data).toHaveLength(1);
  });

  it("the consent record created at registration is removed with the customer", async () => {
    const mine = await purchase("Joana Prado", (p) => (p * 3 + 1) % 4);
    const { data: customer } = await db.from("customers").select("id").eq("email", mine.email).single();
    const { data: attempts } = await db.from("purchase_attempts").select("id").eq("customer_id", customer!.id);
    const attemptId = attempts![0].id;
    // The row RF-02 wrote exists, with the text the customer accepted.
    const { data: consent } = await db.from("consent_records").select("consent_text, consent_text_version").eq("attempt_id", attemptId).single();
    expect(consent!.consent_text.length).toBeGreaterThan(20);
    expect((await db.from("answers").select("id").eq("attempt_id", attemptId)).data!.length).toBe(15);

    await handleDeletionRequest(post("request", { email: mine.email }));
    const confirmed = await handleDeletionConfirm(post("confirm", { token: deletionTokenFromMail(mine.email) }));
    expect(await confirmed.json()).toEqual({ state: "completed" });

    expect((await db.from("customers").select("id").eq("id", customer!.id)).data).toEqual([]);
    expect((await db.from("purchase_attempts").select("id").eq("id", attemptId)).data).toEqual([]);
    expect((await db.from("answers").select("id").eq("attempt_id", attemptId)).data).toEqual([]);
    expect((await db.from("consent_records").select("id").eq("attempt_id", attemptId)).data).toEqual([]);
    expect((await db.from("consent_records").select("id").eq("customer_id", customer!.id)).data).toEqual([]);
  });
});
