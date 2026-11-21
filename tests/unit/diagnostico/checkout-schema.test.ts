import { describe, expect, it } from "vitest";
import { checkoutBodySchema } from "@/lib/diagnostico/schemas/checkout";

describe("checkout body schema", () => {
  it("accepts an empty body", () => {
    expect(checkoutBodySchema.safeParse({}).success).toBe(true);
  });

  it("accepts and discards amountCents", () => {
    const result = checkoutBodySchema.safeParse({ amountCents: 1, other: "x" });
    expect(result.success).toBe(true);
    // Only the declared field survives parsing; nothing else reaches the server logic.
    expect(Object.keys(result.success ? result.data : {})).toEqual(["amountCents"]);
  });

  it("rejects a non-numeric amountCents", () => {
    expect(checkoutBodySchema.safeParse({ amountCents: "990" }).success).toBe(false);
  });
});
