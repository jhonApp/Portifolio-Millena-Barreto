import { describe, expect, it } from "vitest";
import {
  DELETION_CONFIRMS_PER_IP_PER_HOUR,
  DELETION_LINK_HOURS,
  DELETION_REQUESTS_PER_EMAIL_PER_HOUR,
  DELETION_REQUESTS_PER_IP_PER_HOUR,
  ORDER_STATUSES,
  PRICE_CENTS,
  RETENTION_BATCH,
  RETENTION_PAID_MONTHS,
  RETENTION_UNPAID_DAYS,
  STYLES,
} from "@/lib/diagnostico/constants";

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

  it("the retention and deletion constants", () => {
    expect(RETENTION_UNPAID_DAYS).toBe(7);
    expect(RETENTION_PAID_MONTHS).toBe(12);
    expect(DELETION_LINK_HOURS).toBe(24);
    expect(DELETION_REQUESTS_PER_EMAIL_PER_HOUR).toBe(3);
    expect(DELETION_REQUESTS_PER_IP_PER_HOUR).toBe(10);
    expect(DELETION_CONFIRMS_PER_IP_PER_HOUR).toBe(20);
    expect(RETENTION_BATCH).toEqual({ requests: 20, notices: 20, attempts: 100, customers: 50 });
  });
});
