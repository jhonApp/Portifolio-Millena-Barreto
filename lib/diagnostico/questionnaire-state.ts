// Pure helpers of the questionnaire screen. Safe to import in the browser and on the server.

export const TOTAL_QUESTIONS = 15;

// A failed save is retried 3 times (4 requests in total), waiting this long before each retry.
export const RETRY_DELAYS_MS = [500, 1500, 3000] as const;

// Slide-and-fade between questions (PRD RF-04 Experience).
export const TRANSITION_MS = 300;

/**
 * Index of the first question without an answer; when every question is answered, the last index
 * (so the customer lands on the last question with "Concluir" enabled).
 */
export function firstUnansweredIndex(
  questions: readonly { id: string }[],
  answers: Readonly<Record<string, string>>,
): number {
  const index = questions.findIndex((question) => !answers[question.id]);
  return index === -1 ? Math.max(questions.length - 1, 0) : index;
}

/** Width of the progress bar, in percent, for the question at `index` (0-based). */
export function progressPercent(index: number, total: number = TOTAL_QUESTIONS): number {
  return Math.round(((index + 1) / total) * 10000) / 100;
}

/** "Próxima" and "Concluir" need an answer that is already saved on the server. */
export function canAdvance(questionId: string, saved: Readonly<Record<string, string>>): boolean {
  return Boolean(saved[questionId]);
}
