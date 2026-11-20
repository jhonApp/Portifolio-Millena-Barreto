import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, PRICE_CENTS, STYLES } from "@/lib/diagnostico/constants";

describe("shared constants", () => {
  it("has exactly six styles and no sexy", () => {
    expect(STYLES).toHaveLength(6);
    expect(STYLES.some((s) => s.includes("sexy"))).toBe(false);
    expect(new Set(STYLES).size).toBe(6);
  });

  it("order statuses are the five defined", () => {
    expect([...ORDER_STATUSES]).toEqual([
      "PENDING",
      "APPROVED",
      "PROCESSING",
      "DELIVERED",
      "FAILED",
    ]);
  });

  it("price is 990 cents", () => {
    expect(PRICE_CENTS).toBe(990);
  });
});
