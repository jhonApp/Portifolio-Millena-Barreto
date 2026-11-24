// Timings and texts of the loading feedback of questionnaire version 2 (loading feedback PRD).
// Safe to import in the browser and on the server.

// The chapter badge screen moves on by itself after this long (RF-01).
export const CHAPTER_ADVANCE_MS = 2000;
// Draft copy for Millena's review.
export const CHAPTER_ADVANCE_LABEL = "Preparando a próxima etapa…";

// The forward button while the answer of the step is being saved (RF-02).
// Draft copy for Millena's review.
export const LABEL_SAVING = "Salvando…";

// The fixed pause between two questions of the same chapter (RF-03).
export const QUESTION_TRANSITION_MS = 500;
// Draft copy for Millena's review.
export const QUESTION_TRANSITION_LABEL = "Carregando próxima pergunta…";

/**
 * Calls `callback` once after `ms` milliseconds. Returns a function that cancels it; cancelling
 * after the callback ran, or twice, does nothing.
 */
export function scheduleAdvance(ms: number, callback: () => void): () => void {
  let finished = false;
  const timer = setTimeout(() => {
    if (finished) return;
    finished = true;
    callback();
  }, ms);
  return () => {
    finished = true;
    clearTimeout(timer);
  };
}
