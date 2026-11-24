# RF-04. Interactive Questionnaire: Implementation Plan

Spec: docs/RF-04-interactive-questionnaire/spec.md · Complexity: medium · Phases: 4

## Prerequisites

- **Features:** RF-02 (Customer Identification) and RF-03 (Question Bank and Scoring Engine), both implemented in the codebase (status `implemented`, not yet verified in a fresh session). Their attempt cookie, rate-limit and attempt-creation function, public question set, seeded questionnaire version 1 and the `server-only` Vitest alias are used as they are.
- **Pending Foundation features:** none.
- **Environment:** Docker running, local Supabase started (`npm run db:start`), `.env.local` filled with the local keys and `SESSION_SECRET`, `APP_PORT=3001` for the dev server, tests run from `D:/...` (upper-case drive) or PowerShell. After the migration, regenerate the database types into a temporary file first and copy it over only when it is not empty.
- **Conventions:** commits in English, one per phase (`feat(RF-04): phase N <name>`), status file updated after each phase. This migration is `20260101000007`. Changes to files of RF-02 and RF-03 (cookie helpers, question set, registration page) are additive and keep their tests passing.
- **Live checks:** none.

## Phase 1: Data layer

**Goal:** the atomic save function and the server helpers exist and are proven against the local database, with no visible change for the customer.
**Covers:** RF-04 Capabilities (immediate save, replace, version pinning, 7-day attempt) and Provides; Section 9 criteria 3, 4 and 6 at the data level.

1. **Migration** - Create the migration with the atomic `save_answer` function (spec Section 6), apply it with a database reset and regenerate the database types.
2. **Cookie helpers** - Add the cookie-value verification and the Next cookie-store reader to the attempt-session module, keeping `readAttemptId` behavior unchanged.
3. **Question set by version** - Extend `getPublicQuestionSet` with the optional version id (spec Section 5) without changing its default behavior.
4. **Answer helpers** - Implement saving, saved answers, the attempt's version, progress and the active-attempt lookup in the answers module, mapping database errors to `AnswerError`.
5. **Helper tests** - Write the helper and question-set tests of spec Section 7 (`answers-lib`, cookie and question-bank additions).

**Done when:** `answers-lib.test.ts`, the new cases of `attempt-session.test.ts` and of `question-bank.test.ts` pass on a freshly reset database, and the existing suites still pass.

## Phase 2: Save route

**Goal:** a request with the attempt cookie saves, replaces or rejects answers exactly as the contract says, and the two hand-off tests prove the RF-02 and RF-03 contracts.
**Covers:** RF-04 Capabilities (save, version pin, isolation) and Error Handling (invalid save, expired session); Section 9 criteria 3 and 6, and the cross-feature criteria H1 and H2.

6. **Answer schema** - Implement the shared body schema for the question and alternative ids.
7. **Route handler** - Implement the `PUT` handler: authenticate by cookie, read and validate the body, save through the helper, and return the documented bodies and status codes for success, validation, session and server errors.
8. **Page state loader** - Implement the server loader that builds the initial state (pinned version, public set, saved answers, start index) for the page.
9. **Route and hand-off tests** - Write the route tests of spec Section 7 and the hand-off tests that drive RF-02's real route into RF-04 and prove the state carries no style or weight.

**Done when:** `answers-route.test.ts`, `answer-schema.test.ts` and `questionnaire-handoff.test.ts` pass on a freshly reset database.

## Phase 3: Questionnaire screen

**Goal:** a customer can answer the 15 questions on a phone, with saving, retries, progress and the transition, and an expired session returns to the registration.
**Covers:** RF-04 Capabilities, Experience and Error Handling; Section 9 criteria 1 to 6.

10. **State helpers** - Implement the pure helpers (first unanswered question, progress, advance rule, retry delays, transition length) and their unit tests.
11. **Questionnaire component** - Build the client component with the question screen, the radiogroup cards, the progress bar, the buttons, the 300 ms transition with reduced-motion support, the save with timed retries, the failure messages and the navigation on "Concluir", using only the site's tokens and classes.
12. **Questionnaire page** - Create the server page that reads the cookie, redirects to the registration when there is no active attempt, and renders the component with the initial state.
13. **Registration notice** - Add the "session expired" notice to the registration page when the address carries the expiry query.

**Done when:** `questionnaire-state.test.ts` and the design-token test pass, the type check and the production build succeed, and the browser verification script steps 1 to 12 of spec Section 7 behave as written.

## Phase 4: Full verification

**Goal:** the whole feature is proven end to end on a recreated database and ready for independent verification.
**Covers:** all eight criteria of RF-04 (six own and two as consumer).

14. **Full run** - Recreate the database, run the complete unit and integration suites, the type check and the production build, follow the verification script once more in a real browser, clean up the test data, and update the status row of RF-04 with the result.

**Done when:** every test named in spec Section 7 passes with none skipped, the type check and the build succeed, the verification script behaves as written, and the status file shows the final result of the run.
