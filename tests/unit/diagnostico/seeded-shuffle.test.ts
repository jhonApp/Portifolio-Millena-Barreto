import { describe, expect, it } from "vitest";
import { shuffleWithSeed } from "@/lib/diagnostico/seeded-shuffle";

const ITEMS = ["a", "b", "c", "d"];

describe("shuffleWithSeed", () => {
  it("same seed gives the same order", () => {
    const first = shuffleWithSeed(ITEMS, "attempt-1:question-1");
    for (let i = 0; i < 20; i++) expect(shuffleWithSeed(ITEMS, "attempt-1:question-1")).toEqual(first);
  });

  it("different seeds give different orders for most seeds", () => {
    const orders = new Set<string>();
    for (let i = 0; i < 50; i++) orders.add(shuffleWithSeed(ITEMS, `attempt-${i}`).join(""));
    // 4 items have 24 possible orders: 50 seeds must produce several of them.
    expect(orders.size).toBeGreaterThan(8);
  });

  it("keeps every item exactly once", () => {
    for (let i = 0; i < 30; i++) {
      expect(shuffleWithSeed(ITEMS, `seed-${i}`).slice().sort()).toEqual([...ITEMS].sort());
    }
  });

  it("does not change the input array", () => {
    const input = [...ITEMS];
    shuffleWithSeed(input, "x");
    expect(input).toEqual(ITEMS);
  });
});
