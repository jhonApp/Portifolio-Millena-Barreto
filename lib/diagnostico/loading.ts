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

// The two waits between the end of the questionnaire and the Pix (RF-04): the line fills slowly to
// HANDOFF_FILL_TO over HANDOFF_FILL_MS, and gives up after HANDOFF_TIMEOUT_MS.
export const HANDOFF_FILL_MS = 8000;
export const HANDOFF_FILL_TO = 0.9;
export const HANDOFF_TIMEOUT_MS = 15000;
// Draft copy for Millena's review.
export const HANDOFF_COMPLETION_LABEL = "Preparando seu diagnóstico…";
export const HANDOFF_CHECKOUT_LABEL = "Preparando seu Pix…";
export const HANDOFF_ERROR_MESSAGE = "Não conseguimos abrir a próxima etapa. Suas respostas estão salvas.";

export type HandoffView = "idle" | "loading" | "failed";

/** What a hand-off screen shows: nothing, the loading line, or the retry message. */
export function handoffView(pending: boolean, timedOut: boolean): HandoffView {
  if (!pending) return "idle";
  return timedOut ? "failed" : "loading";
}

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
