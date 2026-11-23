import { describe, expect, it } from "vitest";
import {
  RETRY_DELAYS_MS,
  TOTAL_QUESTIONS,
  TRANSITION_MS,
  canAdvance,
  chapterToShow,
  earnedChapters,
  firstUnansweredIndex,
  hasChapters,
  segmentStates,
  nextChoices,
  progressPercent,
  sameChoices,
  type SavedChoice,
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

describe("nextChoices", () => {
  const A = "a";
  const B = "b";
  const C = "c";
  const first = (id: string): SavedChoice => ({ first: id, second: null });

  it("nextChoices: a first tap selects the first choice", () => {
    expect(nextChoices(undefined, A, 2)).toEqual({ first: A, second: null });
  });

  it("nextChoices: a tap on a different card sets the second choice", () => {
    expect(nextChoices(first(A), B, 2)).toEqual({ first: A, second: B });
  });

  it("nextChoices: tapping the second choice clears it", () => {
    expect(nextChoices({ first: A, second: B }, B, 2)).toEqual(first(A));
  });

  it("nextChoices: a third card replaces the second choice", () => {
    expect(nextChoices({ first: A, second: B }, C, 2)).toEqual({ first: A, second: C });
  });

  it("nextChoices: tapping the first choice while a second exists promotes the second", () => {
    expect(nextChoices({ first: A, second: B }, A, 2)).toEqual(first(B));
  });

  it("nextChoices: tapping the only selected card keeps it selected", () => {
    const current = first(A);
    expect(nextChoices(current, A, 2)).toEqual(first(A));
    expect(sameChoices(current, nextChoices(current, A, 2))).toBe(true);
  });

  it("nextChoices: a single-choice question takes the last tapped card and never a second", () => {
    expect(nextChoices(undefined, A, 1)).toEqual(first(A));
    expect(nextChoices(first(A), B, 1)).toEqual(first(B));
  });

  it("sameChoices compares the first and the second choice", () => {
    expect(sameChoices(undefined, undefined)).toBe(true);
    expect(sameChoices(first(A), undefined)).toBe(false);
    expect(sameChoices({ first: A, second: B }, first(A))).toBe(false);
    expect(sameChoices({ first: A, second: B }, { first: A, second: B })).toBe(true);
  });

  it("canAdvance is enabled by a saved first choice, with or without a second", () => {
    expect(canAdvance("q1", { q1: first(A) })).toBe(true);
    expect(canAdvance("q1", { q1: { first: A, second: B } })).toBe(true);
    expect(canAdvance("q1", {})).toBe(false);
  });

  it("firstUnansweredIndex works on saved choices", () => {
    expect(firstUnansweredIndex(questions, { q1: first(A), q2: { first: A, second: B } })).toBe(2);
  });
});

// RF-04: chapters, badges and look progress.
const steps = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => ({ id: `q${i + 1}`, chapter: Math.floor(i / 5) + 1 }));
const savedUpTo = (count: number) => Object.fromEntries(steps.slice(0, count).map((step) => [step.id, { first: "a", second: null }]));

describe("chapter helpers", () => {
  it("hasChapters is true only when every step has a chapter", () => {
    expect(hasChapters(steps)).toBe(true);
    expect(hasChapters(steps.map((step) => ({ ...step, chapter: null })))).toBe(false);
    expect(hasChapters([...steps.slice(0, 14), { id: "x", chapter: null }])).toBe(false);
    expect(hasChapters([])).toBe(false);
  });

  it("segmentStates marks the saved steps as answered", () => {
    const segments = segmentStates(steps, savedUpTo(7), 7);
    expect(segments).toHaveLength(15);
    expect(segments.filter((segment) => segment.filled)).toHaveLength(7);
    expect(segments.filter((segment) => segment.state === "answered")).toHaveLength(7);
    expect(segments[7]).toMatchObject({ current: true, filled: false, state: "current" });
    expect(segments[8].state).toBe("pending");
    expect(segments.map((segment) => segment.chapter)).toEqual(steps.map((step) => step.chapter));
  });

  it("going back keeps the later segments filled", () => {
    const segments = segmentStates(steps, savedUpTo(8), 4);
    expect(segments.filter((segment) => segment.filled)).toHaveLength(8);
    expect(segments[4]).toMatchObject({ current: true, filled: true, state: "current" });
    expect(segments[7].state).toBe("answered");
  });

  it("earnedChapters counts only chapters with all 5 steps saved", () => {
    expect(earnedChapters(steps, savedUpTo(4))).toEqual([]);
    expect(earnedChapters(steps, savedUpTo(5))).toEqual([1]);
    expect(earnedChapters(steps, savedUpTo(9))).toEqual([1]);
    expect(earnedChapters(steps, savedUpTo(10))).toEqual([1, 2]);
    expect(earnedChapters(steps, savedUpTo(15))).toEqual([1, 2, 3]);
    expect(earnedChapters(steps.map((step) => ({ ...step, chapter: null })), savedUpTo(15))).toEqual([]);
  });

  it("earnedChapters does not depend on the current step", () => {
    const saved = savedUpTo(10);
    // The step shown is not an input: the result is the same wherever the customer is.
    for (let current = 0; current < 15; current++) {
      expect(earnedChapters(steps, saved)).toEqual([1, 2]);
      expect(segmentStates(steps, saved, current).filter((segment) => segment.filled)).toHaveLength(10);
    }
    // A chapter with an unanswered step in the middle is not earned.
    const gap = { ...savedUpTo(5) } as Record<string, unknown>;
    delete gap.q3;
    expect(earnedChapters(steps, gap)).toEqual([]);
  });

  it("chapterToShow returns the chapter when advancing from its last step for the first time", () => {
    expect(chapterToShow(steps, savedUpTo(5), 4, new Set())).toBe(1);
    expect(chapterToShow(steps, savedUpTo(10), 9, new Set([1]))).toBe(2);
    // Not the last step of a chapter.
    expect(chapterToShow(steps, savedUpTo(4), 3, new Set())).toBeNull();
    expect(chapterToShow(steps, savedUpTo(5), 0, new Set())).toBeNull();
  });

  it("a chapter screen is never due while the chapter is not completely saved", () => {
    const gap = { ...savedUpTo(5) } as Record<string, unknown>;
    delete gap.q5;
    expect(chapterToShow(steps, gap, 4, new Set())).toBeNull();
  });

  it("a chapter screen already shown in this visit is not shown again", () => {
    expect(chapterToShow(steps, savedUpTo(5), 4, new Set([1]))).toBeNull();
  });

  it("going back and advancing again does not repeat the chapter screen", () => {
    const seen = new Set<number>();
    const first = chapterToShow(steps, savedUpTo(5), 4, seen);
    expect(first).toBe(1);
    seen.add(first!);
    // The customer goes back to step 5 and taps "Próxima" again.
    expect(chapterToShow(steps, savedUpTo(5), 4, seen)).toBeNull();
  });

  it("the last step shows the chapter 3 screen before completing", () => {
    expect(chapterToShow(steps, savedUpTo(15), 14, new Set([1, 2]))).toBe(3);
    // Once it was shown, the next tap completes (no screen is due).
    expect(chapterToShow(steps, savedUpTo(15), 14, new Set([1, 2, 3]))).toBeNull();
  });

  it("a set without chapters never shows a chapter screen", () => {
    const plain = steps.map((step) => ({ ...step, chapter: null }));
    expect(chapterToShow(plain, savedUpTo(15), 4, new Set())).toBeNull();
    expect(chapterToShow(plain, savedUpTo(15), 14, new Set())).toBeNull();
  });
});
