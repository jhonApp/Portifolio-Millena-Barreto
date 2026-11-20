# Feature status

Central state of the project. Updated by `spec-writer`, `implement-feature` and `verify-feature`. Read it first when starting a session. A feature is done only when `verify-feature` sets `success`.
Format: see `~/.claude/skills/spec-writer/status-template.md`.

| ID | Feature | Wave | Depends on | Spec | Phases | Criteria | Live | Status | Verified at |
|---|---|---|---|---|---|---|---|---|---|
| RF-01 | Platform Foundation and Data Model | 1 | none | yes | 5/5 | 4/4 | n/a | implemented | 2026-11-20 4e6a8e1 |
| RF-02 | Customer Identification | 2 | RF-01 | yes | 0/3 | 0/7 | n/a | spec ready | none |
| RF-03 | Question Bank and Scoring Engine | 2 | RF-01 | yes | 0/3 | 0/7 | n/a | spec ready | none |
| RF-04 | Interactive Questionnaire | 3 | RF-02, RF-03 | no | none | none | none | not started | none |
| RF-05 | Questionnaire Completion and Pix Checkout | 4 | RF-02, RF-04 | no | none | none | none | not started | none |
| RF-06 | Payment Confirmation | 5 | RF-05 | no | none | none | none | not started | none |
| RF-07 | Diagnosis Content and PDF Generation | 6 | RF-02, RF-03, RF-04, RF-06 | no | none | none | none | not started | none |
| RF-08 | Result Screen and E-mail Delivery | 7 | RF-06, RF-07 | no | none | none | none | not started | none |
| RF-09 | Privacy and LGPD Compliance | 7 | RF-02, RF-07 | no | none | none | none | not started | none |
| RF-10 | Admin Access and Operations Dashboard | 8 | RF-02, RF-04, RF-06, RF-07, RF-08 | no | none | none | none | not started | none |
| RF-11 | Manual WhatsApp Delivery | 9 | RF-07, RF-08, RF-10 | no | none | none | none | not started | none |
| RF-12 | Admin Content Management | 9 | RF-03, RF-07, RF-10 | no | none | none | none | not started | none |

## Criteria

### RF-01. Platform Foundation and Data Model
Last run: 2026-11-20, commit 4e6a8e1
- ✓ Given the database is set up, when any table is queried from a browser with the public key, then no rows are returned and no write is possible (rls.test.ts::anon role cannot read any diagnostico table, anon role cannot insert update or delete, authenticated role cannot read or write; storage.test.ts::anon cannot list or download from diagnostics)
- ✓ Given a missing required credential, when the application starts or a dependent route is called, then it fails with a clear message naming the missing setting and never uses a hard-coded value (env.test.ts, no-hardcoded-secrets.test.ts)
- ✓ Given the site design tokens, when a diagnosis page renders, then it uses the existing theme tokens, Bebas Neue for headings and Inter for body text, and loads no additional font or color set (design-tokens.test.ts; browser check at 360 px)
- ✓ Given the production configuration, when any route is called, then no payment simulation is available (payment-simulation.test.ts, no-hardcoded-secrets.test.ts::no simulation route exists under app/api)
