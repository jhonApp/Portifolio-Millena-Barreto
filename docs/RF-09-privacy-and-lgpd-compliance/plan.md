# RF-09. Privacy and LGPD Compliance: Implementation Plan

Spec: docs/RF-09-privacy-and-lgpd-compliance/spec.md · Complexity: medium · Phases: 4

## Prerequisites

- **Features:** RF-02 (Customer Identification) and RF-07 (Diagnosis Content and PDF Generation), both implemented in the codebase (status `implemented`, not yet verified in a fresh session), plus RF-06 and RF-08 through them: the consent record, the customer tables, the stored PDFs, the result tokens and deliveries, the `EmailProvider`, `hit_rate_limit`, `clientIpHash`, `CRON_SECRET` and `recordAutomationError` are used as they are.
- **Pending Foundation features:** none.
- **Environment:** Docker running, local Supabase started (`npm run db:start`), `.env.local` with the local keys, `SESSION_SECRET`, `CRON_SECRET`, `APP_PORT`, `APP_URL=http://localhost:<APP_PORT>`, `PRIVACY_CONTACT_EMAIL` (any valid address, it is shown in the policy), `ENABLE_PAYMENT_SIMULATION=true`, `PAYMENT_SIMULATION_PAID_AFTER_SECONDS` (10 to 20) and `ENABLE_EMAIL_SIMULATION=true` for local runs (never in production). Tests run from `D:/...` (upper-case drive) or PowerShell. After the migration, regenerate the database types into a temporary file first and copy it over only when it is not empty. Regenerating makes `orders.attempt_id` nullable in the types, so fix every compile error it exposes (the spec lists `generation.ts` and `delivery.ts`).
- **Conventions:** commits in English, one per phase (`feat(RF-09): phase N <name>`), status file updated after each phase. This migration is `20260101000013`. Changes to files of RF-07 and RF-08 (generation, delivery, diagnosis e-mail, storage, constants, paths, errors) are additive and keep their tests passing.
- **Packages:** none.
- **Live check:** none (spec Section 7: not applicable). The e-mail provider is proven by the RF-08 live check L1, which stays pending until the owner approves it.
- **Before the real launch (owner steps, not part of the implementation):** Millena or a legal adviser reviews the policy text; `PRIVACY_CONTACT_EMAIL` is a monitored address in the Vercel environment together with `APP_URL`, `CRON_SECRET`, `RESEND_API_KEY` and `EMAIL_FROM`; the daily cron entry appears in the Vercel project after the first deploy.

## Phase 1: Foundation: data model and building blocks

**Goal:** the database can erase and purge atomically, and the constants, schemas, policy content, templates and storage helper exist and are proven in isolation, with no visible change for the customer.
**Covers:** RF-09 Capabilities (deletion, retention, anonymized payments) and Consumes (consent and contact data, PDF references) at the data level; Section 9 criteria 2, 4 and 5 at the SQL level.

1. **Privacy migration** - Create the migration that makes `orders.attempt_id` nullable with a set-null foreign key, adds the request error column and the two partial indexes, and defines the six privacy functions (spec Section 6); apply it with a database reset and regenerate the database types.
2. **Constants, paths, errors and env notes** - Add the retention periods, the deletion link lifetime, the request limits and the batch sizes, the privacy addresses and messages, the new error code, and the notes in the example env file.
3. **Schemas, policy content and deletion e-mails** - Implement the request body schemas, the typed policy content (numbers taken from the constants) and the pure confirmation and completion e-mail templates with escaping and the policy link.
4. **Storage removal and null-attempt guards** - Add the PDF removal to the storage module and make generation and delivery stop cleanly for an order that has no attempt.
5. **Foundation tests** - Write the unit tests of spec Section 7 for the templates, the schemas, the policy content and the constants, and the SQL tests for the six functions, the nullable foreign key and the lockdown.

**Done when:** `deletion-email.test.ts`, `privacy-requests-schema.test.ts`, `privacy-policy-content.test.ts`, the new cases of `constants.test.ts`, `privacy-sql.test.ts`, and the changed `schema.test.ts` and `rls.test.ts` pass on a freshly reset database, the type check passes, and the existing suites still pass (including the guard cases of `generation.test.ts` and `delivery.test.ts`).

## Phase 2: Erasure and deletion flow

**Goal:** a customer can ask for deletion, confirm it from the e-mail, and have everything erased (files first, database second) with only anonymized payments left, with the neutral answers, limits and failure handling in place.
**Covers:** RF-09 Capabilities (deletion request page and flow) and Error Handling (link expired, deletion fails midway, repeated requests); Section 9 criteria 2 and 3.

6. **Erasure pipeline** - Implement the shared pipeline that plans, removes the PDFs, runs the atomic erase and reports erased, deferred or failed, so it can be retried safely.
7. **Deletion requests** - Implement the request lifecycle: neutral request with limits and e-mail, token lookup, confirmation, processing of every customer of the e-mail, the single completion mark, the completion notice and the clearing of the address, recording automation errors without personal data.
8. **Deletion routes** - Implement the request and confirm routes with validation, limits, the neutral and expired answers and the configuration error, following the RF-08 route pattern.
9. **Deletion tests** - Write the deletion and route tests of spec Section 7, including expiry, in-flight deferral, storage failure, notice retry, limits and idempotence.

**Done when:** `deletion.test.ts` and `deletion-routes.test.ts` pass on a freshly reset database, and the whole integration suite still passes.

## Phase 3: Daily retention job

**Goal:** a daily run finishes pending deletions, deletes unpaid attempts older than 7 days and paid data older than 12 months, cleans stale requests, and answers only counts.
**Covers:** RF-09 Capabilities (daily retention job); Section 9 criteria 4 and 5.

10. **Retention job and route** - Implement `runRetention` with its five steps and batch limits, the protected route with the cron secret and the 60-second limit, and the single daily entry in the Vercel cron configuration, leaving the generation route unscheduled.
11. **Retention tests** - Write the job tests of spec Section 7: authorization, each step, the batch limits, counts only, idempotence and the untouched recent and paid data.

**Done when:** `retention-job.test.ts` passes on a freshly reset database and the whole integration suite still passes.

## Phase 4: Pages, e-mail footer and guarantees

**Goal:** the customer can read the policy, request and confirm the deletion in the browser, the diagnosis e-mail links the policy, and the scope and log guarantees are proven, including the hand-off from the real earlier features.
**Covers:** RF-09 Capabilities (policy page, footer links, scope and logs) and Experience; Section 9 criteria 1 and 6, and the two cross-feature criteria where RF-09 is the consumer.

12. **Policy page and e-mail footer** - Build the policy server page and component from the typed content with the controller and contact lines, indexable and mobile-first, and add the policy link to the footer of the diagnosis e-mail through the template input.
13. **Deletion pages** - Build the request page with its form, and the confirmation page with its button and the completed, pending and expired states, using only the site's tokens and classes.
14. **Scope and log guarantees** - Write the scope test that drives every customer-facing route with another customer's identifiers and the static test that blocks personal data in `console` calls.
15. **Hand-off tests and verification** - Write the two hand-off tests of spec Section 7 over the real flow of RF-02 to RF-08, then run the full verification and the browser verification script of spec Section 7 at 360 px and 1280 px.

**Done when:** `privacy-scope.test.ts`, `no-personal-data-in-logs.test.ts`, `privacy-handoff.test.ts` and the changed e-mail test pass, the full unit and integration suites, the type check and the build pass on a freshly reset database, and the verification script of spec Section 7 passes in a browser.
