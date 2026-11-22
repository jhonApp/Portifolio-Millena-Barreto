import { describe, expect, it } from "vitest";
import { STYLES, type Style } from "@/lib/diagnostico/constants";
import type { ScoredAnswer } from "@/lib/diagnostico/question-types";
import { DEFAULT_RULES, FIXED_ORDER, ScoringError, scoreAnswers, type ScoringRules } from "@/lib/diagnostico/scoring";

// Rules of questionnaire version 2 (quiz v2 RF-01): 2 points, 1 point, tie-break by points.
const V2: ScoringRules = { firstPoints: 2, secondPoints: 1, lateBasis: "points" };

const [ELEGANTE, TRADICIONAL, ROMANTICO, ESPORTIVO, CRIATIVO, DRAMATICO] = FIXED_ORDER;

// Styles shown at each of the 15 steps of the version 2 structure (PRD RF-02 Capabilities):
// 3 duels (steps 5, 10, 15) of two styles and 12 regular questions of four styles. Each style is
// in exactly 9 steps (8 regular questions plus its one duel).
const DUELS: Record<number, Style[]> = {
  5: [ESPORTIVO, ELEGANTE],
  10: [TRADICIONAL, CRIATIVO],
  15: [ROMANTICO, DRAMATICO],
};
const EXCLUDED_PAIRS = [
  [0, 1], [2, 3], [4, 5], [0, 2], [1, 4], [3, 5], [0, 3], [1, 5], [2, 4], [0, 4], [1, 3], [2, 5],
];
function buildShown(): Style[][] {
  const regular = EXCLUDED_PAIRS.map(([a, b]) => STYLES.filter((_, index) => index !== a && index !== b));
  const shown: Style[][] = [];
  let next = 0;
  for (let step = 1; step <= 15; step++) shown.push(DUELS[step] ?? regular[next++]);
  return shown;
}
const SHOWN = buildShown();
const isDuel = (step: number) => step in DUELS;

// Seeded pseudo-random numbers (mulberry32), so the property tests are reproducible.
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A first choice at every step and the optional second choices given by step number. */
function attempt(firsts: Style[], seconds: Record<number, Style> = {}): ScoredAnswer[] {
  const answers: ScoredAnswer[] = firsts.map((style, index) => ({
    questionPosition: index + 1,
    style,
    weight: 1,
    rank: 1,
  }));
  for (const [step, style] of Object.entries(seconds)) {
    answers.push({ questionPosition: Number(step), style, weight: 1, rank: 2 });
  }
  return answers;
}

const rep = (style: Style, times: number): Style[] => Array.from({ length: times }, () => style);
const total = (points: Record<Style, number>) => Object.values(points).reduce((sum, value) => sum + value, 0);

/** A random valid attempt over the version 2 structure; `second` is the chance of a second choice. */
function randomAttempt(next: () => number, second: number): ScoredAnswer[] {
  const answers: ScoredAnswer[] = [];
  SHOWN.forEach((styles, index) => {
    const step = index + 1;
    const first = styles[Math.floor(next() * styles.length)];
    answers.push({ questionPosition: step, style: first, weight: 1, rank: 1 });
    if (!isDuel(step) && next() < second) {
      const others = styles.filter((style) => style !== first);
      answers.push({ questionPosition: step, style: others[Math.floor(next() * others.length)], weight: 1, rank: 2 });
    }
  });
  return answers;
}

describe("version 2 structure used by these tests", () => {
  it("shows every style in exactly 9 steps and in exactly one duel", () => {
    for (const style of STYLES) {
      expect(SHOWN.filter((styles) => styles.includes(style)), style).toHaveLength(9);
      expect(Object.values(DUELS).filter((styles) => styles.includes(style)), style).toHaveLength(1);
    }
  });
});

describe("two-choice scoring (rules of version 2)", () => {
  it("first choice gives 2 points and second gives 1", () => {
    const firsts = [
      ...rep(ELEGANTE, 5), ...rep(TRADICIONAL, 5), ...rep(ROMANTICO, 2), ESPORTIVO, CRIATIVO, DRAMATICO,
    ];
    const result = scoreAnswers(attempt(firsts, { 1: TRADICIONAL, 11: CRIATIVO }), V2);
    expect(result.points).toEqual({
      elegante: 10,
      tradicional: 11,
      romantico: 4,
      esportivo_natural: 2,
      criativo: 3,
      dramatico: 2,
    });
    expect(result.predominant).toBe(TRADICIONAL);
    expect(result.secondary).toBe(ELEGANTE);
  });

  it("an attempt of 12 two-choice questions and 3 duels totals between 30 and 42", () => {
    const next = random(7);
    const onlyFirst = scoreAnswers(randomAttempt(next, 0), V2);
    expect(total(onlyFirst.points)).toBe(30);
    const everySecond = scoreAnswers(randomAttempt(next, 1), V2);
    expect(total(everySecond.points)).toBe(42);
    for (let run = 0; run < 500; run++) {
      const sum = total(scoreAnswers(randomAttempt(next, 0.5), V2).points);
      expect(sum).toBeGreaterThanOrEqual(30);
      expect(sum).toBeLessThanOrEqual(42);
    }
  });

  it("an attempt with only first choices ranks like the same answers scored as single choice", () => {
    const next = random(11);
    for (let run = 0; run < 300; run++) {
      const answers = randomAttempt(next, 0);
      const single = scoreAnswers(answers);
      const two = scoreAnswers(answers, V2);
      expect(two.predominant).toBe(single.predominant);
      expect(two.secondary).toBe(single.secondary);
      expect(two.tieBreaks).toEqual(single.tieBreaks);
      for (const style of STYLES) expect(two.points[style]).toBe(single.points[style] * 2);
    }
  });

  // Y = tradicional and X = romantico tie at 14 points. In steps 11 to 15 Y has 2 first choices
  // (4 points, 2 alternatives) and X has 3 second choices (3 points, 3 alternatives).
  const tied = () =>
    attempt(
      [
        ...rep(TRADICIONAL, 5), // steps 1-5
        ...rep(ROMANTICO, 5), // steps 6-10
        ESPORTIVO, ELEGANTE, CRIATIVO, // steps 11-13 (fillers)
        TRADICIONAL, TRADICIONAL, // steps 14-15
      ],
      { 1: ROMANTICO, 11: ROMANTICO, 12: ROMANTICO, 13: ROMANTICO },
    );

  it("a tie is broken by points in steps 11 to 15", () => {
    const result = scoreAnswers(tied(), V2);
    expect(result.points.tradicional).toBe(14);
    expect(result.points.romantico).toBe(14);
    expect(result.predominant).toBe(TRADICIONAL);
    expect(result.secondary).toBe(ROMANTICO);
    expect(result.tieBreaks.predominant).toBe("late_answers");
  });

  it("the answers basis keeps counting chosen alternatives", () => {
    const result = scoreAnswers(tied(), { ...V2, lateBasis: "answers" });
    expect(result.predominant).toBe(ROMANTICO);
    expect(result.tieBreaks.predominant).toBe("late_answers");
  });

  it("a tie still equal falls to the fixed order", () => {
    // Elegante and tradicional tie at 12 points with 2 points each in steps 11 to 15.
    const firsts = [
      ...rep(ELEGANTE, 5), // 1-5
      ...rep(TRADICIONAL, 5), // 6-10
      ELEGANTE, TRADICIONAL, // 11-12
      ESPORTIVO, CRIATIVO, DRAMATICO, // 13-15
    ];
    const result = scoreAnswers(attempt(firsts), V2);
    expect(result.points.elegante).toBe(12);
    expect(result.points.tradicional).toBe(12);
    expect(result.predominant).toBe(ELEGANTE);
    expect(result.secondary).toBe(TRADICIONAL);
    expect(result.tieBreaks).toEqual({ predominant: "fixed_order", secondary: "none" });
  });

  it("the secondary style always has at least 2 points", () => {
    const next = random(2026);
    for (let run = 0; run < 5000; run++) {
      const result = scoreAnswers(randomAttempt(next, next()), V2);
      expect(result.points[result.secondary], `run ${run}`).toBeGreaterThanOrEqual(2);
    }
    // The 30 ordered pairs (leader, runner-up): the leader takes every first choice it can, then
    // the runner-up takes the first choices it can; the remaining steps go to the first style shown.
    for (const leader of STYLES) {
      for (const runnerUp of STYLES) {
        if (leader === runnerUp) continue;
        const answers: ScoredAnswer[] = SHOWN.map((styles, index) => ({
          questionPosition: index + 1,
          style: styles.includes(leader) ? leader : styles.includes(runnerUp) ? runnerUp : styles[0],
          weight: 1,
          rank: 1 as const,
        }));
        const result = scoreAnswers(answers, V2);
        expect(result.points[result.secondary], `${leader} over ${runnerUp}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("validation of two-choice answers", () => {
  const base = () => attempt(Array.from({ length: 15 }, (_, index) => STYLES[index % STYLES.length]));

  it("rejects a second choice when the rules give it no points", () => {
    expect(() => scoreAnswers([...base(), { questionPosition: 1, style: DRAMATICO, weight: 1, rank: 2 }])).toThrow(
      ScoringError,
    );
  });

  it("rejects a second choice of the same style as the first", () => {
    const answers = base();
    expect(() => scoreAnswers([...answers, { ...answers[0], rank: 2 }], V2)).toThrow(ScoringError);
  });

  it("rejects a second choice without a first choice, and a repeated rank", () => {
    const withoutFirst = base().filter((answer) => answer.questionPosition !== 3);
    expect(() => scoreAnswers([...withoutFirst, { questionPosition: 3, style: ELEGANTE, weight: 1, rank: 2 }], V2)).toThrow(
      ScoringError,
    );
    const answers = base();
    expect(() => scoreAnswers([...answers, { ...answers[0] }], V2)).toThrow(ScoringError);
  });

  it("counts questions, not choices: 14 answered questions are rejected even with second choices", () => {
    const answers = base().filter((answer) => answer.questionPosition !== 15);
    expect(() => scoreAnswers([...answers, { questionPosition: 1, style: DRAMATICO, weight: 1, rank: 2 }], V2)).toThrow(
      /Expected 15 answers, received 14/,
    );
  });
});

// The scoring engine before quiz v2: one choice per question, weights added, tie-break by the
// number of chosen alternatives in steps 11 to 15, then the fixed order.
function referenceVersion1(answers: ScoredAnswer[]) {
  const points = Object.fromEntries(STYLES.map((style) => [style, 0])) as Record<Style, number>;
  const late = { ...points };
  for (const answer of answers) {
    points[answer.style] += answer.weight;
    if (answer.questionPosition >= 11) late[answer.style] += 1;
  }
  const choose = (excluded: Style | null) => {
    const eligible = STYLES.filter((style) => style !== excluded);
    const top = Math.max(...eligible.map((style) => points[style]));
    let tied = eligible.filter((style) => points[style] === top);
    const bestLate = Math.max(...tied.map((style) => late[style]));
    tied = tied.filter((style) => late[style] === bestLate);
    tied.sort((a, b) => FIXED_ORDER.indexOf(a) - FIXED_ORDER.indexOf(b));
    return tied[0];
  };
  const predominant = choose(null);
  return { points, predominant, secondary: choose(predominant) };
}

describe("default rules (version 1)", () => {
  it("default rules give the same result as the version 1 engine for 1000 random attempts", () => {
    const next = random(99);
    for (let run = 0; run < 1000; run++) {
      const answers: ScoredAnswer[] = Array.from({ length: 15 }, (_, index) => ({
        questionPosition: index + 1,
        style: STYLES[Math.floor(next() * STYLES.length)],
        weight: 1 + Math.floor(next() * 3),
      }));
      const expected = referenceVersion1(answers);
      const result = scoreAnswers(answers);
      expect(result.points, `run ${run}`).toEqual(expected.points);
      expect(result.predominant, `run ${run}`).toBe(expected.predominant);
      expect(result.secondary, `run ${run}`).toBe(expected.secondary);
      expect(scoreAnswers(answers, DEFAULT_RULES)).toEqual(result);
    }
  });
});
