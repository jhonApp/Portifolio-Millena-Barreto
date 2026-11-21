import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as checkout } from "@/app/api/diagnostico/checkout/route";
import { POST as renew } from "@/app/api/diagnostico/checkout/renew/route";
import { ATTEMPT_COOKIE, signAttemptId } from "@/lib/diagnostico/attempt-session";
import { resolveCheckoutAccess } from "@/lib/diagnostico/checkout";
import { EXPIRED_PATH, INCOMPLETE_PATH } from "@/lib/diagnostico/paths";
import { adminClient, createAttempt, createCustomer, fillAnswers } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];

const cookieFor = (attemptId: string) => `${ATTEMPT_COOKIE}=${signAttemptId(attemptId)}`;
const storeFor = (attemptId?: string) => ({
  get: (name: string) => (name === ATTEMPT_COOKIE && attemptId ? { value: signAttemptId(attemptId) } : undefined),
});

function call(handler: typeof checkout, cookie?: string, body?: string) {
  return handler(
    new Request("http://localhost/api/diagnostico/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body,
    }),
  );
}

async function completeAttempt(answers = 15) {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  const attempt = await createAttempt(db, customer.id);
  await fillAnswers(db, attempt.id, answers);
  return attempt;
}

async function ordersOf(attemptId: string) {
  const { data } = await db.from("orders").select("*").eq("attempt_id", attemptId).order("created_at");
  return data ?? [];
}

async function paymentsOf(orderId: string) {
  const { data } = await db.from("payments").select("*").eq("order_id", orderId);
  return data ?? [];
}

beforeEach(() => {
  vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "true");
  vi.stubEnv("PAYMENT_SIMULATION_FAIL", "false");
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  await db.from("rate_limits").delete().like("key", "checkout:%");
});

describe("POST /api/diagnostico/checkout", () => {
  it("first POST creates one order and one payment of 990 cents", async () => {
    const attempt = await completeAttempt();
    const response = await call(checkout, cookieFor(attempt.id));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ state: "pending", amountCents: 990 });
    expect(Object.keys(body).sort()).toEqual(["amountCents", "expiresAt", "orderId", "pixCode", "qrImage", "state"]);

    const orders = await ordersOf(attempt.id);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ id: body.orderId, status: "PENDING", amount_cents: 990 });
    const payments = await paymentsOf(orders[0].id);
    expect(payments).toHaveLength(1);
    expect(payments[0].amount_cents).toBe(990);
    // About 30 minutes of validity.
    const minutes = (new Date(payments[0].expires_at).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThanOrEqual(30);
  });

  it("reloading returns the same order and does not call the gateway again", async () => {
    const attempt = await completeAttempt();
    const first = await (await call(checkout, cookieFor(attempt.id))).json();
    const secondResponse = await call(checkout, cookieFor(attempt.id));
    const second = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(second.orderId).toBe(first.orderId);
    expect(second.pixCode).toBe(first.pixCode);
    expect(second.qrImage).toBe(first.qrImage);
    expect(await ordersOf(attempt.id)).toHaveLength(1);
    expect(await paymentsOf(first.orderId)).toHaveLength(1);
  });

  it("an amount sent by the browser is ignored", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const attempt = await completeAttempt();
    const response = await call(checkout, cookieFor(attempt.id), JSON.stringify({ amountCents: 1 }));
    expect(response.status).toBe(201);
    expect((await response.json()).amountCents).toBe(990);
    const [order] = await ordersOf(attempt.id);
    expect(order.amount_cents).toBe(990);
    expect((await paymentsOf(order.id))[0].amount_cents).toBe(990);
    expect(warn).toHaveBeenCalledWith("checkout: ignored an amount sent by the browser");
    warn.mockRestore();
  });

  it("POST checkout with 14 answers gets 409 ANSWERS_INCOMPLETE", async () => {
    const attempt = await completeAttempt(14);
    const response = await call(checkout, cookieFor(attempt.id));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("ANSWERS_INCOMPLETE");
    expect(await ordersOf(attempt.id)).toHaveLength(0);
  });

  it("request without cookie gets 403", async () => {
    const response = await call(checkout);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("tampered cookie gets 403", async () => {
    const attempt = await completeAttempt();
    const response = await call(checkout, `${ATTEMPT_COOKIE}=${attempt.id}.forged`);
    expect(response.status).toBe(403);
    expect(await ordersOf(attempt.id)).toHaveLength(0);
  });

  it("POST checkout after expiry answers expired", async () => {
    const attempt = await completeAttempt();
    const first = await (await call(checkout, cookieFor(attempt.id))).json();
    await db.from("payments").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("order_id", first.orderId);

    const response = await call(checkout, cookieFor(attempt.id));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "expired" });
    const [order] = await ordersOf(attempt.id);
    expect(order).toMatchObject({ status: "FAILED", failure_reason: "PIX_EXPIRED" });
  });

  it("a gateway failure leaves no PENDING order and answers 502 PIX_UNAVAILABLE", async () => {
    vi.stubEnv("PAYMENT_SIMULATION_FAIL", "true");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const attempt = await completeAttempt();
    const response = await call(checkout, cookieFor(attempt.id));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("PIX_UNAVAILABLE");
    expect(body.error.message).toBe("Não conseguimos gerar o Pix agora. Tente novamente em instantes.");
    expect(await ordersOf(attempt.id)).toHaveLength(0);
    error.mockRestore();
  });

  it("the next call after a gateway failure succeeds", async () => {
    vi.stubEnv("PAYMENT_SIMULATION_FAIL", "true");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const attempt = await completeAttempt();
    expect((await call(checkout, cookieFor(attempt.id))).status).toBe(502);
    vi.stubEnv("PAYMENT_SIMULATION_FAIL", "false");
    expect((await call(checkout, cookieFor(attempt.id))).status).toBe(201);
    expect(await ordersOf(attempt.id)).toHaveLength(1);
    error.mockRestore();
  });

  it("the thirty-first call in an hour gets 429 with Retry-After", async () => {
    const attempt = await completeAttempt();
    for (let i = 0; i < 30; i++) {
      const response = await call(checkout, cookieFor(attempt.id));
      expect([200, 201]).toContain(response.status);
    }
    const blocked = await call(checkout, cookieFor(attempt.id));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await ordersOf(attempt.id)).toHaveLength(1);
  });

  it("invalid JSON gets INVALID_JSON", async () => {
    const attempt = await completeAttempt();
    const response = await call(checkout, cookieFor(attempt.id), "{not json");
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_JSON");
  });

  it("missing ABACATEPAY_API_KEY outside simulation returns CONFIG_ERROR", async () => {
    vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "false");
    vi.stubEnv("ABACATEPAY_API_KEY", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const attempt = await completeAttempt();
    const response = await call(checkout, cookieFor(attempt.id));
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("CONFIG_ERROR");
    expect(await ordersOf(attempt.id)).toHaveLength(0);
    error.mockRestore();
  });

  it("the simulated gateway is used only when simulation is enabled", async () => {
    vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "false");
    vi.stubEnv("ABACATEPAY_API_KEY", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const attempt = await completeAttempt();
    // Simulation off: no fake charge is produced.
    expect((await call(checkout, cookieFor(attempt.id))).status).toBe(500);
    expect(await ordersOf(attempt.id)).toHaveLength(0);
    error.mockRestore();
  });

  it("answers never expose the charge identifier", async () => {
    const attempt = await completeAttempt();
    const text = await (await call(checkout, cookieFor(attempt.id))).text();
    const [order] = await ordersOf(attempt.id);
    const [payment] = await paymentsOf(order.id);
    expect(text).not.toContain(payment.provider_charge_id);
  });

  it("the checkout answer carries no payment instrument data", async () => {
    const attempt = await completeAttempt();
    const text = await (await call(checkout, cookieFor(attempt.id))).text();
    expect(text).not.toMatch(/card|cvv|cartao|cartão|cpf/i);
  });

  it("the payments table holds identifiers, amount, code, image and times only", async () => {
    // The column set is fixed by the schema: no payment instrument data.
    const attempt = await completeAttempt();
    await call(checkout, cookieFor(attempt.id));
    const [order] = await ordersOf(attempt.id);
    const [payment] = await paymentsOf(order.id);
    expect(Object.keys(payment).sort()).toEqual(
      [
        "amount_cents", "created_at", "expires_at", "id", "order_id", "paid_at", "pix_br_code",
        "pix_qr_image", "provider", "provider_charge_id", "status", "updated_at",
      ].sort(),
    );
  });
});

describe("POST /api/diagnostico/checkout/renew", () => {
  it("POST renew after expiry creates a new order and keeps the answers", async () => {
    const attempt = await completeAttempt();
    const first = await (await call(checkout, cookieFor(attempt.id))).json();
    await db.from("payments").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("order_id", first.orderId);

    const response = await call(renew, cookieFor(attempt.id));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.state).toBe("pending");
    expect(body.orderId).not.toBe(first.orderId);
    const orders = await ordersOf(attempt.id);
    expect(orders.map((o) => o.status).sort()).toEqual(["FAILED", "PENDING"]);
    expect(orders.find((o) => o.id === first.orderId)).toMatchObject({ failure_reason: "PIX_EXPIRED" });
    const { count } = await db.from("answers").select("*", { count: "exact", head: true }).eq("attempt_id", attempt.id);
    expect(count).toBe(15);
  });

  it("POST renew with a valid Pix returns the same order", async () => {
    const attempt = await completeAttempt();
    const first = await (await call(checkout, cookieFor(attempt.id))).json();
    const response = await call(renew, cookieFor(attempt.id));
    expect(response.status).toBe(200);
    expect((await response.json()).orderId).toBe(first.orderId);
    expect(await ordersOf(attempt.id)).toHaveLength(1);
  });

  it("renew without cookie gets 403", async () => {
    expect((await call(renew)).status).toBe(403);
  });
});

describe("page access (resolveCheckoutAccess)", () => {
  it("resolveCheckoutAccess allows an attempt with 15 answers", async () => {
    const attempt = await completeAttempt();
    expect(await resolveCheckoutAccess(db, storeFor(attempt.id))).toEqual({ ok: true, attemptId: attempt.id });
  });

  it("resolveCheckoutAccess redirects an attempt with 14 answers to the questionnaire", async () => {
    const attempt = await completeAttempt(14);
    expect(await resolveCheckoutAccess(db, storeFor(attempt.id))).toEqual({ ok: false, redirectTo: INCOMPLETE_PATH });
  });

  it("resolveCheckoutAccess redirects an attempt with no answers to the questionnaire", async () => {
    const attempt = await completeAttempt(0);
    expect(await resolveCheckoutAccess(db, storeFor(attempt.id))).toEqual({ ok: false, redirectTo: INCOMPLETE_PATH });
  });

  it("resolveCheckoutAccess redirects without a cookie to the expired path", async () => {
    expect(await resolveCheckoutAccess(db, storeFor())).toEqual({ ok: false, redirectTo: EXPIRED_PATH });
  });
});
