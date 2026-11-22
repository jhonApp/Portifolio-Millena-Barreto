// Pure helpers of the questionnaire screen. Safe to import in the browser and on the server.

export const TOTAL_QUESTIONS = 15;

// A failed save is retried 3 times (4 requests in total), waiting this long before each retry.
export const RETRY_DELAYS_MS = [500, 1500, 3000] as const;

// Slide-and-fade between questions (PRD RF-04 Experience).
export const TRANSITION_MS = 300;

/** The choices of one question: the first one and the optional second one (alternative ids). */
export type SavedChoice = { first: string; second: string | null };

/**
 * The choices after the customer taps `tapped` (an alternative id) on a question that allows
 * `maxChoices`. The first tap selects the first choice; on a two-choice question another card
 * becomes (or replaces) the second choice; tapping the second choice removes it; tapping the first
 * choice while a second exists promotes the second. Tapping the only selected card keeps it (a
 * question never goes back to "unanswered", see the spec of RF-01). With one choice allowed, the
 * last tapped card is the answer.
 */
export function nextChoices(current: SavedChoice | undefined, tapped: string, maxChoices: 1 | 2): SavedChoice {
  if (!current || maxChoices === 1) return { first: tapped, second: null };
  if (tapped === current.first) {
    return current.second ? { first: current.second, second: null } : current;
  }
  if (tapped === current.second) return { first: current.first, second: null };
  return { first: current.first, second: tapped };
}

/** True when two choice states are the same. */
export function sameChoices(a: SavedChoice | undefined, b: SavedChoice | undefined): boolean {
  return a?.first === b?.first && (a?.second ?? null) === (b?.second ?? null);
}

/**
 * Index of the first question without an answer; when every question is answered, the last index
 * (so the customer lands on the last question with "Concluir" enabled).
 */
export function firstUnansweredIndex(
  questions: readonly { id: string }[],
  answers: Readonly<Record<string, unknown>>,
): number {
  const index = questions.findIndex((question) => !answers[question.id]);
  return index === -1 ? Math.max(questions.length - 1, 0) : index;
}

/** Width of the progress bar, in percent, for the question at `index` (0-based). */
export function progressPercent(index: number, total: number = TOTAL_QUESTIONS): number {
  return Math.round(((index + 1) / total) * 10000) / 100;
}

/**
 * "Próxima" and "Concluir" need the first choice already saved on the server, with or without a
 * second one. `saved` holds one entry per saved question (a choice object or an alternative id).
 */
export function canAdvance(questionId: string, saved: Readonly<Record<string, unknown>>): boolean {
  return Boolean(saved[questionId]);
}
