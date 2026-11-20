# Codebase research (batch: wave 2 of PRD-Descubra-Seu-Estilo)

Date: 2026-11-20 · Repository commit: 941d34a · Branch: feat/pagina-coloracao-pessoal-online

**Codebase state:** Foundation complete. RF-01 (Platform Foundation and Data Model) is implemented (status `implemented`, not yet `success`: not verified in a fresh session). Everything marked "RF-01" below exists in the repository. Anything not observed is marked `(inferred)`.

## Layer 1: baseline

| Category | Observation | Where |
|---|---|---|
| Runtime and language | Node 24; TypeScript 5.8 for new code, JSX for the pre-existing site; `allowJs: true`, `strict: false`, no `target` set (ES5 default: `for..of` over arrays works, `.entries()` iteration does not) | `tsconfig.json`, `package.json` |
| Framework and layout | Next.js 14.2.14, App Router; routes in `app/`, shared components in `components/<Feature>/`, server code in `lib/`, alias `@/*` = repository root | `app/`, `components/Coloracao/`, `lib/diagnostico/` |
| Database and access | Supabase local (CLI) with SQL migrations; PostgreSQL 18 tables, RLS on with no policies; browser roles have no privileges; all access through `supabase-js` with the service role in `getSupabaseAdmin()` (`server-only`) | `supabase/migrations/2026010100000{1..4}_*.sql`, `lib/diagnostico/supabase-server.ts` |
| Types | Generated with `npm run db:types` into `lib/diagnostico/database.types.ts` (must be regenerated after every migration) | `package.json` scripts |
| Fixed-value fields | `text` + `CHECK`, mirrored as constants in TypeScript (`STYLES`, `ORDER_STATUSES`, `DELIVERY_PREFERENCES`, ...) | `lib/diagnostico/constants.ts` |
| Authentication | Not implemented yet. Admin login planned with Supabase Auth in RF-10. The customer is identified by a signed HTTP-only cookie planned in RF-02 | PRD RF-02, RF-10 |
| API style | No route exists yet under `app/api/`. Convention fixed by RF-01: JSON bodies, error body `{ "error": { "code", "message", "fields"? } }` built with `apiError(...)`; `ApiError` thrown by `readJson` | `lib/diagnostico/errors.ts`, `lib/diagnostico/validation.ts` |
| Validation | Zod 4 (`zod@^4`); `parseInput(schema, input)` returns `{ ok, data }` or `{ ok: false, fields }` (field key is the dotted path, `_` for root) | `lib/diagnostico/validation.ts` |
| Configuration | Per-group lazy environment readers that throw `ConfigError` naming missing variables, never values: `getDatabaseEnv`, `getPaymentEnv`, `getEmailEnv`, `getAdminEnv`, `getAppEnv`. Variables documented in `.env.example`; `.env.local` is git-ignored; local Supabase keys come from `supabase status -o env` | `lib/diagnostico/env.ts`, `.env.example` |
| Testing | Vitest 5. Unit: `tests/unit/**/*.test.ts` (`npm test`, config `vitest.config.mts`). Integration against the local Supabase: `tests/integration/**/*.test.ts` (`npm run test:integration`, config `vitest.integration.config.mts`, setup `tests/setup/load-env.ts` loads `.env.local` with `process.loadEnvFile`). Integration helpers: `adminClient()`, `anonClient()`, `createCustomer`, `createAttempt`, `createOrder`, `createVersion`, `createQuestion` | `tests/`, `package.json` |
| Error handling | `ConfigError`, `ApiError`, `apiError()`; no global handler yet | `lib/diagnostico/env.ts`, `errors.ts` |
| Folder structure and naming | New code under `app/diagnostico-estilo/`, `app/api/diagnostico/` (inferred for routes, not yet used), `lib/diagnostico/`, `components/Diagnostico/`, `tests/{unit,integration}/diagnostico/`; files `kebab-case.ts`, components `PascalCase.tsx` | repository tree |

## Layer 2: broader patterns

1. **Server-only boundary.** `lib/diagnostico/supabase-server.ts` starts with `import "server-only"`. That package throws when imported outside a React Server environment, so Vitest cannot import any module that imports it unless the alias `server-only` is mapped to an empty module in the Vitest configs. RF-01 tests avoided this by creating their own clients (`tests/integration/diagnostico/helpers.ts`). No alias exists yet. Wave 2 introduces route handlers that need one.
2. **Vitest on Windows.** Running Vitest from a shell whose working directory has a lower-case drive letter (`d:\...`) makes it load two copies of itself and every suite fails with `Cannot read properties of undefined (reading 'config')`. Run tests from `D:/...` (upper-case) or PowerShell.
3. **`@next/env` and tests.** `@next/env` skips `.env.local` when `NODE_ENV=test`; the integration setup therefore uses `process.loadEnvFile(".env.local")`.
4. **Migrations.** Files named `2026010100000N_<name>.sql`, one transaction each, `create table public.<name>`, `references public.<table>(id) on delete cascade|restrict`, `text` + `CHECK ... in (...)`, `set_updated_at()` trigger on mutable tables, RLS enabled and privileges revoked at the end. Default privileges for new tables and functions in `public` are already revoked from `anon` and `authenticated`. Migration 4 holds the "paid order" trigger for `results` and `deliveries`. The next free migration numbers are `...05` onward.
5. **Rate limits table.** `public.rate_limits (key text, window_start timestamptz, count integer, primary key (key, window_start))` exists with no function using it yet. Atomic operations are meant to be SQL functions created by the features that need them (decision of RF-01).
6. **Existing schema facts used by wave 2.** `customers(name 3-120 chars, email lower-case ≤254, whatsapp ~ '^\+55[1-9][0-9]9[0-9]{8}$')`; `purchase_attempts(customer_id, delivery_preference in email|whatsapp|both, ip_hash, expires_at default now()+7 days)`; `consent_records(attempt_id unique, customer_id, consent_text_version, consent_text, accepted_at)`; `questionnaire_versions(version unique, status draft|published|archived, one published at a time)`; `questions(version_id, position ≥1, text, unique(version_id, position))`; `alternatives(question_id, position 1-4, text, style in six keys, weight 1-3, unique(question_id, position))`; `answers(attempt_id, version_id, question_id, alternative_id, unique(attempt_id, question_id))`.
7. **Design system reuse.** Tailwind tokens `primary #10151f`, `secondary #475467`, `accent #937dad`; fonts `font-primary` (Bebas Neue) and `font-secondary` (Inter); global classes `.h1` `.h2` `.h3` `.lead` `.btn` `.btn-accent` `.input` `.textarea` in `app/globals.css`; radius `0.5rem`; shadow `custom`. A test (`tests/unit/diagnostico/design-tokens.test.ts`) fails when a diagnosis file imports another font or defines a hex color literal. Input style: `border-[#d0d5dd]` is inside `.input` already, so diagnosis components must use the class, not the literal.
8. **Diagnosis layout.** `app/diagnostico-estilo/layout.tsx` (Logo, container with `px-6`, privacy link, existing `Footer`, no navigation menu). The page `app/diagnostico-estilo/page.tsx` is a placeholder with `noindex` that RF-02 replaces.
9. **Security headers.** `next.config.mjs` `headers()` adds five headers to `/diagnostico-estilo/:path*` and `/api/:path*`. Dev port for this machine: `APP_PORT=3001` in `.env.local`; start with `npm run dev` (`scripts/dev.mjs`).
10. **Secrets rule.** `tests/unit/diagnostico/no-hardcoded-secrets.test.ts` scans `lib/diagnostico`, `app/diagnostico-estilo`, `components/Diagnostico` and `app/api` for key-like literals and fails on any file under `app/api` whose path contains "simulat".
11. **Existing site conventions.** Client components in the portfolio use `"use client"` and framer-motion; pages are `.jsx`; `metadata` objects are exported from `page.jsx`; Portuguese copy is written inline in the components.
12. **Git and commits.** Commits in English, `feat(RF-NN): phase N <name>` per phase and `docs(status): RF-NN <status>`; the attribution line required by the session is appended. CRLF warnings on Windows are harmless.
13. **Lint.** `next lint` is not configured (no ESLint config); it opens an interactive wizard, so it is not run.
14. **Open points for wave 2 (`(inferred)` decisions are in each spec):** a session secret for the attempt cookie (new variable), the `server-only` alias for Vitest, regenerated database types after each migration, and a seed migration for the first questionnaire version (production needs it too, so it cannot live only in `supabase/seed.sql`).

## Auto-Accept bootstrap decisions

Not applicable: the codebase is not empty. Decisions that every feature of the batch follows are the RF-01 conventions above.
