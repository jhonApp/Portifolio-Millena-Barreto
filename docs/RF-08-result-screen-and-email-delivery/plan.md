# RF-08. Result Screen and E-mail Delivery: Implementation Plan

Spec: docs/RF-08-result-screen-and-email-delivery/spec.md · Complexity: complex · Phases: 5

## Prerequisites

- **Features:** RF-07 (Diagnosis Content and PDF Generation) and RF-06 (Payment Confirmation), both implemented in the codebase (status `implemented`, not yet verified in a fresh session); RF-02 to RF-05 through them. The hook `onDiagnosisReady`, the result token table and `hashToken`, the cron route with `CRON_SECRET`, `deliveries`, `automation_errors`, the bucket `diagnostics` and `hit_rate_limit` are used as they are.
- **Pending Foundation features:** none.
- **Environment:** Docker running, local Supabase started (`npm run db:start`), `.env.local` with the local keys, `SESSION_SECRET`, `CRON_SECRET`, `APP_PORT=3001`, `APP_URL=http://localhost:3001`, `ENABLE_PAYMENT_SIMULATION=true`, `PAYMENT_SIMULATION_PAID_AFTER_SECONDS` (10 to 20) and `ENABLE_EMAIL_SIMULATION=true` for local runs (never in production). Tests run from `D:/...` (upper-case drive) or PowerShell. After the migration, regenerate the database types into a temporary file first and copy it over only when it is not empty.
- **Conventions:** commits in English, one per phase (`feat(RF-08): phase N <name>`), status file updated after each phase. This migration is `20260101000012`. Changes to files of RF-06 and RF-07 (payment check, cron handler, the ready hook) and to the checkout screen are additive and keep their tests passing.
- **Packages:** none (the Resend client uses `fetch`).
- **Images:** the six editorial images are not supplied (owner decision); the screen shows a reserved block and the map `STYLE_IMAGES` stays empty. When the owner supplies them they go in `public/diagnostico/estilos/` and in the map; this plan does not wait for them.
- **Live check L1:** needs the owner's explicit approval for the run, a Resend account with a verified sender domain (`EMAIL_FROM`), a **test or restricted** `RESEND_API_KEY` (environment or `.env.local`, never in the repository, never pasted in the chat) and a recipient address in `LIVE_EMAIL_TO`. One e-mail, no model, no relevant cost. The plan never runs it on its own; without approval it stays `live pending`.
- **Platform:** the same Vercel Pro cron of RF-07 runs the retries; set `APP_URL`, `RESEND_API_KEY` and `EMAIL_FROM` in the Vercel environment before the real launch.

## Phase 1: Foundation: tokens, e-mail provider and template

**Goal:** the result tokens, the e-mail template and the provider (real and development) exist and are proven in isolation, and the delivery state exists in the database, with no visible change for the customer.
**Covers:** RF-08 Capabilities (token, e-mail contents, providers) and Provides (delivery records) at the data level; Section 9 criteria 4 and 6 at the unit and SQL level.

1. **Delivery migration** - Create the migration with the claim, complete, fail and reset functions for the e-mail delivery (spec Section 6), apply it with a database reset and regenerate the database types.
2. **Constants, env and paths** - Add the token lifetime, the delivery limits and delays, the signed URL lifetime, the app URL reader, the result paths, the new error code, the new variables in the example env file and the ignored mail folder.
3. **Result tokens** - Implement token generation, minting with the stored hash and 30-day expiry, lookup that rejects unknown, expired and revoked tokens, and the link builder.
4. **E-mail template** - Implement the pure template: subject, HTML and plain text with the first name, both styles, the short result text and the secure link, with escaping.
5. **E-mail providers** - Implement the provider contract and selector, the Resend client with timeout and error mapping, the development provider that writes files, and the simulation guard.
6. **Foundation tests** - Write the unit tests of spec Section 7 for the template, the providers, the tokens, the schemas and the env reader, and the SQL tests for the four delivery functions.

**Done when:** `diagnosis-email.test.ts`, `resend-provider.test.ts`, `email-provider.test.ts`, `result-token.test.ts`, `result-requests-schema.test.ts`, the new cases of `env.test.ts` and `delivery-sql.test.ts` pass on a freshly reset database, the type check passes, and the existing suites still pass.

## Phase 2: Delivery pipeline, hook and cron

**Goal:** a generated diagnosis is e-mailed exactly once, failures retry on the 1, 5 and 15 minute schedule and end in the right state, and the cron and the admin retry entry work.
**Covers:** RF-08 Capabilities (delivery, retries, DELIVERED) and Error Handling (provider failure, attachment limit); Section 9 criteria 4, 5 and 6.

7. **Storage helpers** - Add the signed PDF URL (300 seconds) and the PDF size check to the storage module.
8. **Delivery pipeline** - Implement the run: reserve the delivery, mint the token when none came, build the e-mail, attach the PDF within 2 MB or send the link only, send, and complete or schedule the retry or end the delivery, recording automation errors without personal data.
9. **Hook, cron and retry** - Make the RF-07 ready hook run the pipeline, extend the cron job to run due deliveries and orders with a result but no delivery, and add the retry entry for the admin panel.
10. **Pipeline tests** - Write the delivery tests of spec Section 7, including preferences, retries, the attachment limit, overlap and the cron addition.

**Done when:** `delivery.test.ts` and the changed `generation-job.test.ts` pass on a freshly reset database, and the whole integration suite still passes.

## Phase 3: Result screen and PDF download

**Goal:** a customer with a valid link sees the result on a phone, can download the PDF through a short-lived signed URL, and any invalid link shows only the expired-link message.
**Covers:** RF-08 Capabilities (result screen, token rules, PDF download) and Experience; Section 9 criteria 1, 2, 3 and 8.

11. **Result page data** - Implement the loader that resolves a token into the invalid, unpaid, preparing or ready state from the order, its payment and its result.
12. **PDF route** - Implement the route that validates the token, rate limits per token and returns the 300-second signed URL, with no details on failure.
13. **Result screen** - Build the server page and the client view with the reference layout, the reserved image block and the style-image map, the entry animation, the always-visible PDF button, the preparing refresh and the expired-link state, using only the site's tokens and classes.
14. **Result tests** - Write the page-data and PDF-route tests of spec Section 7.

**Done when:** `result-page.test.ts` and the PDF cases of `result-routes.test.ts` pass, the design-token and security-header tests pass, the type check and the production build succeed, and the browser verification script steps 1, 2, 5, 6 and 7 of spec Section 7 behave as written.

## Phase 4: Re-request page and the waiting-screen bridge

**Goal:** a customer who lost the e-mail can ask for a new link without anyone learning whether an e-mail exists, and the waiting screen moves to the result by itself.
**Covers:** RF-08 Capabilities (link re-request, delivery to the registered e-mail) and Experience; Section 9 criteria 5 and 7, and the cross-feature criterion H1.

15. **Link route** - Implement the cookie-authenticated route that mints a fresh token for the latest paid order with a result and answers the result path, with its rate limit.
16. **Re-request route** - Implement the route that always answers the neutral message, applies the per-e-mail and per-IP limits, and for a customer with a result mints a token and sends the e-mail without touching the delivery record.
17. **Re-request page** - Build the page and the form with the neutral message, using only the site's tokens and classes.
18. **Waiting-screen bridge** - Add `resultReady` to the payment check answer and make the checkout screen request a link and navigate to the result when it is ready.
19. **Bridge and hand-off tests** - Write the remaining route tests of spec Section 7 and the hand-off test that drives the real RF-02 to RF-07 flow into the result link.

**Done when:** `result-routes.test.ts`, the changed `payment-check-route.test.ts` and `result-handoff.test.ts` pass on a freshly reset database, and the browser verification script steps 1, 3, 4, 8 and 9 behave as written.

## Phase 5: Full verification

**Goal:** the whole feature is proven end to end on a recreated database and ready for independent verification, with the live check either run or honestly pending.
**Covers:** all nine criteria of RF-08 (eight own and one as consumer); live check L1.

20. **Full run** - Recreate the database, run the complete unit and integration suites, the type check and the production build, follow the whole verification script once more in a real browser, clean up the test data, the stored files and the mail folder, ask the owner whether to run live check L1, and update the status row of RF-08 with the result.

**Done when:** every test named in spec Section 7 passes with none skipped, the type check and the build succeed, the verification script behaves as written, live check L1 (`tests/live/resend-email.live.test.ts`) either passed with its evidence written or is marked `live pending` with the reason, and the status file shows the final result of the run.
