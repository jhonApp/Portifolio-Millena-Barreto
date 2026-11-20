# RF-07. Diagnosis Content and PDF Generation: Implementation Plan

Spec: docs/RF-07-diagnosis-content-and-pdf-generation/spec.md · Complexity: complex · Phases: 5

## Prerequisites

- **Features:** RF-06 (Payment Confirmation) implemented in the codebase (status `implemented`, not yet verified in a fresh session); RF-02, RF-03, RF-04 and RF-05 through it. The `startGeneration` hook, `assertOrderApproved`, the scoring engine and the score-ready answers reader, the seeded shuffle, `automation_errors`, the private bucket `diagnostics` and the paid-order trigger are used as they are.
- **Pending Foundation features:** none.
- **Environment:** Docker running, local Supabase started (`npm run db:start`), `.env.local` filled with the local keys, `SESSION_SECRET` and a local `CRON_SECRET` (any value of 16 or more characters), `APP_PORT=3001` for the dev server, tests run from `D:/...` (upper-case drive) or PowerShell. After each migration, regenerate the database types into a temporary file first and copy it over only when it is not empty.
- **New packages (gate `dependencies` for the independent verification):** `@react-pdf/renderer` (runtime) and `pdfjs-dist` (development only, to read the generated PDFs in tests). The fonts Bebas Neue and Inter (Regular and SemiBold) are downloaded once from the font projects (SIL Open Font License) into `assets/pdf-fonts/` with their license texts; if the download is not possible in the run, ask the owner for the files.
- **Platform (owner decision):** the Vercel plan must be **Pro** for the per-minute cron and `maxDuration = 60`. In Vercel set `CRON_SECRET` for production; the cron entry lives in `vercel.json`.
- **Conventions:** commits in English, one per phase (`feat(RF-07): phase N <name>`), status file updated after each phase. Migrations are `20260101000010` (state) and `20260101000011` (seed). The two RF-05 and RF-06 route files get only a `maxDuration` export; their tests keep passing (the RF-06 hand-off tests inject their own `startGeneration`).
- **Content:** the diagnosis texts are drafted by the team (owner decision) in `content-source.md` and reviewed by Millena later through RF-12; the plan must not block on that review.
- **Live checks:** none.

## Phase 1: Foundation: state, dependencies and configuration

**Goal:** the generation state exists in the database, the library and fonts are installed and configured, and the shared constants are in place, with no visible change for the customer.
**Covers:** RF-07 Capabilities (start, retries, idempotency reservation) at the data level; Section 9 criteria 4 and 5 at the data level.

1. **State migration** - Create the migration with the two columns on orders, the index and the functions that reserve a run, record a failure on the retry schedule and reset a paid failed order (spec Section 6); apply it with a database reset and regenerate the database types.
2. **Dependencies and build config** - Add the PDF library and the test PDF reader, mark the library as a server external package, trace the font files into the routes that render, and add the fonts with their licenses.
3. **Shared constants and env** - Add the style labels, the attempt limit and the retry delays to the constants, the cron secret reader to the env readers, and document the new variables in the example env file.
4. **State tests** - Write the SQL tests for reservation, lease, schedule, failure and reset, and the schema test additions.

**Done when:** `generation-sql.test.ts`, `generation-schedule.test.ts`, the new cases of `env.test.ts` and `schema.test.ts` pass on a freshly reset database, the type check and the production build succeed, and the existing suites still pass.

## Phase 2: Content: composer, store and seed

**Goal:** the published content version 1 exists with every template, and a pure composer turns scores and templates into the four blocks deterministically.
**Covers:** RF-07 Capabilities (content from editable templates, individualization) and Provides (editable templates); Section 9 criteria 2 and 6 at the unit level.

5. **Content source** - Write the readable source of the content (six style blocks of four kinds, thirty pair paragraphs, eight pieces and six accessories per style) in Portuguese, marked as a team draft for Millena's review.
6. **Seed migration** - Generate the seed migration from the source so it publishes content version 1 with all 138 templates, apply it and regenerate the types.
7. **Content store** - Implement loading of the published templates and the completeness check for a pair, with the content error that names what is missing.
8. **Composer** - Implement the pure composition: percentages by largest remainder, seeded picks, placeholder replacement and the four blocks in the layout order, plus the schema of the saved content.
9. **Content tests** - Write the composer, schema and content store tests of spec Section 7, including the seed completeness checks.

**Done when:** `diagnosis-composer.test.ts`, `diagnosis-content-schema.test.ts` and `content-store.test.ts` pass on a freshly reset database.

## Phase 3: PDF

**Goal:** a diagnosis becomes an A4 PDF with the eight parts in order, stored in the private bucket, within the size and time limits.
**Covers:** RF-07 Capabilities (PDF contents, limits, storage); Section 9 criterion 3.

10. **PDF document** - Build the document with the cover, the two style results, the styles and points page, the pieces, the combinations, the guidance and the closing page with the wordmark, using the site colors and fonts.
11. **Renderer** - Implement rendering to bytes with the fonts registered and a 10-second limit that aborts a slow render.
12. **Storage upload** - Implement the path convention and the upsert upload to the private bucket.
13. **PDF tests** - Write the tests that render real samples and read them back: name on the cover, parts in order, A4, 6 to 8 pages, size, render time and the aborted slow render.

**Done when:** `generation-pdf.test.ts` passes on a freshly reset database, and a sample PDF has been written to a temporary folder for the owner's visual review.

## Phase 4: Pipeline, retries and cron

**Goal:** an approved order is generated exactly once, failures retry on the schedule and end in the right state, and the cron and reprocess entries work.
**Covers:** RF-07 Capabilities (start, scoring, idempotency, retries, hooks, reprocess) and Error Handling; Section 9 criteria 1, 2, 4, 5 and 6, and the cross-feature criteria C1 and C2.

14. **Generation pipeline** - Implement the run: refuse unpaid orders, reserve the order, score the answers, load and check the content, compose, render, upload, save the result last, and clear the lease on success.
15. **Failure handling** - Classify failures as fatal or retryable, record each in the automation errors without personal data, schedule or fail through the SQL function, and call the ready hook after success.
16. **Hooks** - Make the RF-06 generation hook run the pipeline with the plain token, and add the ready hook for RF-08 with its do-nothing default.
17. **Cron route and schedule** - Implement the authenticated job route that runs due generations in small batches, add the cron entry in the Vercel configuration and the long-duration setting on the routes that can run the first attempt.
18. **Due runs and reprocess** - Implement the selection of due and stuck orders and the reprocess entry for the admin panel.
19. **Pipeline and hand-off tests** - Write the pipeline, job and hand-off tests of spec Section 7, including overlap, crash recovery, retries on the schedule and the two hand-offs through the real earlier routes.

**Done when:** `generation.test.ts`, `generation-job.test.ts` and `generation-handoff.test.ts` pass on a freshly reset database, and the whole integration suite still passes.

## Phase 5: Full verification

**Goal:** the whole feature is proven end to end on a recreated database and ready for independent verification.
**Covers:** all eight criteria of RF-07 (six own and two as consumer).

20. **Full run** - Recreate the database, run the complete unit and integration suites, the type check and the production build, generate one sample PDF for the owner's review, check that the cron route answers only with the secret, clean up the test data and stored files, and update the status row of RF-07 with the result.

**Done when:** every test named in spec Section 7 passes with none skipped, the type check and the build succeed, the sample PDF exists for review, and the status file shows the final result of the run.
