import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAPTER_ADVANCE_LABEL,
  CHAPTER_ADVANCE_MS,
  HANDOFF_FILL_MS,
  HANDOFF_FILL_TO,
  HANDOFF_TIMEOUT_MS,
  handoffView,
  scheduleAdvance,
} from "@/lib/diagnostico/loading";

describe("the loading module", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("CHAPTER_ADVANCE_MS is 2000", () => {
    expect(CHAPTER_ADVANCE_MS).toBe(2000);
    expect(CHAPTER_ADVANCE_LABEL).toBe("Preparando a próxima etapa…");
  });

  it("scheduleAdvance calls back once after 2000 ms and not before", () => {
    const callback = vi.fn();
    scheduleAdvance(CHAPTER_ADVANCE_MS, callback);
    vi.advanceTimersByTime(1999);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("scheduleAdvance cancel before the time prevents the callback", () => {
    const callback = vi.fn();
    const cancel = scheduleAdvance(CHAPTER_ADVANCE_MS, callback);
    vi.advanceTimersByTime(1000);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("scheduleAdvance cancel after the callback is harmless", () => {
    const callback = vi.fn();
    const cancel = scheduleAdvance(CHAPTER_ADVANCE_MS, callback);
    vi.advanceTimersByTime(2000);
    expect(() => {
      cancel();
      cancel();
    }).not.toThrow();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("the hand-off constants are 8000, 0.9 and 15000", () => {
    expect(HANDOFF_FILL_MS).toBe(8000);
    expect(HANDOFF_FILL_TO).toBe(0.9);
    expect(HANDOFF_TIMEOUT_MS).toBe(15000);
  });

  it("handoffView is idle when it is not pending", () => {
    expect(handoffView(false, false)).toBe("idle");
    expect(handoffView(false, true)).toBe("idle");
  });

  it("handoffView is loading while pending and not timed out", () => {
    expect(handoffView(true, false)).toBe("loading");
  });

  it("handoffView is failed once it timed out while pending", () => {
    expect(handoffView(true, true)).toBe("failed");
  });
});
