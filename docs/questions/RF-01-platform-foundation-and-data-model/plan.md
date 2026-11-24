# RF-01. Platform Foundation and Data Model: Implementation Plan

Spec: docs/RF-01-platform-foundation-and-data-model/spec.md · Complexity: complex · Phases: 5

## Prerequisites

- **Features:** none. RF-01 is the only Wave 1 feature and the Foundation feature of the PRD (Section 8, Part 2). The project is greenfield for infrastructure: no Supabase project, no migrations, no validation library and no tests exist today.
- **Pending Foundation features:** none besides RF-01 itself.
- **Environment:** Docker Desktop running (it was stopped when the spec was written), Node 24 (already installed) and the Supabase CLI added as a dev dependency by step 1.
- **Settings:** copy `.env.example` to `.env.local` (git ignores it), set `APP_PORT=3001` (first free port above 3000, per the owner's rule), and paste the local Supabase keys printed by `supabase start`. No real key, token or password is written to the repository or printed in logs.
- **Conventions:** commits in English, one commit per phase; the project has no commit convention file. Migrations are named `<timestamp>_<name>.sql` and never edited after being applied; changes go in a new migration. Only databases created for this task are reset or removed.
- **Live checks:** none.

## Phase 1: Tooling and local environment

**Goal:** the project can install the new dependencies, run Vitest and start a local Supabase, with no behavior change for the existing portfolio pages.
**Covers:** RF-01 Capabilities (new code location, test configuration); supports criteria 1 to 4 by providing the test runner.

1. **package.json** - Add the runtime dependencies (`@supabase/supabase-js`, `zod`, `server-only`) and the dev dependencies (`vitest`, `supabase`), plus the scripts for tests, local database and type generation. The existing scripts keep working.
2. **Dev script** - Add a small start script that reads `APP_PORT` and launches `next dev` on it, falling back to 3000, so the dev port lives in the env file as the owner's rules ask.
3. **Vitest configuration** - Create the unit and the integration configurations and the setup file that loads `.env.local`, as described in spec Section 4 (Tooling and configuration).
4. **Supabase project** - Initialize the local project (config file and migrations folder) with the default ports and Storage enabled.
5. **Environment example** - Create `.env.example` with every variable of spec Section 1 and a one-line description each, with placeholders only, and extend the README with the setup guide and the credentials checklist.

**Done when:** `npm run test` runs Vitest with zero tests without error, `supabase start` brings up the local stack, and `npm run build` still succeeds for the existing pages.

## Phase 2: Server configuration modules

**Goal:** the server modules every later feature imports exist, are typed and are covered by unit tests.
**Covers:** RF-01 Capabilities (environment validation, no hard-coded credentials, production guard, validation library, error format); Section 9 criteria 2 and 4.

6. **Shared constants** - Define the six styles, the order, payment and delivery states, the delivery preferences and channels, the failure reasons and the price in cents, as in spec Section 4 (Backend).
7. **Environment configuration** - Implement the per-group Zod validation and the `ConfigError` that lists the missing variable names without values, per spec Section 5.
8. **Payment-simulation guard** - Implement the function that is always disabled in production and enabled only outside production with the development flag.
9. **Error format** - Implement the API error helper and the error codes, producing the documented body (spec Section 5).
10. **Input validation** - Implement the helper that parses input with a Zod schema into data or field errors, and the JSON reader with a body size limit.
11. **Supabase server clients** - Implement the server-only service-role client and the anon client, both reading their keys through the environment module and never persisting sessions.

**Done when:** `env.test.ts`, `payment-simulation.test.ts`, `validation.test.ts`, `constants.test.ts` and `no-hardcoded-secrets.test.ts` (spec Section 7) pass.

## Phase 3: Data model

**Goal:** a fresh local database created from the migrations contains the full schema, the paid-order rule and the private bucket.
**Covers:** RF-01 Capabilities (schema entities, private Storage bucket, paid-order guard); supports criterion 1.

12. **Core schema migration** - Create customers, purchase attempts, consents, questionnaire versions, questions, alternatives and answers with their constraints and indexes (spec Section 6, migration 1).
13. **Orders and delivery migration** - Create orders, payments, webhook events, results, deliveries and result tokens (spec Section 6, migration 2). The idempotency key of webhook events and the order and delivery states are part of this contract shared with RF-06 and RF-07.
14. **Content and operations migration** - Create content versions and templates, automation errors, deletion requests and rate limits (spec Section 6, migration 3).
15. **Integrity rules** - Add the `updated_at` triggers and the rule that blocks a result or a delivery for an order that is not approved (spec Section 6, migration 4).
16. **Access lockdown** - Enable row-level security on every table, revoke browser-role privileges and create the private PDF bucket with its type and size limits (spec Section 6, migration 4).
17. **Generated types** - Generate the table types from the local database into the shared types file and add the script that refreshes them.

**Done when:** `supabase db reset` applies the four migrations without error, and `schema.test.ts` passes.

## Phase 4: Security headers and diagnosis shell

**Goal:** the `/diagnostico-estilo` route renders a layout that reuses the site design, and its responses carry the security headers.
**Covers:** RF-01 Capabilities (security headers, design reuse) and Experience (shell, placeholder); Section 9 criterion 3.

18. **Security headers** - Add the header rules for the diagnosis and API route patterns to the Next configuration, keeping the existing configuration and leaving all other pages unchanged (spec Section 1, Business Rules).
19. **Diagnosis layout** - Create the layout with the existing `Logo` at the top, a content container with the required side padding, the privacy link and the existing `Footer`, with no navigation menu and no new font or color (spec Section 4, Frontend).
20. **Placeholder entry page** - Create the temporary `/diagnostico-estilo` page with the title, the "Em breve." line and the `noindex` setting, to be replaced by RF-02.

**Done when:** `security-headers.test.ts` and `design-tokens.test.ts` pass, and the browser verification script steps 1 to 7 of spec Section 7 behave as written.

## Phase 5: Access verification and status

**Goal:** the lockdown, the constraints and the bucket rules are proven against the real local database, and the feature is ready for verification.
**Covers:** Section 9 criteria 1 and 4 (final proof); all four criteria of RF-01.

21. **RLS integration tests** - Prove that the anon and authenticated roles can neither read nor write any of the 18 tables (spec Section 7, criterion 1).
22. **Storage integration tests** - Prove that the bucket is private, accepts only PDF and refuses files over 2 MB.
23. **Full run** - Run the whole unit suite and the whole integration suite on a freshly reset database, run the production build, and run the browser verification script.
24. **Status** - Update the status file row of RF-01 after the run, keeping progress columns consistent with the plan.

**Done when:** `rls.test.ts`, `storage.test.ts`, `schema.test.ts` and every unit test of spec Section 7 pass, `npm run build` succeeds, and no test was skipped.
