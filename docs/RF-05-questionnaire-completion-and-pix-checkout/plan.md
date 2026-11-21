# RF-05. Questionnaire Completion and Pix Checkout: Implementation Plan

Spec: docs/RF-05-questionnaire-completion-and-pix-checkout/spec.md · Complexity: medium · Phases: 4

## Prerequisites

- **Features:** RF-02 (Customer Identification) and RF-04 (Interactive Questionnaire), both implemented in the codebase (status `implemented`, not yet verified in a fresh session). RF-03 and RF-01 are used through them. The attempt cookie, `getActiveAttemptId`, `getAnswerProgress`, `hit_rate_limit`, the `orders` and `payments` tables, `PRICE_CENTS` and `paymentSimulationEnabled` are used as they are.
- **Pending Foundation features:** none.
- **Environment:** Docker running, local Supabase started (`npm run db:start`), `.env.local` filled with the local keys and `SESSION_SECRET`, `APP_PORT=3001` for the dev server, `ENABLE_PAYMENT_SIMULATION=true` for local runs and tests (never in production), tests run from `D:/...` (upper-case drive) or PowerShell. After the migration, regenerate the database types into a temporary file first and copy it over only when it is not empty.
- **Conventions:** commits in English, one per phase (`feat(RF-05): phase N <name>`), status file updated after each phase. This migration is `20260101000008`. Changes to files of earlier features (env, paths, questionnaire page and component) are additive and keep their tests passing.
- **Live check L1:** needs the owner's explicit approval for the run and a **development-mode** AbacatePay key in `ABACATEPAY_API_KEY` (environment or `.env.local`, never in the repository, never a production key and never pasted in the chat). It makes one real charge request in dev mode; no AI model is involved and no cost is expected. The plan never runs it on its own; without approval it stays `live pending`.

## Phase 1: Data layer and gateway

**Goal:** the atomic checkout functions, the gateway interface with its two implementations and the access rule exist and are proven against the local database and a fake `fetch`, with no visible change for the customer.
**Covers:** RF-05 Provides (order and charge), Capabilities (fixed amount, one order per attempt, lazy expiry, simulation) and Error Handling (gateway failure, no order without a charge); Section 9 criteria 3, 5 and 6 at the data and gateway level.

1. **Migration** - Create the migration with the unique index and the three checkout functions (spec Section 6), apply it with a database reset and regenerate the database types.
2. **Env and paths** - Add the payment-API env reader that needs only the API key and the new paths and notice text, keeping the existing readers unchanged.
3. **Gateway contract** - Implement the gateway interface, its error type and the selector that returns the simulated gateway only when simulation is enabled.
4. **AbacatePay client** - Implement the real client with the request shape, bearer authentication, timeout and error mapping described in spec Section 5, never logging the key.
5. **Simulated gateway** - Implement the simulated client that returns a fake charge, can be made to fail and never reports a payment.
6. **Checkout orchestration** - Implement the access rule and the function that runs the SQL decision, creates the charge, attaches or aborts, and maps the outcomes to results and errors.
7. **Data and gateway tests** - Write the SQL, gateway, selector, env and schema tests of spec Section 7 and the pure checkout helpers with their unit tests.

**Done when:** `checkout-sql.test.ts`, `abacatepay-gateway.test.ts`, `pix-gateway.test.ts`, `checkout-state.test.ts`, `checkout-schema.test.ts` and the new cases of `env.test.ts` pass on a freshly reset database, and the existing suites still pass.

## Phase 2: Checkout routes

**Goal:** a request with the attempt cookie creates, reuses, expires or renews the Pix exactly as the contract says, and the two hand-off tests prove the RF-02 and RF-04 contracts.
**Covers:** RF-05 Capabilities and Error Handling at the API level; Section 9 criteria 2, 3, 5 and 6, and the cross-feature criteria H1 and H2.

8. **Checkout schema** - Implement the optional body schema whose amount field is read only to be ignored and logged.
9. **Route handlers** - Implement the checkout and renew handlers: authenticate by cookie, rate limit, call the orchestration, and return the documented bodies and status codes for success, expired, paid, in progress, incomplete, session, rate-limit and gateway errors.
10. **Route and hand-off tests** - Write the route tests of spec Section 7 and the hand-off tests that drive RF-02's real route and RF-04's real route into RF-05.

**Done when:** `checkout-route.test.ts` and `checkout-handoff.test.ts` pass on a freshly reset database, and the whole integration suite still passes.

## Phase 3: Completion and checkout screens

**Goal:** a customer with 15 answers sees the completion screen, opens the checkout on a phone, sees and copies the Pix, and can generate a new one after it expires; one with fewer answers or no session is sent back.
**Covers:** RF-05 Capabilities, Experience and Error Handling; Section 9 criteria 1 to 6.

11. **Completion page** - Create the server page that resolves access, redirects when needed and renders the summary and the link to the checkout.
12. **Checkout page and component** - Create the server page and the client component with the product, price, benefits, states, QR, copy button, countdown, expired state, error state and "Gerar novo Pix", using only the site's tokens and classes.
13. **Incomplete notice** - Make the questionnaire page and component show "Faltam algumas respostas para concluir." when the address carries the incomplete query.

**Done when:** the design-token test passes, the type check and the production build succeed, and the browser verification script steps 1 to 10 of spec Section 7 behave as written.

## Phase 4: Full verification

**Goal:** the whole feature is proven end to end on a recreated database and ready for independent verification, with the live check either run or honestly pending.
**Covers:** all eight criteria of RF-05 (six own and two as consumer); live check L1.

14. **Full run** - Recreate the database, run the complete unit and integration suites, the type check and the production build, follow the verification script once more in a real browser, clean up the test data, ask the owner whether to run live check L1, and update the status row of RF-05 with the result.

**Done when:** every test named in spec Section 7 passes with none skipped, the type check and the build succeed, the verification script behaves as written, live check L1 (`tests/live/abacatepay-pix.live.test.ts`) either passed with its evidence written or is marked `live pending` with the reason, and the status file shows the final result of the run.
