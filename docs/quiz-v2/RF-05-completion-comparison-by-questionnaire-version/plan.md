# RF-05. Completion Comparison by Questionnaire Version: Implementation Plan

Spec: docs/quiz-v2/RF-05-completion-comparison-by-questionnaire-version/spec.md · Complexity: simple · Phases: 3

## Prerequisites

- **Features:** RF-05 depends on RF-02 of docs/prd/PRD-Quiz-Multipla-Escolha-Gamificado.md (wave 2), which has a spec and a plan but **is not implemented yet**: migration `20260101000019_questionnaire_v2.sql` (view `attempt_version_outcomes`) must be applied and committed, and RF-02 depends on migration `20260101000018` (RF-01). The original RF-01 to RF-09 are implemented (docs/STATUS.md). No Foundation feature is pending.
- **Order with the other features:** no file is shared with RF-03 or RF-04; RF-05 can be implemented in parallel with them once RF-02 is done.
- **Database:** no migration is added. The integration test uses the shared local Supabase and creates and removes only its own customers and attempts. Migrations are applied only with `supabase migration up`.
- **Access:** the command needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the main checkout's `.env.local` (never printed, never committed). If a key is missing, ask the owner.
- **Conventions:** English for code, comments and commit messages; Portuguese for the output texts (labels are drafts for Millena's review). Commit, push and pull requests only when asked.
- **No live checks:** the spec has none, so no keys or cost caps are needed beyond the above.

## Phase 1: Comparison rules

**Goal:** the figures per version, the "poucos dados" mark, the difference against version 1, the warning and the two output formats exist as tested pure logic.

**Covers:** RF-05 Capabilities and Experience; criteria 1, 2 and 3.

**Steps:**

1. **Comparison rules (`version-comparison`)** - Adds the shared module with the named thresholds and the function that turns the rows of the view into one summary per version, with rate, "poucos dados", difference against version 1 and warning, as in spec Section 1 and Section 5.
2. **Output formats and period** - Adds the table and JSON formatters in Portuguese and the parser of the optional start date, as in spec Sections 1 and 5.

**Done when:** `version-comparison.test.ts` (acceptance 1 to 3 and the parsing and formatting cases) passes and the existing suites are still green.

## Phase 2: Command

**Goal:** the owner can run `npm run quiz:compare` against the real database, with a clear message and a non-zero exit code on every failure.

**Covers:** RF-05 Consumes (view of RF-02) and Experience; criterion 4; Error Handling of spec Section 1.

**Steps:**

3. **Outcome reader** - Adds the paged read of the view with the optional period filter, so no row is skipped or repeated, as in spec Section 5.
4. **Command (`quiz-compare`)** - Adds the script and its npm entry: it loads the environment, checks the two variables, reads the view, prints the table or the JSON and sets the exit code, never printing the key.

**Done when:** `version-comparison.test.ts` (paging cases) and `quiz-compare-script.test.ts` (criterion 4 and the error cases) pass.

## Phase 3: Integration and hardening

**Goal:** the comparison is proven to follow the real view of RF-02 end to end, and the command is proven read-only.

**Covers:** the cross-feature criterion where RF-05 is the consumer; criterion 4; Error Handling of spec Section 1.

**Steps:**

5. **Hand-off RF-02 → RF-05** - Proves with a test that attempts of both versions, created through the real answer saving and routing, are counted once each under the version they started on, with the checkout reach of the same attempt.
6. **Read-only and privacy checks** - Verifies against spec Sections 1 and 7 that the code only selects from the view and that no output shows the key or an attempt id, adding any missing case to the suites named there; then runs the manual check of spec Section 7 against a disposable database.

**Done when:** `version-comparison-handoff.test.ts` and all suites of spec Section 7 pass, `npx tsc --noEmit` and `next build` are clean.
