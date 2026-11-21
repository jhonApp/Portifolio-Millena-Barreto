import { afterAll, describe, expect, it } from "vitest";
import { DELIVERY_RETRY_DELAYS_SECONDS, MAX_DELIVERY_ATTEMPTS } from "@/lib/diagnostico/constants";
import { adminClient, createApprovedOrder, validContent, validPoints } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];

/** An order in PROCESSING with a saved result (the state in which the delivery starts). */
async function processedOrder(withResult = true) {
  const created = await createApprovedOrder(db);
  customerIds.push(created.customerId);
  await db.from("orders").update({ status: "PROCESSING" }).eq("id", created.orderId);
  if (withResult) {
    const { data: version } = await db.from("questionnaire_versions").select("id").eq("status", "published").single();
    const { error } = await db.from("results").insert({
      order_id: created.orderId,
      version_id: version!.id,
      points: validPoints,
      predominant_style: "elegante",
      secondary_style: "romantico",
      content: validContent,
      pdf_path: `${created.orderId}.pdf`,
    });
    if (error) throw new Error(error.message);
  }
  return created.orderId;
}

async function claim(orderId: string) {
  const { data, error } = await db.rpc("claim_delivery", { p_order: orderId });
  if (error) throw new Error(error.message);
  return data as unknown as { claimed: boolean; attempt?: number; reason?: string };
}
async function fail(orderId: string, message = "provider down") {
  const { data, error } = await db.rpc("fail_delivery", { p_order: orderId, p_error: message });
  if (error) throw new Error(error.message);
  return data as unknown as { state: string; next_at?: string };
}
async function complete(orderId: string) {
  const { error } = await db.rpc("complete_delivery", { p_order: orderId });
  if (error) throw new Error(error.message);
}
async function reset(orderId: string) {
  const { data, error } = await db.rpc("reset_delivery", { p_order: orderId });
  if (error) throw new Error(error.message);
  return data as unknown as boolean;
}
async function delivery(orderId: string) {
  const { data } = await db.from("deliveries").select("*").eq("order_id", orderId).eq("channel", "email").single();
  return data!;
}
async function order(orderId: string) {
  const { data } = await db.from("orders").select("*").eq("id", orderId).single();
  return data!;
}
async function makeDue(orderId: string) {
  await db.from("deliveries").update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() }).eq("order_id", orderId);
}
const secondsAhead = (iso: string) => (new Date(iso).getTime() - Date.now()) / 1000;

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
});

describe("claim_delivery", () => {
  it("claim_delivery creates the row and counts the attempt", async () => {
    const id = await processedOrder();
    expect(await claim(id)).toEqual({ claimed: true, attempt: 1 });
    const row = await delivery(id);
    expect(row).toMatchObject({ channel: "email", status: "PENDING", attempts: 1 });
    expect(secondsAhead(row.next_attempt_at!)).toBeGreaterThan(100);
    expect(secondsAhead(row.next_attempt_at!)).toBeLessThanOrEqual(121);
  });

  it("a second claim before the lease ends is not claimed", async () => {
    const id = await processedOrder();
    await claim(id);
    expect(await claim(id)).toMatchObject({ claimed: false, reason: "not_due" });
    expect((await delivery(id)).attempts).toBe(1);
  });

  it("two simultaneous claims reserve the delivery once", async () => {
    const id = await processedOrder();
    const results = await Promise.all([claim(id), claim(id), claim(id)]);
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    const { count } = await db.from("deliveries").select("*", { count: "exact", head: true }).eq("order_id", id);
    expect(count).toBe(1);
  });

  it("claim_delivery refuses an order without a result", async () => {
    const id = await processedOrder(false);
    expect(await claim(id)).toMatchObject({ claimed: false, reason: "no_result" });
    const { count } = await db.from("deliveries").select("*", { count: "exact", head: true }).eq("order_id", id);
    expect(count).toBe(0);
  });

  it("an expired lease can be claimed again", async () => {
    const id = await processedOrder();
    await claim(id);
    await makeDue(id);
    expect(await claim(id)).toEqual({ claimed: true, attempt: 2 });
  });

  it("claim_delivery refuses a sent delivery", async () => {
    const id = await processedOrder();
    await claim(id);
    await complete(id);
    expect(await claim(id)).toMatchObject({ claimed: false, reason: "already_sent" });
  });
});

describe("complete_delivery and fail_delivery", () => {
  it("complete_delivery marks SENT and the order DELIVERED", async () => {
    const id = await processedOrder();
    await claim(id);
    await complete(id);
    expect(await delivery(id)).toMatchObject({ status: "SENT", next_attempt_at: null, last_error: null });
    expect((await delivery(id)).sent_at).not.toBeNull();
    const row = await order(id);
    expect(row.status).toBe("DELIVERED");
    expect(row.delivered_at).not.toBeNull();
  });

  it("fail_delivery follows the schedule and fails on the fourth attempt", async () => {
    const id = await processedOrder();
    const expected = [60, 300, 900];
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect((await claim(id)).claimed).toBe(true);
      const outcome = await fail(id);
      expect(outcome.state).toBe("retry");
      const seconds = secondsAhead(outcome.next_at!);
      expect(seconds).toBeGreaterThan(expected[attempt - 1] - 5);
      expect(seconds).toBeLessThanOrEqual(expected[attempt - 1] + 1);
      expect((await delivery(id)).status).toBe("PENDING");
      expect((await order(id)).status).toBe("PROCESSING");
      await makeDue(id);
    }
    expect((await claim(id)).attempt).toBe(4);
    expect(await fail(id)).toEqual({ state: "failed" });
  });

  it("fail_delivery with a failing provider ends in FAILED and the order FAILED with DELIVERY_FAILED", async () => {
    const id = await processedOrder();
    for (let attempt = 1; attempt <= 4; attempt++) {
      await claim(id);
      await fail(id, "x".repeat(900));
      if (attempt < 4) await makeDue(id);
    }
    const row = await delivery(id);
    expect(row).toMatchObject({ status: "FAILED", next_attempt_at: null });
    expect(row.last_error!.length).toBeLessThanOrEqual(500);
    expect(await order(id)).toMatchObject({ status: "FAILED", failure_reason: "DELIVERY_FAILED" });
    expect(await claim(id)).toMatchObject({ claimed: false, reason: "failed" });
  });

  it("fail_delivery ignores a delivery that is not pending", async () => {
    const id = await processedOrder();
    expect((await fail(id)).state).toBe("ignored");
    await claim(id);
    await complete(id);
    expect((await fail(id)).state).toBe("ignored");
    expect((await order(id)).status).toBe("DELIVERED");
  });

  it("the retry delays match the constants", () => {
    expect([...DELIVERY_RETRY_DELAYS_SECONDS]).toEqual([60, 300, 900]);
    expect(MAX_DELIVERY_ATTEMPTS).toBe(4);
    expect(DELIVERY_RETRY_DELAYS_SECONDS.length).toBe(MAX_DELIVERY_ATTEMPTS - 1);
  });
});

describe("reset_delivery", () => {
  async function failedDelivery() {
    const id = await processedOrder();
    for (let attempt = 1; attempt <= 4; attempt++) {
      await claim(id);
      await fail(id);
      if (attempt < 4) await makeDue(id);
    }
    return id;
  }

  it("reset_delivery only resets a failed delivery of a paid order with a result", async () => {
    const id = await failedDelivery();
    expect(await reset(id)).toBe(true);
    expect(await delivery(id)).toMatchObject({ status: "PENDING", attempts: 0, next_attempt_at: null, last_error: null });
    expect(await order(id)).toMatchObject({ status: "PROCESSING", failure_reason: null });
    expect(await claim(id)).toEqual({ claimed: true, attempt: 1 });
  });

  it("reset_delivery refuses a healthy or sent delivery", async () => {
    const healthy = await processedOrder();
    await claim(healthy);
    expect(await reset(healthy)).toBe(false);
    const sent = await processedOrder();
    await claim(sent);
    await complete(sent);
    expect(await reset(sent)).toBe(false);
    expect((await order(sent)).status).toBe("DELIVERED");
  });
});
