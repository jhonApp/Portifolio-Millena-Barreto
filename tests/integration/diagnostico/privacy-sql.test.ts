import { afterAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import {
  addDiagnosisRecords,
  addPaidOrder,
  adminClient,
  createAttempt,
  createCustomerWithAnswers,
  createOrderWithPayment,
  expireAttempt,
} from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const orderIds: string[] = [];
const requestIds: string[] = [];
const eventIds: string[] = [];

afterAll(async () => {
  if (orderIds.length) await db.from("orders").delete().in("id", orderIds);
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  if (requestIds.length) await db.from("deletion_requests").delete().in("id", requestIds);
  if (eventIds.length) await db.from("webhook_events").delete().in("event_id", eventIds);
});

async function customer(email?: string) {
  const created = await createCustomerWithAnswers(db, email);
  customerIds.push(created.customerId);
  return created;
}

async function erase(customerId: string) {
  const { data, error } = await db.rpc("erase_customer", { p_customer: customerId });
  if (error) throw new Error(error.message);
  return (data as unknown as { result: string }).result;
}

describe("deletion requests (SQL)", () => {
  async function request(overrides: { expires?: Date; confirmed?: boolean } = {}) {
    const hash = createHash("sha256").update(randomUUID()).digest("hex");
    const { data, error } = await db
      .from("deletion_requests")
      .insert({
        email: "someone@example.com",
        token_hash: hash,
        expires_at: (overrides.expires ?? new Date(Date.now() + 86400_000)).toISOString(),
        confirmed_at: overrides.confirmed ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    requestIds.push(data.id);
    return { id: data.id, hash };
  }
  const confirm = async (hash: string) => {
    const { data, error } = await db.rpc("confirm_deletion_request", { p_token_hash: hash });
    if (error) throw new Error(error.message);
    return data as unknown as { result: string; request_id?: string; completed?: boolean };
  };

  it("confirm_deletion_request is idempotent and detects expiry", async () => {
    expect((await confirm("no-such-hash")).result).toBe("unknown");

    const expired = await request({ expires: new Date(Date.now() - 1000) });
    expect((await confirm(expired.hash)).result).toBe("expired");

    const valid = await request();
    const first = await confirm(valid.hash);
    expect(first).toEqual({ result: "confirmed", request_id: valid.id, completed: false });
    const { data: before } = await db.from("deletion_requests").select("confirmed_at").eq("id", valid.id).single();
    const second = await confirm(valid.hash);
    expect(second.result).toBe("confirmed");
    const { data: after } = await db.from("deletion_requests").select("confirmed_at").eq("id", valid.id).single();
    expect(after!.confirmed_at).toBe(before!.confirmed_at);

    // A request confirmed in time stays confirmable after the 24 hours pass.
    await db.from("deletion_requests").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", valid.id);
    expect((await confirm(valid.hash)).result).toBe("confirmed");
  });

  it("complete_deletion_request succeeds once", async () => {
    const { id, hash } = await request();
    await confirm(hash);
    const first = await db.rpc("complete_deletion_request", { p_request: id });
    const second = await db.rpc("complete_deletion_request", { p_request: id });
    expect(first.data).toBe(true);
    expect(second.data).toBe(false);
    expect((await confirm(hash)).completed).toBe(true);
  });
});

describe("erase_customer", () => {
  it("erase_customer keeps paid orders detached and deletes unpaid ones", async () => {
    const mine = await customer();
    const paid = await addPaidOrder(db, mine.attemptId, { status: "DELIVERED" });
    orderIds.push(paid.orderId);
    await addDiagnosisRecords(db, paid.orderId);
    // A second attempt with a Pix that was never paid.
    const second = await createAttempt(db, mine.customerId);
    const { order: unpaid } = await createOrderWithPayment(db, second.id, "PENDING");

    expect(await erase(mine.customerId)).toBe("erased");

    expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toEqual([]);
    expect((await db.from("purchase_attempts").select("id").in("id", [mine.attemptId, second.id])).data).toEqual([]);
    expect((await db.from("answers").select("id").eq("attempt_id", mine.attemptId)).data).toEqual([]);
    expect((await db.from("consent_records").select("id").eq("attempt_id", mine.attemptId)).data).toEqual([]);
    expect((await db.from("results").select("id").eq("order_id", paid.orderId)).data).toEqual([]);
    expect((await db.from("deliveries").select("id").eq("order_id", paid.orderId)).data).toEqual([]);
    expect((await db.from("result_tokens").select("id").eq("order_id", paid.orderId)).data).toEqual([]);

    const { data: order } = await db.from("orders").select("*").eq("id", paid.orderId).single();
    expect(order).toMatchObject({ attempt_id: null, status: "DELIVERED", amount_cents: 990 });
    expect(order!.approved_at).not.toBeNull();
    expect((await db.from("orders").select("id").eq("id", unpaid.id)).data).toEqual([]);
    expect((await db.from("payments").select("id").eq("order_id", unpaid.id)).data).toEqual([]);
  });

  it("erase_customer clears the Pix code, the Pix image and the webhook payload of paid orders", async () => {
    const mine = await customer();
    const paid = await addPaidOrder(db, mine.attemptId, { status: "DELIVERED" });
    orderIds.push(paid.orderId);
    const eventId = `evt_${randomUUID()}`;
    eventIds.push(eventId);
    await db.from("webhook_events").insert({
      event_id: eventId,
      event_type: "transparent.completed",
      payload: { id: eventId, data: { transparent: { id: paid.chargeId, amount: 990, status: "PAID" }, payer: { name: "Maria" } } },
    });

    expect(await erase(mine.customerId)).toBe("erased");

    const { data: payment } = await db.from("payments").select("*").eq("order_id", paid.orderId).single();
    expect(payment).toMatchObject({ pix_br_code: null, pix_qr_image: null, status: "PAID", amount_cents: 990 });
    expect(payment!.provider_charge_id).toBe(paid.chargeId);
    const { data: event } = await db.from("webhook_events").select("payload").eq("event_id", eventId).single();
    expect(event!.payload).toEqual({ anonymized: true });
  });

  it("erase_customer defers while an order is APPROVED or PROCESSING", async () => {
    for (const status of ["APPROVED", "PROCESSING"] as const) {
      const mine = await customer();
      const paid = await addPaidOrder(db, mine.attemptId, { status });
      orderIds.push(paid.orderId);
      expect(await erase(mine.customerId)).toBe("deferred");
      expect((await db.from("customers").select("id").eq("id", mine.customerId)).data).toHaveLength(1);
      expect((await db.from("answers").select("id").eq("attempt_id", mine.attemptId)).data!.length).toBe(15);
      const { data: plan } = await db.rpc("erasure_plan", { p_customer: mine.customerId });
      expect((plan as unknown as { in_flight: boolean }).in_flight).toBe(true);
    }
  });

  it("erasure_plan lists the orders that have a stored PDF", async () => {
    const mine = await customer();
    const paid = await addPaidOrder(db, mine.attemptId, { status: "DELIVERED" });
    orderIds.push(paid.orderId);
    await addDiagnosisRecords(db, paid.orderId);
    const { data } = await db.rpc("erasure_plan", { p_customer: mine.customerId });
    expect(data).toEqual({ in_flight: false, pdf_orders: [paid.orderId] });
  });

  it("erase_customer is idempotent", async () => {
    const mine = await customer();
    expect(await erase(mine.customerId)).toBe("erased");
    expect(await erase(mine.customerId)).toBe("not_found");
  });
});

describe("purge_unpaid_attempts", () => {
  /** The function is global and takes the oldest first: keep calling it until nothing is left. */
  async function purgeAll() {
    let total = 0;
    for (let i = 0; i < 30; i++) {
      const { data, error } = await db.rpc("purge_unpaid_attempts", { p_limit: 100 });
      if (error) throw new Error(error.message);
      if (!data) break;
      total += data;
    }
    return total;
  }

  it("purge_unpaid_attempts removes orders without payment and customers left without attempts", async () => {
    const old = await customer();
    await expireAttempt(db, old.attemptId);
    const { order } = await createOrderWithPayment(db, old.attemptId, "PENDING");

    const recent = await customer(); // an attempt still inside its 7 days stays

    const kept = await customer(); // expired, but paid: stays
    await expireAttempt(db, kept.attemptId);
    const paid = await addPaidOrder(db, kept.attemptId, { status: "DELIVERED" });
    orderIds.push(paid.orderId);

    const mixed = await customer(); // expired unpaid attempt + a live attempt: only the attempt goes
    await expireAttempt(db, mixed.attemptId);
    const live = await createAttempt(db, mixed.customerId);

    expect(await purgeAll()).toBeGreaterThanOrEqual(2);

    expect((await db.from("customers").select("id").eq("id", old.customerId)).data).toEqual([]);
    expect((await db.from("purchase_attempts").select("id").eq("id", old.attemptId)).data).toEqual([]);
    expect((await db.from("answers").select("id").eq("attempt_id", old.attemptId)).data).toEqual([]);
    expect((await db.from("consent_records").select("id").eq("attempt_id", old.attemptId)).data).toEqual([]);
    expect((await db.from("orders").select("id").eq("id", order.id)).data).toEqual([]);

    expect((await db.from("purchase_attempts").select("id").eq("id", recent.attemptId)).data).toHaveLength(1);
    expect((await db.from("purchase_attempts").select("id").eq("id", kept.attemptId)).data).toHaveLength(1);
    expect((await db.from("orders").select("id").eq("id", paid.orderId)).data).toHaveLength(1);

    expect((await db.from("purchase_attempts").select("id").eq("id", mixed.attemptId)).data).toEqual([]);
    expect((await db.from("purchase_attempts").select("id").eq("id", live.id)).data).toHaveLength(1);
    expect((await db.from("customers").select("id").eq("id", mixed.customerId)).data).toHaveLength(1);
  });
});

describe("paid_customers_due", () => {
  async function due(): Promise<string[]> {
    const { data, error } = await db.rpc("paid_customers_due", { p_limit: 1000 });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  it("paid_customers_due lists only customers whose paid orders are all old", async () => {
    const old = await customer();
    await expireAttempt(db, old.attemptId);
    orderIds.push((await addPaidOrder(db, old.attemptId, { monthsAgo: 13 })).orderId);

    const recent = await customer();
    await expireAttempt(db, recent.attemptId);
    orderIds.push((await addPaidOrder(db, recent.attemptId, { monthsAgo: 2 })).orderId);

    const mixed = await customer();
    await expireAttempt(db, mixed.attemptId);
    orderIds.push((await addPaidOrder(db, mixed.attemptId, { monthsAgo: 14 })).orderId);
    const secondAttempt = await createAttempt(db, mixed.customerId);
    await expireAttempt(db, secondAttempt.id);
    orderIds.push((await addPaidOrder(db, secondAttempt.id, { monthsAgo: 1 })).orderId);

    const inFlight = await customer();
    await expireAttempt(db, inFlight.attemptId);
    orderIds.push((await addPaidOrder(db, inFlight.attemptId, { monthsAgo: 13, status: "PROCESSING" })).orderId);

    const active = await customer(); // old paid order but an attempt that is still live
    orderIds.push((await addPaidOrder(db, active.attemptId, { monthsAgo: 13 })).orderId);

    const ids = await due();
    expect(ids).toContain(old.customerId);
    for (const other of [recent, mixed, inFlight, active]) expect(ids).not.toContain(other.customerId);
  });

  it("an unpaid customer is never listed", async () => {
    const unpaid = await customer();
    await expireAttempt(db, unpaid.attemptId);
    expect(await due()).not.toContain(unpaid.customerId);
  });
});
