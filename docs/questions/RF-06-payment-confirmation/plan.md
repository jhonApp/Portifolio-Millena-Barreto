# RF-06. Payment Confirmation: Implementation Plan

Spec: docs/RF-06-payment-confirmation/spec.md · Complexity: medium · Phases: 4

## Prerequisites

- **Features:** RF-05 (Questionnaire Completion and Pix Checkout) implemented in the codebase (status `implemented`, not yet verified in a fresh session); RF-02 and RF-04 through it. Its orders, payments, gateway interface, checkout routes and screen are changed or used as they are.
- **Pending Foundation features:** none.
- **Environment:** Docker running, local Supabase started (`npm run db:start`), `.env.local` filled with the local keys and `SESSION_SECRET`, `APP_PORT=3001` for the dev server, `ENABLE_PAYMENT_SIMULATION=true` for local runs and tests (never in production), tests run from `D:/...` (upper-case drive) or PowerShell. New test-only values in the test process: `ABACATEPAY_WEBHOOK_SECRET` and `ABACATEPAY_WEBHOOK_PUBLIC_KEY` (placeholders). After the migration, regenerate the database types into a temporary file first and copy it over only when it is not empty.
- **Documentation to read at implementation time:** the AbacatePay v2 reference for creating a transparent Pix charge (the create fields are not fixed by the spec), the webhook security page (the public key for the signature) and the transparent-checkout event page. The public key is copied from the official page into the environment, never into the repository.
- **Conventions:** commits in English, one per phase (`feat(RF-06): phase N <name>`), status file updated after each phase. This migration is `20260101000009`. Changes to RF-05 files (gateway, simulated gateway, checkout screen and their tests) keep the existing RF-05 tests passing, adapted only where the v2 move requires it.
- **Manual setup for the owner (not done by this plan):** register the webhook in the AbacatePay dashboard as a v2 webhook (HTTPS public URL of `/api/diagnostico/webhooks/abacatepay`, a secret of 32 or more characters) and set the production values in the Vercel environment. Test and production webhooks are separate.
- **Live checks L1 and L2:** need the owner's explicit approval for each run and a **development-mode** AbacatePay key in `ABACATEPAY_API_KEY` (environment or `.env.local`, never in the repository, never a production key, never pasted in the chat). L2 also needs the owner to simulate the payment in the AbacatePay development dashboard. No AI model is involved and no cost is expected. The plan never runs them on its own; without approval they stay `live pending`.

## Phase 1: Data layer, gateway v2 and approval

**Goal:** the atomic event and approval functions, the v2 gateway with its simulated twin, the confirmation logic, the generation hook and the order guard exist and are proven against the local database and a fake `fetch`, with no visible change for the customer.
**Covers:** RF-06 Capabilities (idempotency, single approval, token, late payment, hard guard) and Provides; Section 9 criteria 1, 3, 6 and 7 at the data level.

1. **Migration** - Create the migration with the event-recording and approval functions (spec Section 6), apply it with a database reset and regenerate the database types.
2. **Env and errors** - Add the webhook env reader for the secret and the public key, and the new error codes, keeping existing readers and codes unchanged.
3. **Gateway v2** - Move the real gateway to the v2 endpoints for creating a charge, add the charge status query with timeout and error mapping, and extend the gateway contract (spec Section 5) while keeping RF-05's behavior.
4. **Simulated gateway** - Give the simulated gateway a status query driven by the paid-after and check-fail variables, so the flow can be followed without a key and a test can make a charge become paid.
5. **Confirmation logic** - Implement the shared verification: match the charge, query the provider, check the amount, approve atomically, create the token hash, call the generation hook only for the winning approval, and record flags and failures in the automation errors.
6. **Hook and guard** - Implement the default generation hook and the order guard with its error type.
7. **Data tests** - Write the SQL, gateway, simulated gateway, guard and env tests of spec Section 7, adapting the RF-05 gateway tests to the v2 shape.

**Done when:** `payment-sql.test.ts`, `order-guard.test.ts`, `abacatepay-gateway.test.ts`, `pix-gateway.test.ts` and the new cases of `env.test.ts` pass on a freshly reset database, and the existing suites still pass.

## Phase 2: Webhook and payment check routes

**Goal:** an authenticated notification and a "Já paguei" call approve the right order exactly once, and the hand-off test proves the RF-05 contract.
**Covers:** RF-06 Capabilities, Experience (server side) and Error Handling; Section 9 criteria 1 to 7, and the cross-feature criterion H1.

8. **Webhook authentication and schema** - Implement the secret and signature verification over the raw body and the tolerant event schema, with their unit tests.
9. **Webhook route** - Implement the handler and the route: read the raw body, authenticate, store the event once, confirm the charge and answer 200, 401, 503 or 500 as the contract says.
10. **Payment check route** - Implement the handler and the route: cookie authentication, latest order, per-order throttle, the shared confirmation, and the documented answers.
11. **Route and hand-off tests** - Write the webhook and check route tests of spec Section 7 and the hand-off test that drives RF-02, RF-04 and RF-05 into a notification.

**Done when:** `webhook-route.test.ts`, `payment-check-route.test.ts`, `webhook-auth.test.ts`, `webhook-schema.test.ts` and `payment-handoff.test.ts` pass on a freshly reset database, and the whole integration suite still passes.

## Phase 3: Checkout screen states

**Goal:** the customer can tap "Já paguei", sees the right message, is moved forward automatically and sees the confirmed and preparing states.
**Covers:** RF-06 Experience; Section 9 criteria 4 and 5.

12. **Checkout state helpers** - Add the check interval, the messages and the view rules to the pure helpers with their unit tests.
13. **Checkout screen** - Enable "Já paguei", call the check route, run the silent automatic check every 5 seconds, and show the not-paid message, the confirmed and preparing states and the verification error, using only the site's tokens and classes.

**Done when:** `checkout-state.test.ts` and the design-token test pass, the type check and the production build succeed, and the browser verification script steps 1 to 7 of spec Section 7 behave as written.

## Phase 4: Full verification

**Goal:** the whole feature is proven end to end on a recreated database and ready for independent verification, with the live checks either run or honestly pending.
**Covers:** all eight criteria of RF-06 (seven own and one as consumer); live checks L1 and L2.

14. **Full run** - Recreate the database, run the complete unit and integration suites, the type check and the production build, follow the verification script once more in a real browser, clean up the test data, ask the owner whether to run live checks L1 and L2, and update the status row of RF-06 with the result.

**Done when:** every test named in spec Section 7 passes with none skipped, the type check and the build succeed, the verification script behaves as written, live checks L1 and L2 (`tests/live/abacatepay-pix.live.test.ts`) either passed with their evidence written or are marked `live pending` with the reason, and the status file shows the final result of the run.
