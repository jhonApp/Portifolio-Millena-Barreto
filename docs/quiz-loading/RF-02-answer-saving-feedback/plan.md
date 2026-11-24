# RF-02. Answer Saving Feedback: Implementation Plan

Spec: docs/quiz-loading/RF-02-answer-saving-feedback/spec.md · Complexity: simple · Phases: 2

## Prerequisites

- **Features that must already exist:** questionnaire version 2 with chapters, duels and the save-with-retry flow (quiz v2, `docs/quiz-v2/STATUS.md`). PRD RF-02 of the loading feedback has no dependency (PRD Section 8).
- **Foundation features:** none pending.
- **Shared file:** `lib/diagnostico/loading.ts` is also created by RF-01. If RF-01 is not implemented yet, create the file with the saving text; if it exists, add the constant to it. Do not remove or rename what RF-01 put there.
- **Settings:** no new environment variable, key or dependency. The browser script needs the local Supabase running and the right questionnaire version published.
- **Port and database:** do not use port 3001 (it belongs to another session). Follow the project's rule for the dev server port.
- **Conventions:** one commit per phase, in the style of the repository, with the attribution lines the session requires. Update `docs/quiz-loading/STATUS.md` after each phase.

## Phase 1: The rule and the button parts

- **Goal:** the rule that decides when the feedback shows, the saving text, the spinner and the new button exist and are tested on their own, and the running screen is unchanged.
- **Covers:** RF-02 criteria 1, 2, 5 and 7 (button states and stable size), and the rule behind criteria 4 and 8.
- **Steps:**
  1. **Saving rule and text** - Add the pure rule that is true only on version 2 and only for the `saving` and `retrying` statuses, and the saving text in the shared loading module (spec Section 5).
  2. **SavingIndicator** - Create the spinner with the static three-dot variant for reduced motion, hidden from assistive technology.
  3. **ForwardButton** - Create the presentational button with the three labels stacked in one cell so its size never changes, the indicator and the disabled contract of the old button.
  4. **Rule and button tests** - Write the unit tests of the rule and of the button markup: labels in each state, disabled, indicator variants and the reserved width.
- **Done when:** the new `showsSavingFeedback` tests in `questionnaire-state.test.ts` and `forward-button-view.test.ts` (all functions of spec Section 7) pass, and `tsc --noEmit` and the whole unit suite are green.

## Phase 2: Wire it into the questionnaire

- **Goal:** the forward button of the real screen shows "Salvando…" while an answer is being saved, on version 2 only, with the announcement for screen readers and the checks in a browser.
- **Covers:** RF-02 criteria 1 to 8, and the Error Handling behavior of PRD RF-02 (kept).
- **Steps:**
  5. **Questionnaire** - Replace the inline forward button with the new button, compute its saving flag from the rule and the version of the question set, and keep every other behavior (retry, messages, "Anterior") as it is.
  6. **Live region** - Add the screen-reader "Salvando…" message to the existing polite region under the answers, shown only while saving.
  7. **Questionnaire view tests** - Add the version 1 and version 2 checks of the initial button markup to the existing questionnaire view test.
  8. **Browser check** - Run the verification script of spec Section 7 (steps 1 to 9) against the running app with throttled and failing save requests, restore the published version and the routes afterwards, and record the result in the status file.
- **Done when:** the `questionnaire-two-choice-view.test.ts` functions of spec Section 7, the Phase 1 tests and the existing retry tests in `questionnaire-state.test.ts` pass; the whole unit suite, `tsc --noEmit` and `next build` are green; and steps 1 to 9 of the verification script pass in the browser.
