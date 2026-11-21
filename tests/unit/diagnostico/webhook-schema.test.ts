import { describe, expect, it } from "vitest";
import { webhookEventSchema } from "@/lib/diagnostico/schemas/webhook";

const paid = {
  id: "log_1",
  event: "transparent.completed",
  apiVersion: 2,
  devMode: false,
  data: {
    transparent: { id: "pix_char_1", externalId: null, amount: 990, status: "PAID", platformFee: 80, metadata: { orderId: "x" } },
    customer: { id: "cust_1", taxId: "529.***.247-**" },
  },
};

describe("webhook event schema", () => {
  it("accepts a transparent.completed event", () => {
    const result = webhookEventSchema.safeParse(paid);
    expect(result.success).toBe(true);
    expect(result.success && result.data.data?.transparent?.id).toBe("pix_char_1");
  });

  it("ignores unknown fields", () => {
    const result = webhookEventSchema.safeParse({ ...paid, somethingNew: { a: 1 } });
    expect(result.success).toBe(true);
    expect(result.success && "somethingNew" in result.data).toBe(false);
  });

  it("rejects an event without a charge id", () => {
    const broken = { ...paid, data: { transparent: { amount: 990, status: "PAID" } } };
    expect(webhookEventSchema.safeParse(broken).success).toBe(false);
  });

  it("accepts other event types without the transparent block", () => {
    expect(webhookEventSchema.safeParse({ id: "log_2", event: "checkout.completed", data: {} }).success).toBe(true);
  });
});
