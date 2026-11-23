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

// How a questionnaire version scores its answers (quiz v2 RF-01). The defaults are version 1:
// one choice worth 1 point, and the tie-break counts the chosen alternatives.
export type ScoringRules = {
  firstPoints: number;
  secondPoints: number;
  /** What the tie-break in questions 11 to 15 compares: chosen alternatives or points. */
  lateBasis: "answers" | "points";
};

export const DEFAULT_RULES: ScoringRules = { firstPoints: 1, secondPoints: 0, lateBasis: "answers" };

export const EXPECTED_ANSWERS = 15;
// Questions whose answers break a tie first (PRD RF-03: questions 11 to 15).
export const LATE_FROM = 11;
export const LATE_TO = 15;

function emptyCounts(): Record<Style, number> {
  return Object.fromEntries(STYLES.map((style) => [style, 0])) as Record<Style, number>;
}

function assertValid(answers: readonly ScoredAnswer[], rules: ScoringRules): void {
  // One question has one first choice and at most one second choice.
  const byPosition = new Map<number, { first?: ScoredAnswer; second?: ScoredAnswer }>();
  for (const answer of answers) {
    if (!Number.isInteger(answer.questionPosition) || answer.questionPosition < 1 || answer.questionPosition > EXPECTED_ANSWERS) {
      throw new ScoringError(`Invalid question position: ${answer.questionPosition}.`);
    }
    if (!STYLES.includes(answer.style)) {
      throw new ScoringError(`Unknown style: ${String(answer.style)}.`);
    }
    if (!Number.isInteger(answer.weight) || answer.weight < 1 || answer.weight > 3) {
      throw new ScoringError(`Weight out of range: ${answer.weight}.`);
    }
    const rank = answer.rank ?? 1;
    if (rank !== 1 && rank !== 2) {
      throw new ScoringError(`Invalid choice rank: ${String(rank)}.`);
    }
    const slot = byPosition.get(answer.questionPosition) ?? {};
    const key = rank === 1 ? "first" : "second";
    if (slot[key]) {
      throw new ScoringError(`Repeated question position: ${answer.questionPosition}.`);
    }
    slot[key] = answer;
    byPosition.set(answer.questionPosition, slot);
  }

  if (byPosition.size !== EXPECTED_ANSWERS) {
    throw new ScoringError(`Expected ${EXPECTED_ANSWERS} answers, received ${byPosition.size}.`);
  }
  for (const [position, slot] of Array.from(byPosition.entries())) {
    if (!slot.first) {
      throw new ScoringError(`Question ${position} has a second choice but no first choice.`);
    }
    if (slot.second) {
      if (rules.secondPoints <= 0) {
        throw new ScoringError(`Question ${position} has a second choice, which these rules do not allow.`);
      }
      if (slot.second.style === slot.first.style) {
        throw new ScoringError(`Question ${position} has two choices of the same style.`);
      }
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

  // Level 1: the higher late value in questions 11 to 15: chosen alternatives when the rules count
  // answers (version 1), the sum of points when they count points (version 2).
  const bestLate = Math.max(...tied.map((style) => late[style]));
  tied = tied.filter((style) => late[style] === bestLate);
  if (tied.length === 1) return { style: tied[0], level: "late_answers" };

  // Level 2: the fixed order.
  tied.sort((a, b) => FIXED_ORDER.indexOf(a) - FIXED_ORDER.indexOf(b));
  return { style: tied[0], level: "fixed_order" };
}

export function scoreAnswers(
  answers: readonly ScoredAnswer[],
  rules: ScoringRules = DEFAULT_RULES,
): ScoringResult {
  assertValid(answers, rules);

  const points = emptyCounts();
  const late = emptyCounts();
  for (const answer of answers) {
    const choicePoints = (answer.rank ?? 1) === 1 ? rules.firstPoints : rules.secondPoints;
    const earned = choicePoints * answer.weight;
    points[answer.style] += earned;
    if (answer.questionPosition >= LATE_FROM && answer.questionPosition <= LATE_TO) {
      late[answer.style] += rules.lateBasis === "points" ? earned : 1;
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
