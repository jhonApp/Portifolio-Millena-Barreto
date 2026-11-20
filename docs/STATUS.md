# Feature status

Central state of the project. Updated by `spec-writer`, `implement-feature` and `verify-feature`. Read it first when starting a session. A feature is done only when `verify-feature` sets `success`.
Format: see `~/.claude/skills/spec-writer/status-template.md`.

| ID | Feature | Wave | Depends on | Spec | Phases | Criteria | Live | Status | Verified at |
|---|---|---|---|---|---|---|---|---|---|
| RF-01 | Platform Foundation and Data Model | 1 | none | yes | 2/5 | 0/4 | n/a | in progress | none |
| RF-02 | Customer Identification | 2 | RF-01 | no | none | none | none | not started | none |
| RF-03 | Question Bank and Scoring Engine | 2 | RF-01 | no | none | none | none | not started | none |
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
Last run: none
- — Given the database is set up, when any table is queried from a browser with the public key, then no rows are returned and no write is possible (no run yet)
- — Given a missing required credential, when the application starts or a dependent route is called, then it fails with a clear message naming the missing setting and never uses a hard-coded value (no run yet)
- — Given the site design tokens, when a diagnosis page renders, then it uses the existing theme tokens, Bebas Neue for headings and Inter for body text, and loads no additional font or color set (no run yet)
- — Given the production configuration, when any route is called, then no payment simulation is available (no run yet)
