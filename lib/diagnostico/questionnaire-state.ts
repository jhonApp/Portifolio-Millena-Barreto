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

// Chapters, badges and look progress (RF-04). Everything is derived from the chapter of each step
// (RF-02) and from the saved answers (RF-01); nothing is stored.

/** A step of the public question set, as far as the chapter logic needs it. */
export type ChapterStep = { id: string; chapter: number | null };

/** A question id is saved when it has a key in `saved` (a choice object or an alternative id). */
export type SavedIds = Readonly<Record<string, unknown>>;

export type SegmentState = "answered" | "current" | "pending";

export type Segment = {
  index: number;
  chapter: number | null;
  /** The step has a saved answer (it stays filled when the customer goes back). */
  filled: boolean;
  current: boolean;
  /** What the segment is called for a screen reader: the step being shown wins over its answer. */
  state: SegmentState;
};

/** True when every step belongs to a chapter; version 1 steps have none and keep the single bar. */
export function hasChapters(steps: readonly ChapterStep[]): boolean {
  return steps.length > 0 && steps.every((step) => step.chapter !== null && step.chapter !== undefined);
}

/** The state of each segment of the bar for the step at `currentIndex` (0-based). */
export function segmentStates(steps: readonly ChapterStep[], saved: SavedIds, currentIndex: number): Segment[] {
  return steps.map((step, index) => {
    const filled = Boolean(saved[step.id]);
    const current = index === currentIndex;
    return {
      index,
      chapter: step.chapter,
      filled,
      current,
      state: current ? "current" : filled ? "answered" : "pending",
    };
  });
}

/** The chapters whose steps all have a saved answer, in order. It does not depend on the step shown. */
export function earnedChapters(steps: readonly ChapterStep[], saved: SavedIds): number[] {
  if (!hasChapters(steps)) return [];
  const numbers = Array.from(new Set(steps.map((step) => step.chapter as number))).sort((a, b) => a - b);
  return numbers.filter((number) =>
    steps.filter((step) => step.chapter === number).every((step) => Boolean(saved[step.id])),
  );
}

/**
 * The chapter screen due when the customer moves on from the step at `fromIndex`, or null. It is due
 * when that step is the last one of its chapter, the whole chapter is saved and the screen has not
 * been shown yet in this visit (`seen` holds the chapter numbers already shown).
 */
export function chapterToShow(
  steps: readonly ChapterStep[],
  saved: SavedIds,
  fromIndex: number,
  seen: ReadonlySet<number>,
): number | null {
  if (!hasChapters(steps)) return null;
  const step = steps[fromIndex];
  if (!step || step.chapter === null) return null;
  const next = steps[fromIndex + 1];
  if (next && next.chapter === step.chapter) return null;
  if (seen.has(step.chapter)) return null;
  return earnedChapters(steps, saved).includes(step.chapter) ? step.chapter : null;
}
