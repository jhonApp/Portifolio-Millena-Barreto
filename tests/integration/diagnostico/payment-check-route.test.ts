import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { handlePaymentCheck } from "@/app/api/diagnostico/payment/check/handler";
import { handleWebhook } from "@/app/api/diagnostico/webhooks/abacatepay/handler";
import { ATTEMPT_COOKIE, signAttemptId } from "@/lib/diagnostico/attempt-session";
import { adminClient, createAttempt, createCustomer, createOrderWithPayment, recordingGateway } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const eventIds: string[] = [];

const SECRET = "c".repeat(40);
const PUBLIC_KEY = "test-public-key-not-real";

const cookieFor = (attemptId: string) => `${ATTEMPT_COOKIE}=${signAttemptId(attemptId)}`;

function check(cookie?: string) {
  return new Request("http://localhost/api/diagnostico/payment/check", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
}

async function setup(status: "PENDING" | "FAILED" = "PENDING") {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  const attempt = await createAttempt(db, customer.id);
  return { attempt, ...(await createOrderWithPayment(db, attempt.id, status)) };
}

async function orderStatus(orderId: string) {
  const { data } = await db.from("orders").select("status, failure_reason").eq("id", orderId).single();
  return data!;
}

async function tokens(orderId: string) {
  const { data } = await db.from("result_tokens").select("id").eq("order_id", orderId);
  return data ?? [];
}

function webhookFor(chargeId: string) {
  const id = `evt_${randomUUID()}`;
  eventIds.push(id);
  const raw = JSON.stringify({
    id,
    event: "transparent.completed",
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
  vi.stubEnv("ABACATEPAY_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("ABACATEPAY_WEBHOOK_PUBLIC_KEY", PUBLIC_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  if (eventIds.length) await db.from("webhook_events").delete().in("event_id", eventIds);
  await db.from("rate_limits").delete().like("key", "paycheck:%");
});

describe("POST /api/diagnostico/payment/check", () => {
  it("an unpaid charge answers pending and leaves the order PENDING", async () => {
    const { attempt, order } = await setup();
    const { gateway } = recordingGateway({ status: "PENDING" });
    const response = await handlePaymentCheck(check(cookieFor(attempt.id)), { gateway, startGeneration: vi.fn() });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ state: "pending" });
    expect((await orderStatus(order.id)).status).toBe("PENDING");
  });

  it("a second call within 5 seconds does not call the provider", async () => {
    const { attempt } = await setup();
    const { gateway, checks } = recordingGateway({ status: "PENDING" });
    for (let i = 0; i < 3; i++) {
      const response = await handlePaymentCheck(check(cookieFor(attempt.id)), { gateway, startGeneration: vi.fn() });
      expect(await response.json()).toEqual({ state: "pending" });
    }
    // One provider call per 5 second window: three quick calls cross at most one window boundary.
    expect(checks.length).toBeGreaterThanOrEqual(1);
    expect(checks.length).toBeLessThan(3);
  });

  it("a paid charge approves the order and answers approved", async () => {
    const { attempt, order } = await setup();
    const { gateway } = recordingGateway({ status: "PAID" });
    const startGeneration = vi.fn().mockResolvedValue(undefined);
    const response = await handlePaymentCheck(check(cookieFor(attempt.id)), { gateway, startGeneration });

    expect(await response.json()).toEqual({ state: "approved", orderStatus: "APPROVED", resultReady: false });
    expect((await orderStatus(order.id)).status).toBe("APPROVED");
    expect(startGeneration).toHaveBeenCalledTimes(1);
    expect(await tokens(order.id)).toHaveLength(1);
  });

  it("an already approved order answers approved without calling the provider", async () => {
    const { attempt, order } = await setup();
    await db.from("orders").update({ status: "APPROVED" }).eq("id", order.id);
    const { gateway, checks } = recordingGateway({ status: "PAID" });
    const response = await handlePaymentCheck(check(cookieFor(attempt.id)), { gateway, startGeneration: vi.fn() });
    expect(await response.json()).toEqual({ state: "approved", orderStatus: "APPROVED", resultReady: false });
    expect(checks).toHaveLength(0);
  });

  it("a notification and a check at the same moment approve once", async () => {
    const { attempt, order, chargeId } = await setup();
    const { gateway } = recordingGateway({ status: "PAID" });
    const startGeneration = vi.fn().mockResolvedValue(undefined);
    const [webhook, checkResponse] = await Promise.all([
      handleWebhook(webhookFor(chargeId), { gateway, startGeneration }),
      handlePaymentCheck(check(cookieFor(attempt.id)), { gateway, startGeneration }),
    ]);

    expect(webhook.status).toBe(200);
    expect((await checkResponse.json()).state).toBe("approved");
    expect(startGeneration).toHaveBeenCalledTimes(1);
    expect(await tokens(order.id)).toHaveLength(1);
    expect((await orderStatus(order.id)).status).toBe("APPROVED");
  });

  it("request without cookie gets 403", async () => {
    const response = await handlePaymentCheck(check(), { gateway: recordingGateway().gateway });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("tampered cookie gets 403", async () => {
    const { attempt } = await setup();
    const response = await handlePaymentCheck(check(`${ATTEMPT_COOKIE}=${attempt.id}.forged`), {
      gateway: recordingGateway().gateway,
    });
    expect(response.status).toBe(403);
  });

  it("an attempt without an order gets 404", async () => {
    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    const attempt = await createAttempt(db, customer.id);
    const response = await handlePaymentCheck(check(cookieFor(attempt.id)), { gateway: recordingGateway().gateway });
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("a provider failure gets 502 PAYMENT_CHECK_UNAVAILABLE", async () => {
    const { attempt, order } = await setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { gateway } = recordingGateway({ failCheck: true });
    const response = await handlePaymentCheck(check(cookieFor(attempt.id)), { gateway, startGeneration: vi.fn() });
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("PAYMENT_CHECK_UNAVAILABLE");
    expect(body.error.message).toBe("Não conseguimos verificar agora. Tente novamente.");
    expect((await orderStatus(order.id)).status).toBe("PENDING");
  });

  it("an expired charge answers expired and changes nothing", async () => {
    const { attempt, order } = await setup();
    const { gateway } = recordingGateway({ status: "EXPIRED" });
    const response = await handlePaymentCheck(check(cookieFor(attempt.id)), { gateway, startGeneration: vi.fn() });
    expect(await response.json()).toEqual({ state: "expired" });
    expect((await orderStatus(order.id)).status).toBe("PENDING");
  });

  it("a FAILED PIX_EXPIRED order answers expired without calling the provider", async () => {
    const { attempt } = await setup("FAILED");
    const { gateway, checks } = recordingGateway({ status: "PAID" });
    const response = await handlePaymentCheck(check(cookieFor(attempt.id)), { gateway, startGeneration: vi.fn() });
    expect(await response.json()).toEqual({ state: "expired" });
    expect(checks).toHaveLength(0);
  });

  it("another attempt's order is never read", async () => {
    const mine = await setup();
    const other = await setup();
    const { gateway, checks } = recordingGateway({ status: "PAID" });
    await handlePaymentCheck(check(cookieFor(mine.attempt.id)), { gateway, startGeneration: vi.fn() });
    expect(checks).toEqual([mine.chargeId]);
    expect((await orderStatus(other.order.id)).status).toBe("PENDING");
  });
});

describe("resultReady (RF-08)", () => {
  it("an approved order with a result answers resultReady true", async () => {
    const { attempt, order } = await setup();
    await db.from("orders").update({ status: "PROCESSING" }).eq("id", order.id);
    const { data: version } = await db.from("questionnaire_versions").select("id").eq("status", "published").single();
    await db.from("results").insert({
      order_id: order.id,
      version_id: version!.id,
      points: { esportivo_natural: 1, tradicional: 2, elegante: 6, romantico: 4, criativo: 1, dramatico: 1 },
      predominant_style: "elegante",
      secondary_style: "romantico",
      content: { blocks: [] },
      pdf_path: `${order.id}.pdf`,
    });
    const { gateway } = recordingGateway({ status: "PENDING" });
    const response = await handlePaymentCheck(check(cookieFor(attempt.id)), { gateway, startGeneration: vi.fn() });
    expect(await response.json()).toEqual({ state: "approved", orderStatus: "PROCESSING", resultReady: true });
  });

  it("an approved order without a result answers resultReady false", async () => {
    const { attempt, order } = await setup();
    await db.from("orders").update({ status: "APPROVED" }).eq("id", order.id);
    const { gateway } = recordingGateway({ status: "PENDING" });
    const response = await handlePaymentCheck(check(cookieFor(attempt.id)), { gateway, startGeneration: vi.fn() });
    expect(await response.json()).toEqual({ state: "approved", orderStatus: "APPROVED", resultReady: false });
  });
});

