import { afterAll, describe, expect, it } from "vitest";
import { ensureCheckout, CheckoutError } from "@/lib/diagnostico/checkout";
import { adminClient, createAttempt, createCustomer, createOrder, fillAnswers, recordingGateway } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];

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

async function expirePayment(orderId: string) {
  await db.from("payments").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("order_id", orderId);
}

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
});

describe("begin_checkout, attach_charge and abort_checkout", () => {
  it("first call creates one PENDING order and the charge is attached", async () => {
    const attempt = await completeAttempt();
    const { gateway, calls } = recordingGateway();
    const result = await ensureCheckout(db, gateway, attempt.id, { renew: false });

    expect(result).toMatchObject({ state: "pending", created: true, amountCents: 990 });
    const orders = await ordersOf(attempt.id);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ status: "PENDING", amount_cents: 990 });
    const payments = await paymentsOf(orders[0].id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ amount_cents: 990, status: "PENDING", pix_br_code: "CODE-1" });
    expect(calls).toEqual([{ orderId: orders[0].id, amountCents: 990, expiresInSeconds: 1800 }]);
  });

  it("second call returns the existing Pix without a new order", async () => {
    const attempt = await completeAttempt();
    const { gateway, calls } = recordingGateway();
    const first = await ensureCheckout(db, gateway, attempt.id, { renew: false });
    const second = await ensureCheckout(db, gateway, attempt.id, { renew: false });

    expect(second).toMatchObject({ state: "pending", created: false });
    expect(second.state === "pending" && first.state === "pending" && second.orderId).toBe(
      first.state === "pending" ? first.orderId : "",
    );
    expect(calls).toHaveLength(1);
    expect(await ordersOf(attempt.id)).toHaveLength(1);
  });

  it("two concurrent calls create one order", async () => {
    const attempt = await completeAttempt();
    const { gateway, calls } = recordingGateway({ delayMs: 300 });
    const outcomes = await Promise.allSettled([
      ensureCheckout(db, gateway, attempt.id, { renew: false }),
      ensureCheckout(db, gateway, attempt.id, { renew: false }),
    ]);

    expect(calls).toHaveLength(1);
    expect(await ordersOf(attempt.id)).toHaveLength(1);
    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(CheckoutError);
    expect((rejected[0].reason as CheckoutError).code).toBe("CHECKOUT_IN_PROGRESS");
  });

  it("a second PENDING order for the same attempt is rejected by the index", async () => {
    const attempt = await completeAttempt();
    await createOrder(db, attempt.id, "PENDING");
    await expect(createOrder(db, attempt.id, "PENDING")).rejects.toThrow(/orders_one_pending_per_attempt|duplicate/);
  });

  it("an expired Pix marks the order FAILED with PIX_EXPIRED and the payment EXPIRED", async () => {
    const attempt = await completeAttempt();
    const { gateway } = recordingGateway();
    const first = await ensureCheckout(db, gateway, attempt.id, { renew: false });
    const orderId = first.state === "pending" ? first.orderId : "";
    await expirePayment(orderId);

    const result = await ensureCheckout(db, gateway, attempt.id, { renew: false });
    expect(result).toEqual({ state: "expired" });
    const [order] = await ordersOf(attempt.id);
    expect(order).toMatchObject({ status: "FAILED", failure_reason: "PIX_EXPIRED" });
    expect((await paymentsOf(orderId))[0].status).toBe("EXPIRED");
  });

  it("begin_checkout does not create after expiry unless renewal is requested", async () => {
    const attempt = await completeAttempt();
    const { gateway, calls } = recordingGateway();
    const first = await ensureCheckout(db, gateway, attempt.id, { renew: false });
    await expirePayment(first.state === "pending" ? first.orderId : "");

    await ensureCheckout(db, gateway, attempt.id, { renew: false });
    await ensureCheckout(db, gateway, attempt.id, { renew: false });
    expect(calls).toHaveLength(1);
    expect(await ordersOf(attempt.id)).toHaveLength(1);
  });

  it("renew creates a new PENDING order for the same attempt", async () => {
    const attempt = await completeAttempt();
    const { gateway, calls } = recordingGateway();
    const first = await ensureCheckout(db, gateway, attempt.id, { renew: false });
    const firstOrder = first.state === "pending" ? first.orderId : "";
    await expirePayment(firstOrder);

    const renewed = await ensureCheckout(db, gateway, attempt.id, { renew: true });
    expect(renewed).toMatchObject({ state: "pending", created: true });
    expect(renewed.state === "pending" && renewed.orderId).not.toBe(firstOrder);
    const orders = await ordersOf(attempt.id);
    expect(orders.map((o) => o.status).sort()).toEqual(["FAILED", "PENDING"]);
    expect(calls).toHaveLength(2);
    // The answers were not touched.
    const { count } = await db.from("answers").select("*", { count: "exact", head: true }).eq("attempt_id", attempt.id);
    expect(count).toBe(15);
  });

  it("incomplete answers raise ANSWERS_INCOMPLETE", async () => {
    const attempt = await completeAttempt(14);
    const { gateway, calls } = recordingGateway();
    await expect(ensureCheckout(db, gateway, attempt.id, { renew: false })).rejects.toMatchObject({
      code: "ANSWERS_INCOMPLETE",
    });
    expect(calls).toHaveLength(0);
    expect(await ordersOf(attempt.id)).toHaveLength(0);
  });

  it("an expired attempt raises ATTEMPT_NOT_FOUND", async () => {
    const attempt = await completeAttempt();
    await db.from("purchase_attempts").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", attempt.id);
    const { gateway } = recordingGateway();
    await expect(ensureCheckout(db, gateway, attempt.id, { renew: false })).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
    });
  });

  it("a PENDING order without payment younger than 60 seconds answers in_progress", async () => {
    const attempt = await completeAttempt();
    await createOrder(db, attempt.id, "PENDING");
    const { gateway, calls } = recordingGateway();
    await expect(ensureCheckout(db, gateway, attempt.id, { renew: false })).rejects.toMatchObject({
      code: "CHECKOUT_IN_PROGRESS",
    });
    expect(calls).toHaveLength(0);
  });

  it("a PENDING order without payment older than 60 seconds is replaced", async () => {
    const attempt = await completeAttempt();
    const stale = await createOrder(db, attempt.id, "PENDING");
    await db.from("orders").update({ created_at: new Date(Date.now() - 120_000).toISOString() }).eq("id", stale.id);
    const { gateway, calls } = recordingGateway();
    const result = await ensureCheckout(db, gateway, attempt.id, { renew: false });

    expect(result).toMatchObject({ state: "pending", created: true });
    expect(calls).toHaveLength(1);
    const orders = await ordersOf(attempt.id);
    expect(orders).toHaveLength(1);
    expect(orders[0].id).not.toBe(stale.id);
  });

  it("an attempt with a paid order answers paid and creates nothing", async () => {
    const attempt = await completeAttempt();
    const { gateway, calls } = recordingGateway();
    const first = await ensureCheckout(db, gateway, attempt.id, { renew: false });
    const orderId = first.state === "pending" ? first.orderId : "";
    await db.from("payments").update({ status: "PAID", paid_at: new Date().toISOString() }).eq("order_id", orderId);
    await db.from("orders").update({ status: "APPROVED", approved_at: new Date().toISOString() }).eq("id", orderId);

    const result = await ensureCheckout(db, gateway, attempt.id, { renew: true });
    expect(result).toEqual({ state: "paid", orderStatus: "APPROVED" });
    expect(calls).toHaveLength(1);
    expect(await ordersOf(attempt.id)).toHaveLength(1);
  });

  it("abort_checkout deletes an order without payment", async () => {
    const attempt = await completeAttempt();
    const order = await createOrder(db, attempt.id, "PENDING");
    const { error } = await db.rpc("abort_checkout", { p_order: order.id });
    expect(error).toBeNull();
    expect(await ordersOf(attempt.id)).toHaveLength(0);
  });

  it("abort_checkout keeps an order that has a payment", async () => {
    const attempt = await completeAttempt();
    const { gateway } = recordingGateway();
    const first = await ensureCheckout(db, gateway, attempt.id, { renew: false });
    const orderId = first.state === "pending" ? first.orderId : "";
    await db.rpc("abort_checkout", { p_order: orderId });
    expect(await ordersOf(attempt.id)).toHaveLength(1);
    expect(await paymentsOf(orderId)).toHaveLength(1);
  });

  it("attach_charge rejects an order that is not PENDING", async () => {
    const attempt = await completeAttempt();
    const failed = await createOrder(db, attempt.id, "FAILED");
    const { error } = await db.rpc("attach_charge", {
      p_order: failed.id,
      p_charge_id: `test_${failed.id}`,
      p_br_code: "x",
      p_qr_image: "y",
      p_expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(error?.message).toContain("ORDER_NOT_PENDING");
  });

  it("the amount of the payment is the amount of the order", async () => {
    const attempt = await completeAttempt();
    const { gateway } = recordingGateway();
    const result = await ensureCheckout(db, gateway, attempt.id, { renew: false });
    const orderId = result.state === "pending" ? result.orderId : "";
    const [order] = await ordersOf(attempt.id);
    const [payment] = await paymentsOf(orderId);
    expect(payment.amount_cents).toBe(order.amount_cents);
    expect(payment.amount_cents).toBe(990);
  });

  it("a gateway failure leaves no PENDING order", async () => {
    const attempt = await completeAttempt();
    const { gateway } = recordingGateway({ failCreate: true });
    await expect(ensureCheckout(db, gateway, attempt.id, { renew: false })).rejects.toMatchObject({
      code: "PIX_UNAVAILABLE",
    });
    expect(await ordersOf(attempt.id)).toHaveLength(0);
  });
});
