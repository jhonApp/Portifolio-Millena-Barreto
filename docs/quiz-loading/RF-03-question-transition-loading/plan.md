# RF-03. Question Transition Loading: Implementation Plan

Spec: docs/quiz-loading/RF-03-question-transition-loading/spec.md · Complexity: simple · Phases: 2

## Prerequisites

- **Features that must already exist:** RF-01 of the loading feedback (the `LoadingLine` component and `scheduleAdvance` in `lib/diagnostico/loading.ts`), plus questionnaire version 2 with chapters (quiz v2). At the time of writing RF-01 is only `spec ready` in `docs/quiz-loading/STATUS.md`: implement it first. If RF-01 ends without `scheduleAdvance`, add a cancellable timer helper to the same module before Phase 2.
- **Foundation features:** none pending.
- **Settings:** no new environment variable, key or dependency. The browser script needs the local Supabase running and the right questionnaire version published.
- **Port and database:** do not use port 3001 (it belongs to another session). Follow the project's rule for the dev server port.
- **Conventions:** one commit per phase, in the style of the repository, with the attribution lines the session requires. Update `docs/quiz-loading/STATUS.md` after each phase.

## Phase 1: The rule, the constants and the transition component

- **Goal:** the rule that decides when the 500 ms line shows, its constants and the transition component exist and are tested, including the hand-off with the RF-01 loading line, and the running screen is unchanged.
- **Covers:** RF-03 criteria 1 (constants), 4, 5, 6 and 7 (rule), and 8 (cross-feature hand-off, RF-01 to RF-03).
- **Steps:**
  1. **Transition constants** - Add the 500 ms wait and the "Carregando próxima pergunta…" text to the shared loading module (spec Section 5).
  2. **Transition rule** - Add the pure rule that is true only on version 2, without reduced motion and when the step is not the last of its chapter, and the helper that tells the last step of a chapter.
  3. **QuestionTransition** - Create the hook-free component that returns the RF-01 loading line with the RF-03 duration and text.
  4. **Rule and hand-off tests** - Write the unit tests of the rule, of the constants and of the fixed-waiting total, and the hand-off test that drives the real RF-01 line into the RF-03 component.
- **Done when:** the new `usesTransitionLine` and `isLastStepOfChapter` tests in `questionnaire-state.test.ts` and all functions of `question-transition-view.test.ts` (including the RF-01 to RF-03 hand-off) pass, and `tsc --noEmit` and the whole unit suite are green.

## Phase 2: Wire it into the questionnaire

- **Goal:** tapping "Próxima" on version 2 shows the 500 ms line between questions, with the double-tap lock and a stable layout, and nothing else about the flow changes.
- **Covers:** RF-03 criteria 1 to 7, and the behavior of 8 on the real screen.
- **Steps:**
  5. **Questionnaire** - Start the 500 ms transition from the forward move when the rule says so, swap the question block for the transition component in an area that keeps the height of the question that left, and run the existing move to the next question when the time ends.
  6. **Questionnaire guards** - Add the lock that ignores a second tap, disable both navigation buttons while the line shows, skip the line for "Anterior" and for reduced motion, and cancel the timer when the screen unmounts.
  7. **Questionnaire view tests** - Keep the existing questionnaire view tests green and add an initial-render check that a version 2 question set still opens on the question (no line at first render).
  8. **Browser check** - Run the verification script of spec Section 7 (steps 1 to 9) against the running app with version 2 published, restore the published version afterwards, and record the result in the status file.
- **Done when:** the Phase 1 tests, the existing `questionnaire-two-choice-view.test.ts` and `questionnaire-state.test.ts` tests pass; the whole unit suite, `tsc --noEmit` and `next build` are green; and steps 1 to 9 of the verification script pass in the browser.
