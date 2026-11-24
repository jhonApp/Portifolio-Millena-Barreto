# RF-01. Loading Line and Chapter Auto-Advance: Implementation Plan

Spec: docs/quiz-loading/RF-01-loading-line-and-chapter-auto-advance/spec.md · Complexity: simple · Phases: 2

## Prerequisites

- **Features that must already exist:** questionnaire version 2 with chapters, badges and look progress (quiz v2 RF-04, status `success` in `docs/quiz-v2/STATUS.md`). PRD RF-01 of the loading feedback has no dependency (PRD Section 8).
- **Foundation features:** none pending.
- **Settings:** no new environment variable, key or dependency. The browser script needs the local Supabase running and questionnaire version 2 published.
- **Port and database:** do not use port 3001 (it belongs to another session). Follow the project's rule for the dev server port and use a per-session database if integration tests are run.
- **Decision to be aware of:** this feature replaces the "Continuar" button that criteria 1 and 8 of quiz v2 RF-04 describe. The old tests that assert the button are rewritten here (spec Section 3, assumptions).
- **Conventions:** one commit per phase, in the style of the repository (`feat(...)`, `test(...)`), with the attribution lines the session requires. Update `docs/quiz-loading/STATUS.md` after each phase.

## Phase 1: Shared loading building blocks

- **Goal:** the timings, the scheduling function and the reusable loading line exist, are tested on their own, and nothing in the running app changes yet.
- **Covers:** RF-01 criteria 2 (timer), 5 and 6 (line variants and status text); Provides of RF-01 (the reusable loading line for RF-03 and RF-04).
- **Steps:**
  1. **Loading module** - Create the shared module with the 2000 ms constant, the badge label and the pure scheduling function that fires its callback at most once and returns a cancel function (spec Section 4 and Section 5).
  2. **LoadingLine** - Create the reusable component with the line, its fill animation up to a given fraction, the static variant for reduced motion and the status text, following the contract in spec Section 5.
  3. **Loading module tests** - Write the unit tests of the constant and of the scheduling function with fake timers: fires once after 2000 ms, never before, cancel before and after.
  4. **LoadingLine tests** - Write the view tests of the line: status role and text with no percentage, animated and static markup, and clamping of the end fraction.
- **Done when:** `loading.test.ts` and `loading-line-view.test.ts` (all functions of spec Section 7) pass, and `tsc --noEmit` and the whole unit suite are green.

## Phase 2: Chapter screen auto-advance

- **Goal:** the badge screen shows the line instead of "Continuar" and moves on by itself after 2 s, on both chapters 1 and 2 and on the last chapter, with the old tests updated and the behavior checked in a browser.
- **Covers:** RF-01 criteria 1, 2, 3, 4, 5, 6, 7 and 8.
- **Steps:**
  5. **ChapterScreen** - Remove the button and the `onContinue` contract, add the `onDone` contract, schedule the 2 s advance on mount with cancel on unmount, and render the loading line with the badge label (spec Section 4).
  6. **Questionnaire** - Pass the existing "close the chapter screen and leave" handler as `onDone`, kept stable so a re-render never restarts the timer, without changing what happens after chapters 1, 2 and 3.
  7. **ChapterScreen tests** - Rewrite the view tests that asserted "Continuar" into the new set: badge, message and line with no button, no interactive element besides the title, static line under reduced motion, no style name or percentage.
  8. **Browser check** - Run the verification script of spec Section 7 (steps 1 to 9) against the running app with version 2 published, and restore the published version afterwards; record the result in the status file.
- **Done when:** `chapter-screen-view.test.ts` (all functions listed in spec Section 7), the existing `questionnaire-state.test.ts` tests named in spec Section 7 (criteria 3, 7 and 8), `loading.test.ts` and `loading-line-view.test.ts` pass; the whole unit suite, `tsc --noEmit` and `next build` are green; and steps 1 to 9 of the verification script pass in the browser.
