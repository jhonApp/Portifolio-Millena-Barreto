# RF-01. Two-Choice Answers and Weighted Scoring: Implementation Plan

Spec: docs/quiz-v2/RF-01-two-choice-answers-and-weighted-scoring/spec.md · Complexity: medium · Phases: 4

## Prerequisites

- **Features:** RF-01 depends on no other feature of the new PRD (docs/prd/PRD-Quiz-Multipla-Escolha-Gamificado.md, Section 8, wave 1). It builds on the already implemented RF-03 (question bank and scoring), RF-04 (questionnaire) and RF-05 (completion) of the original PRD, recorded in `docs/STATUS.md`. No Foundation feature is pending.
- **Database:** the shared local Supabase is running on its default port. Migrations are applied only with `supabase migration up`, never `db reset`. Integration tests create fixtures only inside versions of their own and delete them by id. Browser checks use a disposable per-session database named `<project>_claude_<short-task-slug>`.
- **Order of migrations:** `20260101000018_two_choice_answers.sql` comes after migrations 15, 16 and 17, which must already be applied.
- **Contract shared with other features:** the saved answers and the scoring result declared in spec Section 5 are consumed by RF-02, RF-03 and RF-04; any change to them is made in this plan's steps and in the spec first.
- **Conventions:** English for code, comments and commit messages; Portuguese for customer-facing text. Commit, push and pull requests only when asked. Copy that is a draft (labels and the optional-choice hint) is marked for Millena's review.
- **No live checks:** the spec has none, so no keys or cost caps are needed.

## Phase 1: Data model and test fixtures

**Goal:** the database knows the new rules and the second choice, all existing data and behavior are unchanged, and tests can build a two-choice questionnaire without touching version 1.

**Covers:** RF-01 Capabilities (rules per version and per question); the storage part of criteria 2, 3, 4 and 9.

**Steps:**

1. **Migration `20260101000018_two_choice_answers`** - Adds the rule columns to questionnaire versions and questions, the optional second alternative to answers and the four-parameter `save_answer`, with the defaults that reproduce version 1, as in spec Section 6. A call with three arguments still works, so the running application is unaffected, and existing rows are not rewritten. This changes a contract shared with RF-02, RF-03 and RF-04 (spec Sections 5 and 6).
2. **Typed schema (`database.types.ts`)** - Regenerates the types after the migration so that every later step is type checked against the new columns.
3. **Integration test helpers** - Adds the fixture helpers of spec Section 7 (a non-published two-choice version, pinning an attempt to it and cleaning up by id) so the next phases can test without modifying version 1.

**Done when:** `schema.test.ts` › `the rule columns have the version 1 defaults` and `answers_second_differs rejects equal alternatives` pass, and the existing unit and integration suites are still green.

## Phase 2: Save contract and scoring engine

**Goal:** a second choice can be saved through the API and the engine scores it by the rules of the attempt's version, while version 1 attempts behave exactly as before.

**Covers:** RF-01 Provides (saved answers, scoring result); criteria 2, 3, 4, 5, 6, 7, 8, 9, 10 and 12.

**Steps:**

4. **Answers library and body schema** - Extends `saveAnswer` and the zod body with the optional second alternative, adds the saved-choices read and the new error code, and keeps the first-choice-only read for existing callers.
5. **Answers route** - Passes the second choice through and maps the new rejection to a 400 on its own field, leaving the other responses as they are.
6. **Scoring engine** - Adds the rules (points of each choice and the tie-break basis), a default that equals version 1, per-question validation and the point-based tie-break, in line with the Business Rules of spec Section 1.
7. **Question bank reads** - Returns one scored item per choice with its rank, adds the read of the version's rules, and exposes `maxChoices` in the public question type without any style or weight.
8. **Diagnosis generation** - Counts answered questions instead of items and passes the version's rules to the engine, so a two-choice attempt is scored correctly and a version 1 attempt is unchanged.

**Done when:** `two-choice-sql.test.ts`, `answers-route.test.ts` (second-choice cases), `answers-lib.test.ts`, `scoring-two-choice.test.ts`, `answer-schema.test.ts` and `checkout-route.test.ts` (incomplete attempt) pass; the existing `scoring.test.ts` and `generation-handoff.test.ts` pass unchanged.

## Phase 3: Questionnaire screen

**Goal:** a customer can pick, change and remove a second choice on the screen, and a single-choice question looks and behaves as today.

**Covers:** RF-01 Experience and the Full Scope hint; criteria 1, 2, 3, 4 and 11.

**Steps:**

9. **Screen helpers (`questionnaire-state`)** - Adds the saved-choice type and the pure tap rules (select, second, promote, remove second, replace second, keep the only choice) and makes "can advance" depend on the saved first choice.
10. **Server loader (`questionnaire-page`)** - Loads the saved choices and the start index from them, so a returning customer sees both choices.
11. **Questionnaire screen** - Shows the "1ª escolha" and "2ª escolha" states, keeps at most one save in flight per question and sends the latest state afterwards, and keeps the existing retry, failure and rejection messages.
12. **Optional-choice hint (Full Scope)** - Shows the draft line saying the second choice is optional under questions that allow it, and nothing under single-choice questions.

**Done when:** `questionnaire-state.test.ts` (tap rules, retry delays), `questionnaire-two-choice-view.test.ts` and the existing questionnaire tests pass, and the verification script of spec Section 7 runs through steps 1 to 10 in a browser.

## Phase 4: Regression and hardening

**Goal:** the whole change is proven backward compatible and the work is ready for review and for RF-02.

**Covers:** criterion 10 and the cross-feature pointers; Error Handling of spec Section 1.

**Steps:**

13. **Backward-compatibility check** - Runs the complete unit and integration suites and a build, and compares a stored diagnosis of a version 1 order before and after the migration to confirm nothing changed.
14. **Error cases and hand-over notes** - Verifies the rejection paths, the concurrent-save order, the expired attempt and the no-sensitive-data-in-logs rules against the Error Handling of spec Section 1, adds any missing case to the suites named in spec Section 7, and records the open review points (the "only selected card" deviation from the PRD text and the draft copy) and the contract that RF-02, RF-03 and RF-04 will consume.

**Done when:** all suites of spec Section 7 pass, `npx tsc --noEmit` and `next build` are clean, and the version 1 diagnosis comparison shows no difference.
