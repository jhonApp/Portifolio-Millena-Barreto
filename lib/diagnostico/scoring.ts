import { STYLES, type Style } from "./constants";
import type { ScoredAnswer } from "./question-types";

// Pure scoring engine: no database, no network, no clock, no randomness.

export type TieBreakLevel = "none" | "late_answers" | "fixed_order";

export type ScoringResult = {
  points: Record<Style, number>;
  predominant: Style;
  secondary: Style;
  tieBreaks: { predominant: TieBreakLevel; secondary: TieBreakLevel };
};

export class ScoringError extends Error {
  code = "INVALID_ANSWERS" as const;

  constructor(message: string) {
    super(message);
    this.name = "ScoringError";
  }
}

// Last resort of the tie-break (inferred, see spec Section 3).
export const FIXED_ORDER: readonly Style[] = [
  "elegante",
  "tradicional",
  "romantico",
  "esportivo_natural",
  "criativo",
  "dramatico",
];

export const EXPECTED_ANSWERS = 15;
// Questions whose answers break a tie first (PRD RF-03: questions 11 to 15).
export const LATE_FROM = 11;
export const LATE_TO = 15;

function emptyCounts(): Record<Style, number> {
  return Object.fromEntries(STYLES.map((style) => [style, 0])) as Record<Style, number>;
}

function assertValid(answers: readonly ScoredAnswer[]): void {
  if (answers.length !== EXPECTED_ANSWERS) {
    throw new ScoringError(`Expected ${EXPECTED_ANSWERS} answers, received ${answers.length}.`);
  }
  const positions = new Set<number>();
  for (const answer of answers) {
    if (!Number.isInteger(answer.questionPosition) || answer.questionPosition < 1 || answer.questionPosition > EXPECTED_ANSWERS) {
      throw new ScoringError(`Invalid question position: ${answer.questionPosition}.`);
    }
    if (positions.has(answer.questionPosition)) {
      throw new ScoringError(`Repeated question position: ${answer.questionPosition}.`);
    }
    positions.add(answer.questionPosition);
    if (!STYLES.includes(answer.style)) {
      throw new ScoringError(`Unknown style: ${String(answer.style)}.`);
    }
    if (!Number.isInteger(answer.weight) || answer.weight < 1 || answer.weight > 3) {
      throw new ScoringError(`Weight out of range: ${answer.weight}.`);
    }
  }
}

function pick(
  points: Record<Style, number>,
  late: Record<Style, number>,
  excluded: Style | null,
): { style: Style; level: TieBreakLevel } {
  const eligible = STYLES.filter((style) => style !== excluded);
  const top = Math.max(...eligible.map((style) => points[style]));
  let tied = eligible.filter((style) => points[style] === top);
  if (tied.length === 1) return { style: tied[0], level: "none" };

  // Level 1: more chosen alternatives (a count of answers, not of weights) in questions 11 to 15.
  const bestLate = Math.max(...tied.map((style) => late[style]));
  tied = tied.filter((style) => late[style] === bestLate);
  if (tied.length === 1) return { style: tied[0], level: "late_answers" };

  // Level 2: the fixed order.
  tied.sort((a, b) => FIXED_ORDER.indexOf(a) - FIXED_ORDER.indexOf(b));
  return { style: tied[0], level: "fixed_order" };
}

export function scoreAnswers(answers: readonly ScoredAnswer[]): ScoringResult {
  assertValid(answers);

  const points = emptyCounts();
  const late = emptyCounts();
  for (const answer of answers) {
    points[answer.style] += answer.weight;
    if (answer.questionPosition >= LATE_FROM && answer.questionPosition <= LATE_TO) {
      late[answer.style] += 1;
    }
  }

  const first = pick(points, late, null);
  const second = pick(points, late, first.style);
  return {
    points,
    predominant: first.style,
    secondary: second.style,
    tieBreaks: { predominant: first.level, secondary: second.level },
  };
}
