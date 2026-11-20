import { afterAll, describe, expect, it } from "vitest";
import { adminClient, createAttempt, createCustomer, createOrderWithPayment } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];

async function approvedOrder(paid = true) {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  const attempt = await createAttempt(db, customer.id);
  const { order } = await createOrderWithPayment(db, attempt.id, "APPROVED");
  if (paid) await db.from("payments").update({ status: "PAID" }).eq("order_id", order.id);
  return order;
}

async function claim(orderId: string) {
  const { data, error } = await db.rpc("claim_generation", { p_order: orderId });
  if (error) throw new Error(error.message);
  return data as unknown as { claimed: boolean; attempt?: number; reason?: string };
}

async function fail(orderId: string, reason = "GENERATION_FAILED", retry = true) {
  const { data, error } = await db.rpc("fail_generation", { p_order: orderId, p_reason: reason, p_retry: retry });
  if (error) throw new Error(error.message);
  return data as unknown as { state: string; next_at?: string; reason?: string };
}

async function row(orderId: string) {
  const { data } = await db.from("orders").select("*").eq("id", orderId).single();
  return data!;
}

/** Makes the lease or the schedule of an order due now. */
async function makeDue(orderId: string) {
  await db.from("orders").update({ generation_next_at: new Date(Date.now() - 1000).toISOString() }).eq("id", orderId);
}

const secondsAhead = (iso: string) => (new Date(iso).getTime() - Date.now()) / 1000;

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
});

describe("claim_generation", () => {
  it("claim_generation moves an APPROVED order to PROCESSING and counts the attempt", async () => {
    const order = await approvedOrder();
    expect(await claim(order.id)).toEqual({ claimed: true, attempt: 1 });
    const after = await row(order.id);
    expect(after).toMatchObject({ status: "PROCESSING", generation_attempts: 1 });
    // The lease is about 2 minutes.
    expect(secondsAhead(after.generation_next_at!)).toBeGreaterThan(100);
    expect(secondsAhead(after.generation_next_at!)).toBeLessThanOrEqual(120);
  });

  it("a second claim before the lease ends is not claimed", async () => {
    const order = await approvedOrder();
    await claim(order.id);
    expect(await claim(order.id)).toMatchObject({ claimed: false, reason: "not_claimable" });
    expect((await row(order.id)).generation_attempts).toBe(1);
  });

  it("claim_generation refuses an order that is not APPROVED or due", async () => {
    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    const attempt = await createAttempt(db, customer.id);
    const { order: pending } = await createOrderWithPayment(db, attempt.id, "PENDING");
    expect((await claim(pending.id)).claimed).toBe(false);
    expect((await row(pending.id)).status).toBe("PENDING");
    expect(await claim("00000000-0000-4000-8000-000000000000")).toMatchObject({ claimed: false, reason: "not_found" });
  });

  it("an expired lease can be claimed again", async () => {
    const order = await approvedOrder();
    await claim(order.id);
    await makeDue(order.id);
    expect(await claim(order.id)).toEqual({ claimed: true, attempt: 2 });
  });

  it("two simultaneous claims reserve the order once", async () => {
    const order = await approvedOrder();
    const results = await Promise.all([claim(order.id), claim(order.id), claim(order.id)]);
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    expect((await row(order.id)).generation_attempts).toBe(1);
  });

  it("claim_generation refuses after four attempts", async () => {
    const order = await approvedOrder();
    await db.from("orders").update({ status: "PROCESSING", generation_attempts: 4, generation_next_at: new Date(Date.now() - 1000).toISOString() }).eq("id", order.id);
    expect(await claim(order.id)).toMatchObject({ claimed: false, reason: "attempts_exhausted" });
  });
});

describe("fail_generation", () => {
  it("fail_generation follows the schedule and fails on the fourth attempt", async () => {
    const order = await approvedOrder();
    const expected = [30, 120, 600];
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect((await claim(order.id)).claimed).toBe(true);
      const outcome = await fail(order.id);
      expect(outcome.state).toBe("retry");
      const seconds = secondsAhead(outcome.next_at!);
      expect(seconds).toBeGreaterThan(expected[attempt - 1] - 5);
      expect(seconds).toBeLessThanOrEqual(expected[attempt - 1]);
      expect((await row(order.id)).status).toBe("PROCESSING");
      await makeDue(order.id);
    }
    expect((await claim(order.id)).attempt).toBe(4);
    expect(await fail(order.id)).toEqual({ state: "failed", reason: "GENERATION_FAILED" });
    expect(await row(order.id)).toMatchObject({ status: "FAILED", failure_reason: "GENERATION_FAILED", generation_next_at: null });
  });

  it("fail_generation with retry false fails at once with the given reason", async () => {
    const order = await approvedOrder();
    await claim(order.id);
    expect(await fail(order.id, "MISSING_CONTENT", false)).toEqual({ state: "failed", reason: "MISSING_CONTENT" });
    expect(await row(order.id)).toMatchObject({ status: "FAILED", failure_reason: "MISSING_CONTENT" });
  });

  it("fail_generation ignores an order that is not being processed", async () => {
    const order = await approvedOrder();
    expect((await fail(order.id)).state).toBe("ignored");
    expect((await row(order.id)).status).toBe("APPROVED");
  });
});

describe("reset_generation", () => {
  async function reset(orderId: string) {
    const { data, error } = await db.rpc("reset_generation", { p_order: orderId });
    if (error) throw new Error(error.message);
    return data as unknown as boolean;
  }

  it("reset_generation only resets a paid order that failed in generation", async () => {
    const order = await approvedOrder();
    await claim(order.id);
    await fail(order.id, "MISSING_CONTENT", false);
    expect(await reset(order.id)).toBe(true);
    expect(await row(order.id)).toMatchObject({
      status: "APPROVED",
      failure_reason: null,
      generation_attempts: 0,
      generation_next_at: null,
    });
  });

  it("reset_generation refuses an unpaid order, another failure reason and a healthy order", async () => {
    const unpaid = await approvedOrder(false);
    await claim(unpaid.id);
    await fail(unpaid.id, "INVALID_ANSWERS", false);
    expect(await reset(unpaid.id)).toBe(false);

    const expired = await approvedOrder();
    await db.from("orders").update({ status: "FAILED", failure_reason: "PIX_EXPIRED" }).eq("id", expired.id);
    expect(await reset(expired.id)).toBe(false);

    const healthy = await approvedOrder();
    expect(await reset(healthy.id)).toBe(false);
    expect((await row(healthy.id)).status).toBe("APPROVED");
  });
});
