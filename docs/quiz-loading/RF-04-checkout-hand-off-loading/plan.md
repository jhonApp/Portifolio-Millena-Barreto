# RF-04. Checkout Hand-off Loading: Implementation Plan

Spec: docs/quiz-loading/RF-04-checkout-hand-off-loading/spec.md · Complexity: medium · Phases: 3

## Prerequisites

- **Features that must already exist:** RF-01 of the loading feedback (the `LoadingLine` component and `scheduleAdvance` in `lib/diagnostico/loading.ts`), plus questionnaire version 2 with chapters, the completion page and the checkout (quiz v2 and the original product). At the time of writing RF-01 is only `spec ready` in `docs/quiz-loading/STATUS.md`: implement it first. If RF-01 ends without `scheduleAdvance`, add a cancellable timer helper to the same module before Phase 2.
- **Foundation features:** none pending.
- **Settings:** no new environment variable, key or dependency. The integration test and the browser script need the local Supabase running; the integration test runs against a database of this session (name with the `<project>_claude_` prefix when a new one is created), never against one that belongs to another session.
- **Port:** do not use port 3001 (it belongs to another session). Follow the project's rule for the dev server port.
- **Conventions:** one commit per phase, in the style of the repository, with the attribution lines the session requires. Update `docs/quiz-loading/STATUS.md` after each phase. The integration suite must pass with version 1 published and with version 2 published (restore the published version afterwards).

## Phase 1: Constants, state rule, waiting parts and version read

- **Goal:** the hand-off constants and state rule, the two waiting parts and the server read of the attempt version exist and are tested, including the RF-01 hand-off, and the running screens are unchanged.
- **Covers:** RF-04 criteria 1 and 4 (parts and rule), 6 (static variant), 7 (version read) and 8 (cross-feature hand-off, RF-01 to RF-04).
- **Steps:**
  1. **Loading module** - Add the hand-off timings, the three texts and the pure rule that turns "pending" and "timed out" into idle, loading or failed (spec Section 5).
  2. **HandoffScreen** - Create the hook-free loading part that returns the RF-01 line with the 8 s fill to 90% and the label, and the error part with the message and "Tentar novamente".
  3. **Attempt version read** - Add the server read that returns the version number of an attempt from its first answer, or nothing when there is none (spec Sections 5 and 6).
  4. **Unit tests** - Write the tests of the constants, the state rule, the two parts and the RF-01 to RF-04 hand-off test that drives the real loading line into the RF-04 part.
  5. **Version read test** - Write the integration test of the version read against the local database, for an attempt with no answers, with a version 2 answer and after another version is published.
- **Done when:** the new tests in `loading.test.ts`, `handoff-view.test.ts` (including the RF-01 to RF-04 hand-off) and `attempt-version.test.ts` (spec Section 7) pass, and `tsc --noEmit`, the whole unit suite and the whole integration suite are green with version 1 and with version 2 published.

## Phase 2: Hand-off after the last chapter

- **Goal:** on version 2, finishing the questionnaire shows "Preparando seu diagnóstico…" until the completion page renders, with the 15 s time-out and the retry, and version 1 behaves as before.
- **Covers:** RF-04 criteria 1, 4, 5, 6 and 7 for the questionnaire to completion move.
- **Steps:**
  6. **Hand-off hook** - Create the hook that runs the navigation in a transition, locks a second call, starts and cancels the 15 s timer and reports the waiting state (spec Section 5).
  7. **Questionnaire** - For version 2, use the hook for the move to the completion page after the last chapter, and render the loading part or the error part in place of the screen content while the hook says so; keep the move of version 1 unchanged.
  8. **Questionnaire view tests** - Keep the existing questionnaire view tests green and check that a version 2 set still opens on the question and a version 1 set is unchanged.
- **Done when:** the existing `questionnaire-two-choice-view.test.ts` and `questionnaire-state.test.ts` tests and the Phase 1 tests pass, and `tsc --noEmit` and the whole unit suite are green. The browser steps 1, 2, 5 (completion part), 6 (incomplete part) and 8 of the verification script (spec Section 7) pass with the dev server running.

## Phase 3: Hand-off to the checkout

- **Goal:** on version 2, tapping "RECEBER MEU DIAGNÓSTICO" shows "Preparando seu Pix…" until the checkout renders, with the lock, the time-out and the retry, and version 1 keeps the plain link; every criterion is checked in a browser.
- **Covers:** RF-04 criteria 2, 3, 4, 5, 6 and 7 for the completion to checkout move, and the full set 1 to 8 together.
- **Steps:**
  9. **CheckoutLink** - Create the client action that keeps the link address and the original look, uses the hook on click and swaps itself for the loading or error part.
  10. **Completion page** - Read the attempt version on the server and render the new action for version 2 and the existing link otherwise, without changing the access check or the redirects.
  11. **CheckoutLink tests** - Add the view test of the action's markup (address and original classes) to the hand-off view tests.
  12. **Browser check** - Run the whole verification script of spec Section 7 (steps 1 to 9) with delayed, failing and expired navigations and with reduced motion, restore the published version, the routes and the cookie afterwards, and record the result in the status file.
- **Done when:** the `handoff-view.test.ts` function `CheckoutLink renders a link to the checkout with the original look` and every Phase 1 and Phase 2 test pass; the whole unit suite, the whole integration suite (with version 1 and with version 2 published), `tsc --noEmit` and `next build` are green; and steps 1 to 9 of the verification script pass in the browser.
