import { describe, expect, it } from "vitest";
import {
  RETRY_DELAYS_MS,
  TOTAL_QUESTIONS,
  TRANSITION_MS,
  canAdvance,
  firstUnansweredIndex,
  progressPercent,
} from "@/lib/diagnostico/questionnaire-state";

const questions = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => ({ id: `q${i + 1}` }));

describe("questionnaire state helpers", () => {
  it("canAdvance is false until the question has a saved answer", () => {
    expect(canAdvance("q1", {})).toBe(false);
    expect(canAdvance("q1", { q2: "a" })).toBe(false);
    expect(canAdvance("q1", { q1: "a" })).toBe(true);
  });

  it("progressPercent for question 1 of 15", () => {
    expect(progressPercent(0, 15)).toBeCloseTo(6.67, 2);
    expect(progressPercent(14, 15)).toBe(100);
  });

  it("progressPercent grows by one fifteenth per question", () => {
    for (let i = 1; i < 15; i++) {
      expect(progressPercent(i, 15) - progressPercent(i - 1, 15)).toBeCloseTo(100 / 15, 1);
    }
  });

  it("transition is 300 ms", () => {
    expect(TRANSITION_MS).toBe(300);
  });

  it("retry delays are 500 1500 and 3000 ms", () => {
    expect([...RETRY_DELAYS_MS]).toEqual([500, 1500, 3000]);
    // 3 retries after the first attempt: 4 requests in total.
    expect(RETRY_DELAYS_MS).toHaveLength(3);
  });

  it("firstUnansweredIndex returns the first question without an answer", () => {
    expect(firstUnansweredIndex(questions, {})).toBe(0);
    expect(firstUnansweredIndex(questions, { q1: "a", q2: "a", q4: "a" })).toBe(2);
    const sevenAnswered = Object.fromEntries(questions.slice(0, 7).map((q) => [q.id, "a"]));
    expect(firstUnansweredIndex(questions, sevenAnswered)).toBe(7);
  });

  it("firstUnansweredIndex returns the last index when all are answered", () => {
    const all = Object.fromEntries(questions.map((q) => [q.id, "a"]));
    expect(firstUnansweredIndex(questions, all)).toBe(14);
    expect(firstUnansweredIndex([], {})).toBe(0);
  });
});
