import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, createHash, randomUUID } from "node:crypto";
import { handleWebhook } from "@/app/api/diagnostico/webhooks/abacatepay/handler";
import { adminClient, createAttempt, createCustomer, createOrderWithPayment, recordingGateway } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const eventIds: string[] = [];

const SECRET = "w".repeat(40);
const PUBLIC_KEY = "test-public-key-not-real";

function sign(body: string, key = PUBLIC_KEY) {
  return createHmac("sha256", key).update(body).digest("base64");
}

function paidEvent(chargeId: string, overrides: Record<string, unknown> = {}, eventId = `evt_${randomUUID()}`) {
  eventIds.push(eventId);
  return {
    id: eventId,
    event: "transparent.completed",
    apiVersion: 2,
    devMode: false,
    data: { transparent: { id: chargeId, amount: 990, status: "PAID", externalId: null, metadata: {} } },
    ...overrides,
  };
}

function webhookRequest(
  body: unknown,
  options: { secret?: string | null; signature?: string | null; raw?: string } = {},
) {
  const raw = options.raw ?? JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = options.secret === undefined ? SECRET : options.secret;
  if (secret) headers["x-webhook-secret"] = secret;
  const signature = options.signature === undefined ? sign(raw) : options.signature;
  if (signature) headers["x-webhook-signature"] = signature;
  return new Request("http://localhost/api/diagnostico/webhooks/abacatepay", { method: "POST", headers, body: raw });
}

async function pendingOrder(status: "PENDING" | "FAILED" = "PENDING") {
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
  const { data } = await db.from("result_tokens").select("*").eq("order_id", orderId);
  return data ?? [];
}

async function automationSteps(orderId: string) {
  const { data } = await db.from("automation_errors").select("step").eq("order_id", orderId);
  return (data ?? []).map((row) => row.step);
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
  await db.from("automation_errors").delete().like("step", "WEBHOOK_UNKNOWN_CHARGE");
});

describe("POST /api/diagnostico/webhooks/abacatepay", () => {
  it("a paid notification approves the PENDING order after verifying status and amount", async () => {
    const { order, chargeId } = await pendingOrder();
    const { gateway, checks } = recordingGateway({ status: "PAID" });
    const startGeneration = vi.fn().mockResolvedValue(undefined);

    const response = await handleWebhook(webhookRequest(paidEvent(chargeId)), { gateway, startGeneration });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, result: "approved" });

    // The provider was asked; the payload alone was not enough.
    expect(checks).toEqual([chargeId]);
    expect(await orderStatus(order.id)).toMatchObject({ status: "APPROVED" });
    expect(startGeneration).toHaveBeenCalledTimes(1);
  });

  it("the order is not approved when the provider says PENDING", async () => {
    const { order, chargeId } = await pendingOrder();
    const { gateway } = recordingGateway({ status: "PENDING" });
    const event = paidEvent(chargeId);
    const response = await handleWebhook(webhookRequest(event), { gateway, startGeneration: vi.fn() });

    expect(response.status).toBe(503);
    expect((await orderStatus(order.id)).status).toBe("PENDING");
    const { data } = await db.from("webhook_events").select("processed_at").eq("event_id", event.id).single();
    expect(data!.processed_at).toBeNull();
  });

  it("an event amount different from 990 is not approved", async () => {
    const { order, chargeId } = await pendingOrder();
    const { gateway, checks } = recordingGateway({ status: "PAID" });
    const event = paidEvent(chargeId, { data: { transparent: { id: chargeId, amount: 100, status: "PAID" } } });
    const response = await handleWebhook(webhookRequest(event), { gateway, startGeneration: vi.fn() });

    expect(response.status).toBe(200);
    expect((await response.json()).result).toBe("amount_mismatch");
    expect((await orderStatus(order.id)).status).toBe("PENDING");
    expect(checks).toHaveLength(0);
    expect(await automationSteps(order.id)).toContain("WEBHOOK_AMOUNT_MISMATCH");
  });

  it("an event without an amount is not approved", async () => {
    const { order, chargeId } = await pendingOrder();
    const { gateway } = recordingGateway({ status: "PAID" });
    const event = paidEvent(chargeId, { data: { transparent: { id: chargeId, status: "PAID" } } });
    const response = await handleWebhook(webhookRequest(event), { gateway, startGeneration: vi.fn() });
    expect((await response.json()).result).toBe("amount_mismatch");
    expect((await orderStatus(order.id)).status).toBe("PENDING");
  });

  it("a notification without proof returns 401 and changes nothing", async () => {
    const { order, chargeId } = await pendingOrder();
    const { gateway, checks } = recordingGateway({ status: "PAID" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await handleWebhook(webhookRequest(paidEvent(chargeId), { secret: null, signature: null }), {
      gateway,
      startGeneration: vi.fn(),
    });

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect((await orderStatus(order.id)).status).toBe("PENDING");
    expect(checks).toHaveLength(0);
  });

  it("a wrong secret returns 401", async () => {
    const { order, chargeId } = await pendingOrder();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await handleWebhook(webhookRequest(paidEvent(chargeId), { secret: "x".repeat(40) }), {
      gateway: recordingGateway({ status: "PAID" }).gateway,
    });
    expect(response.status).toBe(401);
    expect((await orderStatus(order.id)).status).toBe("PENDING");
  });

  it("a wrong signature returns 401", async () => {
    const { order, chargeId } = await pendingOrder();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await handleWebhook(webhookRequest(paidEvent(chargeId), { signature: "bm9wZQ==" }), {
      gateway: recordingGateway({ status: "PAID" }).gateway,
    });
    expect(response.status).toBe(401);
    expect((await orderStatus(order.id)).status).toBe("PENDING");
  });

  it("a signature over a different body returns 401", async () => {
    const { order, chargeId } = await pendingOrder();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const event = paidEvent(chargeId);
    const response = await handleWebhook(
      webhookRequest(event, { signature: sign(JSON.stringify({ ...event, id: "other" })) }),
      { gateway: recordingGateway({ status: "PAID" }).gateway },
    );
    expect(response.status).toBe(401);
    expect((await orderStatus(order.id)).status).toBe("PENDING");
  });

  it("a missing secret configuration never accepts a request", async () => {
    const { order, chargeId } = await pendingOrder();
    vi.stubEnv("ABACATEPAY_WEBHOOK_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleWebhook(webhookRequest(paidEvent(chargeId), { secret: "" }), {
      gateway: recordingGateway({ status: "PAID" }).gateway,
    });
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("CONFIG_ERROR");
    expect((await orderStatus(order.id)).status).toBe("PENDING");
  });

  it("the same notification sent five times approves once and starts one generation", async () => {
    const { order, chargeId } = await pendingOrder();
    const { gateway } = recordingGateway({ status: "PAID" });
    const startGeneration = vi.fn().mockResolvedValue(undefined);
    const event = paidEvent(chargeId);

    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      const response = await handleWebhook(webhookRequest(event), { gateway, startGeneration });
      expect(response.status).toBe(200);
      results.push((await response.json()).result);
    }
    expect(results).toEqual(["approved", "duplicate_event", "duplicate_event", "duplicate_event", "duplicate_event"]);
    expect(startGeneration).toHaveBeenCalledTimes(1);
    expect(await tokens(order.id)).toHaveLength(1);
    const { count } = await db.from("webhook_events").select("*", { count: "exact", head: true }).eq("event_id", event.id);
    expect(count).toBe(1);
  });

  it("a new event for an already approved order approves nothing again", async () => {
    const { order, chargeId } = await pendingOrder();
    const { gateway } = recordingGateway({ status: "PAID" });
    const startGeneration = vi.fn().mockResolvedValue(undefined);
    await handleWebhook(webhookRequest(paidEvent(chargeId)), { gateway, startGeneration });
    const second = await handleWebhook(webhookRequest(paidEvent(chargeId)), { gateway, startGeneration });
    expect((await second.json()).result).toBe("already_approved");
    expect(startGeneration).toHaveBeenCalledTimes(1);
    expect(await tokens(order.id)).toHaveLength(1);
  });

  it("an unknown charge answers 200 and records an automation error", async () => {
    const { gateway } = recordingGateway({ status: "PAID" });
    const chargeId = `unknown_${randomUUID()}`;
    const response = await handleWebhook(webhookRequest(paidEvent(chargeId)), { gateway, startGeneration: vi.fn() });
    expect(response.status).toBe(200);
    expect((await response.json()).result).toBe("unknown_charge");
    const { data } = await db.from("automation_errors").select("context").eq("step", "WEBHOOK_UNKNOWN_CHARGE");
    expect((data ?? []).some((row) => JSON.stringify(row.context).includes(chargeId))).toBe(true);
  });

  it("a different event type answers 200 and is ignored", async () => {
    const { order, chargeId } = await pendingOrder();
    const response = await handleWebhook(webhookRequest(paidEvent(chargeId, { event: "checkout.completed" })), {
      gateway: recordingGateway({ status: "PAID" }).gateway,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).result).toBe("ignored");
    expect((await orderStatus(order.id)).status).toBe("PENDING");
  });

  it("an event with status other than PAID is ignored", async () => {
    const { order, chargeId } = await pendingOrder();
    const event = paidEvent(chargeId, { data: { transparent: { id: chargeId, amount: 990, status: "PENDING" } } });
    const response = await handleWebhook(webhookRequest(event), { gateway: recordingGateway({ status: "PAID" }).gateway });
    expect((await response.json()).result).toBe("ignored");
    expect((await orderStatus(order.id)).status).toBe("PENDING");
  });

  it("a devMode event is ignored in production", async () => {
    const { order, chargeId } = await pendingOrder();
    vi.stubEnv("NODE_ENV", "production");
    const response = await handleWebhook(webhookRequest(paidEvent(chargeId, { devMode: true })), {
      gateway: recordingGateway({ status: "PAID" }).gateway,
    });
    expect((await response.json()).result).toBe("ignored");
    expect((await orderStatus(order.id)).status).toBe("PENDING");
  });

  it("a provider failure answers 503 and leaves the event unprocessed", async () => {
    const { order, chargeId } = await pendingOrder();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { gateway } = recordingGateway({ failCheck: true });
    const event = paidEvent(chargeId);
    const response = await handleWebhook(webhookRequest(event), { gateway, startGeneration: vi.fn() });

    expect(response.status).toBe(503);
    expect((await orderStatus(order.id)).status).toBe("PENDING");
    const { data } = await db.from("webhook_events").select("processed_at").eq("event_id", event.id).single();
    expect(data!.processed_at).toBeNull();
  });

  it("the retry after a provider failure approves the order", async () => {
    const { order, chargeId } = await pendingOrder();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = recordingGateway({ failCheck: true });
    const event = paidEvent(chargeId);
    await handleWebhook(webhookRequest(event), { gateway: failing.gateway, startGeneration: vi.fn() });

    const healthy = recordingGateway({ status: "PAID" });
    const response = await handleWebhook(webhookRequest(event), { gateway: healthy.gateway, startGeneration: vi.fn() });
    expect(response.status).toBe(200);
    expect((await response.json()).result).toBe("approved");
    expect((await orderStatus(order.id)).status).toBe("APPROVED");
    const { data } = await db.from("webhook_events").select("processed_at").eq("event_id", event.id).single();
    expect(data!.processed_at).not.toBeNull();
  });

  it("a start generation failure is recorded and the order stays APPROVED", async () => {
    const { order, chargeId } = await pendingOrder();
    const { gateway } = recordingGateway({ status: "PAID" });
    const startGeneration = vi.fn().mockRejectedValue(new Error("boom"));
    const response = await handleWebhook(webhookRequest(paidEvent(chargeId)), { gateway, startGeneration });

    expect(response.status).toBe(200);
    expect((await orderStatus(order.id)).status).toBe("APPROVED");
    expect(await automationSteps(order.id)).toContain("START_GENERATION");
  });

  it("a late payment is approved and recorded as LATE_PAYMENT_APPROVED", async () => {
    const { order, chargeId } = await pendingOrder("FAILED");
    const { gateway } = recordingGateway({ status: "PAID" });
    const startGeneration = vi.fn().mockResolvedValue(undefined);
    const response = await handleWebhook(webhookRequest(paidEvent(chargeId)), { gateway, startGeneration });

    expect(response.status).toBe(200);
    expect(await orderStatus(order.id)).toMatchObject({ status: "APPROVED", failure_reason: null });
    expect(await automationSteps(order.id)).toContain("LATE_PAYMENT_APPROVED");
    expect(startGeneration).toHaveBeenCalledTimes(1);
  });

  it("invalid JSON after authentication gets 400", async () => {
    const raw = "{not json";
    const response = await handleWebhook(webhookRequest(null, { raw }), { gateway: recordingGateway().gateway });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_JSON");
  });

  it("an oversized body gets 413", async () => {
    const raw = JSON.stringify({ id: "x", event: "transparent.completed", pad: "a".repeat(70 * 1024) });
    const response = await handleWebhook(webhookRequest(null, { raw }), { gateway: recordingGateway().gateway });
    expect(response.status).toBe(413);
  });

  it("the plain token is passed to the hook and never stored", async () => {
    const { order, chargeId } = await pendingOrder();
    const { gateway } = recordingGateway({ status: "PAID" });
    let received = "";
    const startGeneration = vi.fn(async (_orderId: string, token: string) => {
      received = token;
    });
    const response = await handleWebhook(webhookRequest(paidEvent(chargeId)), { gateway, startGeneration });

    expect(received.length).toBeGreaterThanOrEqual(43);
    expect(await response.text()).not.toContain(received);
    const [row] = await tokens(order.id);
    expect(row.token_hash).toBe(createHash("sha256").update(received).digest("hex"));
    expect(JSON.stringify(row)).not.toContain(received);
  });

  it("responses and logs never contain the secret", async () => {
    const { chargeId } = await pendingOrder();
    const spies = [vi.spyOn(console, "warn"), vi.spyOn(console, "error"), vi.spyOn(console, "info")].map((spy) =>
      spy.mockImplementation(() => {}),
    );
    const bad = await handleWebhook(webhookRequest(paidEvent(chargeId), { signature: "bm9wZQ==" }), {
      gateway: recordingGateway({ status: "PAID" }).gateway,
    });
    const good = await handleWebhook(webhookRequest(paidEvent(chargeId)), {
      gateway: recordingGateway({ status: "PAID" }).gateway,
      startGeneration: vi.fn(),
    });
    for (const text of [await bad.text(), await good.text(), JSON.stringify(spies.map((spy) => spy.mock.calls))]) {
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain(PUBLIC_KEY);
    }
  });
});
