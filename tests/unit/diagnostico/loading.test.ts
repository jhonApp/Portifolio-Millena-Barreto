import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAPTER_ADVANCE_LABEL, CHAPTER_ADVANCE_MS, scheduleAdvance } from "@/lib/diagnostico/loading";

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
});
