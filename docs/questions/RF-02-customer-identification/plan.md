# RF-02. Customer Identification: Implementation Plan

Spec: docs/RF-02-customer-identification/spec.md · Complexity: medium · Phases: 3

## Prerequisites

- **Features:** RF-01 (Platform Foundation and Data Model), implemented in the codebase (status `implemented`, not yet verified in a fresh session). Its tables, error and validation helpers, environment readers, layout and Vitest setup are used as they are.
- **Pending Foundation features:** none.
- **Environment:** Docker running, local Supabase started (`npm run db:start`), `.env.local` filled with the local keys and a new `SESSION_SECRET` of at least 32 random characters (generate it locally; never commit it), `APP_PORT=3001` for the dev server, tests run from `D:/...` (upper-case drive) or PowerShell (see `docs/research.md`).
- **Conventions:** commits in English, one per phase (`feat(RF-02): phase N <name>`), status file updated after each phase. This migration is `20260101000005`; after applying it, regenerate the database types. If RF-03 was implemented first, the `server-only` Vitest alias already exists and is reused.
- **Live checks:** none.

## Phase 1: Shared building blocks

**Goal:** the schema, the configuration, the validation rules and the cookie helpers exist and are covered by unit tests, with no visible behavior change.
**Covers:** RF-02 Capabilities (field rules, consent, signed cookie, session secret); Section 9 criteria 2, 3 and 4 at the schema level.

1. **Migration** - Create the migration that adds the idempotency column and the atomic attempt-creation and rate-limit functions (spec Section 6), apply it with a database reset and regenerate the database types.
2. **Session configuration** - Add the `session` environment group with the signing secret and document it in the environment example.
3. **Consent constants** - Define the consent text and its version in one shared module.
4. **Phone helpers** - Implement masking and normalization of the WhatsApp number as pure functions.
5. **Customer schema** - Implement the shared Zod schema with the field rules and the Portuguese messages of the spec, usable by the browser and the server.
6. **Attempt cookie** - Implement signing, verification and the cookie header, plus `readAttemptId` for other routes.
7. **Unit tests** - Write the schema, phone and cookie tests named in spec Section 7.

**Done when:** `customer-schema.test.ts`, `phone.test.ts` and `attempt-session.test.ts` pass, and the type check passes with the regenerated types.

## Phase 2: Registration route

**Goal:** a direct request to the route creates, replays, limits or rejects registrations exactly as the contract says, against the real local database.
**Covers:** RF-02 Capabilities (atomic creation, consent record, idempotency, rate limit, IP hash) and Error Handling; Section 9 criteria 1, 5, 6 and 7.

8. **Attempts data access** - Implement the server-only helpers that find an attempt by idempotency key, create an attempt through the SQL function and apply the rate limit, handling the concurrent-duplicate case.
9. **Route handler** - Implement the `POST` handler: read and validate the body, replay by idempotency key, rate limit by hashed IP, create, set the cookie, and return the documented bodies and status codes.
10. **Test setup** - Add the `server-only` stub and alias to both Vitest configurations when they do not exist yet.
11. **Route integration tests** - Write the route tests of spec Section 7: creation, consent data, cookie, bypass rejection, idempotency, concurrency, rate limit and configuration error.

**Done when:** `attempts-route.test.ts` passes on a freshly reset database, and the whole unit suite still passes.

## Phase 3: Entry page and form

**Goal:** a customer can register from `/diagnostico-estilo` on a phone and is sent to the questionnaire address, with every message of the spec.
**Covers:** RF-02 Experience and Error Handling; Section 9 criteria 1 to 5 (user-visible behavior).

12. **Registration form** - Build the client form with masks, blur and submit validation, focus on the first error, radio cards for the preference, consent with the policy link, idempotency key, disabled submit state and the network and rate-limit messages, using only the site's tokens and classes.
13. **Entry page** - Replace the RF-01 placeholder with the page that holds the title, the offer line and the form, keeping the layout of RF-01.
14. **Full run** - Run the complete unit and integration suites, the type check and the build, then follow the verification script of spec Section 7 in a real browser with the dev server and the local database, and update the status row of RF-02.

**Done when:** every test named in spec Section 7 passes with none skipped, the design-token test still passes, the verification script steps 1 to 10 behave as written, and the status file shows the final result of the run.
