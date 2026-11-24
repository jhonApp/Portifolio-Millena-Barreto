# RF-03. Question Bank and Scoring Engine: Implementation Plan

Spec: docs/RF-03-question-bank-and-scoring-engine/spec.md · Complexity: medium · Phases: 3

## Prerequisites

- **Features:** RF-01 (Platform Foundation and Data Model), implemented in the codebase (status `implemented`, not yet verified in a fresh session). Its tables, constants, test helpers and Vitest configs are used as they are.
- **Pending Foundation features:** none.
- **Environment:** Docker running, local Supabase started (`npm run db:start`), `.env.local` filled with the local keys, tests run from `D:/...` (upper-case drive) or PowerShell (see `docs/research.md`).
- **Content:** the source text is `docs/RF-03-question-bank-and-scoring-engine/questionnaire-source.md`. The drafted Criativo and Dramático alternatives are `(inferred)` and must be reviewed by Millena before go-live.
- **Conventions:** commits in English, one per phase (`feat(RF-03): phase N <name>`), status file updated after each phase. Migrations are numbered; this one is `20260101000006`. If RF-02 was implemented first, the `server-only` Vitest alias already exists and is reused.
- **Live checks:** none.

## Phase 1: Pure scoring and rules

**Goal:** the scoring engine, the question-set rules and the shuffle exist as pure modules with unit tests that pass.
**Covers:** RF-03 Capabilities (scoring, tie-break, rules, shuffle); Section 9 criteria 3, 4, 5, 6.

1. **Shared types** - Define the types for scored answers, scoring results, public and editable question sets and rule issues, as listed in spec Section 5.
2. **Scoring engine** - Implement `scoreAnswers` with point summing, the predominant and secondary picks, the two-level tie-break (answers in questions 11 to 15, then the fixed order) and `ScoringError` for invalid input.
3. **Question-set rules** - Implement `validateQuestionSet` and `styleAppearances` with the six issue codes of spec Section 5.
4. **Seeded shuffle** - Implement the deterministic shuffle used to order alternatives per attempt.
5. **Unit tests** - Write the scoring, rules and shuffle tests named in spec Section 7, including determinism over 100 runs and every tie-break level.

**Done when:** `scoring.test.ts`, `question-set-rules.test.ts` and `seeded-shuffle.test.ts` pass.

## Phase 2: Seed data and database access

**Goal:** version 1 of the questionnaire is in the database, and the server helpers serve it without style or weight and read stored answers back for scoring.
**Covers:** RF-03 Capabilities (15 questions, balance, versioned sets, shuffle) and Provides; Section 9 criteria 1, 2 and 7.

6. **Seed migration** - Create the migration that inserts version 1, published, with 15 questions and 60 alternatives taken from the source file (spec Section 6), then apply it with a database reset.
7. **Test setup** - Add the `server-only` stub and the alias in both Vitest configurations when they do not exist yet, so server modules can be imported in tests.
8. **Question bank helpers** - Implement the public question set (no style or weight selected, per-attempt shuffle), the scored-answers reader that uses the stored version, and the editable bank loader, per spec Section 5.
9. **Integration tests** - Write the question-bank tests of spec Section 7: set shape and balance, no style or weight in the public set, stable shuffle per attempt, scoring with the stored version, source-file match and the no-published-version error.

**Done when:** `question-bank.test.ts` passes on a freshly reset database, and `npm run build` still succeeds.

## Phase 3: Verification and status

**Goal:** the whole feature is proven end to end and ready for independent verification.
**Covers:** all seven Section 9 criteria of RF-03; pointers to the consumers' hand-off tests (RF-04, RF-07, RF-12).

10. **Full run** - Run the complete unit and integration suites, the type check and the production build on a freshly reset database, and update the status row of RF-03 with the result.

**Done when:** every test named in spec Section 7 passes with none skipped, the type check and the build succeed, and the status file shows the final result of the run.
