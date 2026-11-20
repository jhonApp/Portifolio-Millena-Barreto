import { afterAll, describe, expect, it } from "vitest";
import { OrderNotApprovedError, assertOrderApproved } from "@/lib/diagnostico/order-guard";
import { adminClient, createAttempt, createCustomer, createOrder, validContent, validPoints } from "./helpers";

const db = adminClient();
const customerIds: string[] = [];

async function orderWith(status: string) {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  const attempt = await createAttempt(db, customer.id);
  return createOrder(db, attempt.id, status);
}

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
});

describe("hard guard: nothing is created for an unpaid order", () => {
  it("assertOrderApproved refuses PENDING and FAILED orders", async () => {
    for (const status of ["PENDING", "FAILED"]) {
      const order = await orderWith(status);
      await expect(assertOrderApproved(db, order.id)).rejects.toBeInstanceOf(OrderNotApprovedError);
    }
  });

  it("assertOrderApproved refuses an order that does not exist", async () => {
    await expect(assertOrderApproved(db, "00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({
      status: null,
    });
  });

  it("assertOrderApproved accepts APPROVED PROCESSING and DELIVERED", async () => {
    for (const status of ["APPROVED", "PROCESSING", "DELIVERED"]) {
      const order = await orderWith(status);
      await expect(assertOrderApproved(db, order.id)).resolves.toBeUndefined();
    }
  });

  it("a result cannot be inserted for a PENDING order", async () => {
    const order = await orderWith("PENDING");
    const { data: version } = await db.from("questionnaire_versions").select("id").eq("status", "published").single();
    const { error } = await db.from("results").insert({
      order_id: order.id,
      version_id: version!.id,
      points: validPoints,
      predominant_style: "elegante",
      secondary_style: "romantico",
      content: validContent,
    });
    expect(error?.message).toContain("order must be APPROVED");
  });

  it("a delivery cannot be inserted for a FAILED order", async () => {
    const order = await orderWith("FAILED");
    const { error } = await db.from("deliveries").insert({ order_id: order.id, channel: "email" });
    expect(error?.message).toContain("order must be APPROVED");
  });

  it("a delivery can be inserted for an APPROVED order", async () => {
    const order = await orderWith("APPROVED");
    const { error } = await db.from("deliveries").insert({ order_id: order.id, channel: "email" });
    expect(error).toBeNull();
  });
});
