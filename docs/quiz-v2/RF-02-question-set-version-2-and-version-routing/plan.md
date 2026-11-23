# RF-02. Question Set Version 2 and Version Routing: Implementation Plan

Spec: docs/quiz-v2/RF-02-question-set-version-2-and-version-routing/spec.md · Complexity: medium · Phases: 4

## Prerequisites

- **Features:** RF-02 depends on RF-01 of docs/prd/PRD-Quiz-Multipla-Escolha-Gamificado.md (wave 1). RF-01 has a spec and a plan but **is not implemented yet**: migration `20260101000018_two_choice_answers.sql` and its columns (`max_choices`, `first_choice_points`, `second_choice_points`, `late_tiebreak_basis`, `second_alternative_id`) must exist and RF-01 must be committed before phase 1 starts. The original RF-01 to RF-09 are implemented (docs/STATUS.md). No Foundation feature is pending.
- **Database:** the shared local Supabase is running on its default port. Migrations are applied only with `supabase migration up`, never `db reset`. Tests that publish a version restore the previous one in `finally` and delete their fixtures by id. Browser checks use a disposable per-session database named `<project>_claude_<short-task-slug>`.
- **Release order:** version 2 is created as a draft and must **not** be published in any real environment before RF-03 (look duel screen) and RF-04 (chapters) are implemented and Millena has reviewed the texts. Publishing is a manual step: `npm run quiz:publish -- 2`.
- **Contracts shared with other features:** the public question set and the view `attempt_version_outcomes` (spec Section 5) are consumed by RF-03, RF-04 and RF-05; any change to them is made in the spec first.
- **Conventions:** English for code, comments and commit messages; Portuguese for customer-facing text. Draft copy (duel question text, version-changed notice) is marked for Millena's review. Commit, push and pull requests only when asked.
- **No live checks:** the spec has none, so no keys or cost caps are needed.

## Phase 1: Data model

**Goal:** the database describes duels and chapters, holds version 2 as a draft, can publish a version atomically and exposes the attempt outcomes, with version 1 and all existing data unchanged.

**Covers:** RF-02 Capabilities (version 2 structure, publication, routing support), Provides (view); criteria 1, 5, 8 and 9 at data level.

**Steps:**

1. **Migration `20260101000019_questionnaire_v2`** - Adds question kind and chapter, seeds version 2 as a draft by copying the version 1 texts and adding the three duels, creates the publish function with its structural validation, recreates the answer save function to raise `VERSION_CHANGED` and creates the outcomes view, as in spec Section 6. This changes contracts shared with RF-03, RF-04 and RF-05 (spec Section 5).
2. **Typed schema (`database.types.ts`)** - Regenerates the types so later steps are type checked against the new columns, function and view.
3. **Integration test helpers** - Adds the helper that publishes a version for the duration of a test and restores the previous one, so tests never leave the shared database with a different published version.

**Done when:** `questionnaire-v2.test.ts` › `the seeded version 2 has 12 questions, 3 duels and 9 steps per style` and `publishing is atomic: exactly one version is published afterwards`, and `attempt-version-outcomes.test.ts` pass; the existing suites are still green.

## Phase 2: Rules, question bank and publish command

**Goal:** a version 2 set can be validated, edited as a draft and published through a library function and an owner command, and the public set carries chapter and kind without style or weight.

**Covers:** RF-02 Provides (public question set); criteria 3, 4, 5, 6, 7 and 9.

**Steps:**

4. **Question types** - Extends the public and editable question types with kind, chapter and the per-version rule fields, keeping style and weight out of the public type.
5. **Question set rules** - Adds the version 2 profile (12 regular questions, 3 duels, nine appearances per style, five steps per chapter, duels at steps 5, 10 and 15) and the choice of profile from the set; the version 1 validation is unchanged.
6. **Question bank reads** - Selects the new columns for the public and editable sets, keeping the seeded shuffle so the order stays stable per attempt, including the two looks of a duel.
7. **Publish and edit functions** - Adds `publishQuestionnaireVersion` (pre-validation with the rules, then the SQL function) and the draft-only text edit functions with their error codes, as in spec Section 5.
8. **Publish command (`scripts/publish-questionnaire-version.mjs` and `quiz:publish`)** - Lets the owner publish a version by number from the terminal, printing the result or the validation message and exiting non-zero on failure.

**Done when:** `question-set-rules.test.ts` (version 2 cases and the SQL/TypeScript agreement), and in `questionnaire-v2.test.ts` the tests for criteria 3, 4, 5, 6, 7 and 9 and the publish and edit error cases pass.

## Phase 3: Version routing and questionnaire page

**Goal:** an attempt stays on its own version, a customer with a stale page is moved to version 2 with a notice, and the page shows the maintenance message when nothing is published.

**Covers:** RF-02 Experience and Error Handling; criteria 1, 2 and 10; the RF-01 → RF-02 hand-off criterion.

**Steps:**

9. **Answers library and route** - Maps `VERSION_CHANGED` to a `409` and "no published version" to a `503`, keeping the existing behavior for attempts already pinned to an archived version.
10. **Questionnaire loader and page** - Returns an "unavailable" state instead of throwing when no version is published, and renders the maintenance message without creating an attempt.
11. **Questionnaire screen** - On `VERSION_CHANGED` refreshes the page and shows the version-changed notice, and accepts the unavailable state; the rest of the screen is unchanged.

**Done when:** `answers-route.test.ts` (`409`, `503`, pinned attempt on an archived version), `questionnaire-v2.test.ts` (criteria 1, 2 and 10 tests) and `two-choice-handoff.test.ts` pass, and the verification script of spec Section 7 runs through steps 1 to 6 in a browser.

## Phase 4: Regression and release notes

**Goal:** the whole change is proven backward compatible, including with version 2 published, and the owner has what is needed to release it later.

**Covers:** criterion 8 and the cross-feature pointers; Error Handling of spec Section 1.

**Steps:**

12. **Backward-compatibility check** - Updates the existing tests that assumed the published version was version 1 so they load version 1 by its number (they keep asserting the same things about version 1), runs the complete unit and integration suites, then runs them again in a disposable database where version 2 is published, and compares a stored version 1 result before and after the migration to confirm nothing changed.
13. **Release notes and hand-over** - Records the release order (RF-03 and RF-04 first, Millena's review of the draft texts, then `npm run quiz:publish -- 2`), the rollback (`npm run quiz:publish -- 1`) and the contracts that RF-03, RF-04 and RF-05 will consume.

**Done when:** all suites of spec Section 7 pass in both configurations, `npx tsc --noEmit` and `next build` are clean, and the version 1 result comparison shows no difference.
