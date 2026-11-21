import { describe, expect, it } from "vitest";
import {
  GENERATION_RETRY_DELAYS_SECONDS,
  MAX_GENERATION_ATTEMPTS,
  STYLES,
  STYLE_LABELS,
} from "@/lib/diagnostico/constants";

describe("generation constants", () => {
  it("the retry delays are 30 seconds 2 minutes and 10 minutes", () => {
    expect([...GENERATION_RETRY_DELAYS_SECONDS]).toEqual([30, 120, 600]);
  });

  it("the attempt limit is 4", () => {
    expect(MAX_GENERATION_ATTEMPTS).toBe(4);
    expect(GENERATION_RETRY_DELAYS_SECONDS.length).toBe(MAX_GENERATION_ATTEMPTS - 1);
  });

  it("every style has a label", () => {
    for (const style of STYLES) expect(STYLE_LABELS[style].length).toBeGreaterThan(2);
    expect(Object.keys(STYLE_LABELS).sort()).toEqual([...STYLES].sort());
  });
});
