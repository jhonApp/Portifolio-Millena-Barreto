import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, createAttempt, createCustomer, createOrderWithPayment } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const eventIds: string[] = [];

async function newAttempt() {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  return createAttempt(db, customer.id);
}

async function approve(chargeId: string, hash = `hash-${randomUUID()}`) {
  const { data, error } = await db.rpc("approve_order", { p_charge_id: chargeId, p_token_hash: hash });
  if (error) throw new Error(error.message);
  return data as unknown as { result: string; order_id?: string; late?: boolean; order_status?: string };
}

async function orderRow(orderId: string) {
  const { data } = await db.from("orders").select("*").eq("id", orderId).single();
  return data!;
}

async function tokensOf(orderId: string) {
  const { data } = await db.from("result_tokens").select("*").eq("order_id", orderId);
  return data ?? [];
}

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  if (eventIds.length) await db.from("webhook_events").delete().in("event_id", eventIds);
});

describe("record_webhook_event", () => {
  async function record(eventId: string) {
    eventIds.push(eventId);
    const { data, error } = await db.rpc("record_webhook_event", {
      p_event_id: eventId,
      p_event_type: "transparent.completed",
      p_payload: { id: eventId },
    });
    if (error) throw new Error(error.message);
    return data as unknown as string;
  }

  it("record_webhook_event answers new for the first delivery", async () => {
    expect(await record(`evt_${randomUUID()}`)).toBe("new");
  });

  it("record_webhook_event answers duplicate_unprocessed until it is marked processed", async () => {
    const id = `evt_${randomUUID()}`;
    expect(await record(id)).toBe("new");
    expect(await record(id)).toBe("duplicate_unprocessed");
  });

  it("record_webhook_event answers duplicate_processed for a repeated id", async () => {
    const id = `evt_${randomUUID()}`;
    await record(id);
    await db.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", id);
    expect(await record(id)).toBe("duplicate_processed");
    const { count } = await db.from("webhook_events").select("*", { count: "exact", head: true }).eq("event_id", id);
    expect(count).toBe(1);
  });

  it("a duplicate_unprocessed event is processed again", async () => {
    const id = `evt_${randomUUID()}`;
    await record(id);
    // The first run crashed before finishing: processed_at is still null, so the retry is allowed.
    expect(await record(id)).toBe("duplicate_unprocessed");
  });
});

describe("approve_order", () => {
  it("approve_order approves a PENDING order and sets paid_at", async () => {
    const attempt = await newAttempt();
    const { order, payment, chargeId } = await createOrderWithPayment(db, attempt.id);
    const result = await approve(chargeId);

    expect(result).toMatchObject({ result: "approved", order_id: order.id, late: false });
    const row = await orderRow(order.id);
    expect(row.status).toBe("APPROVED");
    expect(row.approved_at).not.toBeNull();
    const { data: paid } = await db.from("payments").select("*").eq("id", payment.id).single();
    expect(paid).toMatchObject({ status: "PAID" });
    expect(paid!.paid_at).not.toBeNull();
  });

  it("approve_order stores only the token hash and a 30 day expiry", async () => {
    const attempt = await newAttempt();
    const { order, chargeId } = await createOrderWithPayment(db, attempt.id);
    await approve(chargeId, "the-hash");
    const [token] = await tokensOf(order.id);
    expect(token.token_hash).toBe("the-hash");
    const days = (new Date(token.expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    // The expiry comes from the database clock, the reference from the host clock: allow a small skew (about 3 ms was seen).
    expect(days).toBeLessThanOrEqual(30 + 1000 / 86_400_000); // one second of tolerance
  });

  it("approve_order called twice approves once and creates one token", async () => {
    const attempt = await newAttempt();
    const { order, chargeId } = await createOrderWithPayment(db, attempt.id);
    expect((await approve(chargeId)).result).toBe("approved");
    expect((await approve(chargeId)).result).toBe("already_approved");
    expect(await tokensOf(order.id)).toHaveLength(1);
  });

  it("concurrent approve_order calls approve once and create one token", async () => {
    const attempt = await newAttempt();
    const { order, chargeId } = await createOrderWithPayment(db, attempt.id);
    const results = await Promise.all(Array.from({ length: 6 }, () => approve(chargeId)));
    expect(results.filter((r) => r.result === "approved")).toHaveLength(1);
    expect(results.filter((r) => r.result === "already_approved")).toHaveLength(5);
    expect(await tokensOf(order.id)).toHaveLength(1);
  });

  it("a late payment on a FAILED PIX_EXPIRED order is approved and reported as late", async () => {
    const attempt = await newAttempt();
    const { order, chargeId } = await createOrderWithPayment(db, attempt.id, "FAILED");
    const result = await approve(chargeId);
    expect(result).toMatchObject({ result: "approved", late: true });
    expect((await orderRow(order.id)).status).toBe("APPROVED");
  });

  it("approve_order clears failure_reason of a late order", async () => {
    const attempt = await newAttempt();
    const { order, chargeId } = await createOrderWithPayment(db, attempt.id, "FAILED");
    await approve(chargeId);
    expect((await orderRow(order.id)).failure_reason).toBeNull();
  });

  it("a FAILED order with another reason is not approvable", async () => {
    const attempt = await newAttempt();
    const { order, chargeId } = await createOrderWithPayment(db, attempt.id, "FAILED");
    await db.from("orders").update({ failure_reason: "GENERATION_FAILED" }).eq("id", order.id);
    expect((await approve(chargeId)).result).toBe("not_approvable");
    expect((await orderRow(order.id)).status).toBe("FAILED");
    expect(await tokensOf(order.id)).toHaveLength(0);
  });

  it("a second paid order of the same attempt is not approved", async () => {
    const attempt = await newAttempt();
    const first = await createOrderWithPayment(db, attempt.id, "FAILED");
    const second = await createOrderWithPayment(db, attempt.id, "PENDING");
    expect((await approve(first.chargeId)).result).toBe("approved");
    const duplicate = await approve(second.chargeId);
    expect(duplicate).toMatchObject({ result: "duplicate_payment", order_id: second.order.id });
    expect((await orderRow(second.order.id)).status).toBe("PENDING");
    expect(await tokensOf(second.order.id)).toHaveLength(0);
  });

  it("an unknown charge id answers unknown_charge", async () => {
    expect((await approve(`nope_${randomUUID()}`)).result).toBe("unknown_charge");
  });
});
