# Feature status

Central state of the project. Updated by `spec-writer`, `implement-feature` and `verify-feature`. Read it first when starting a session. A feature is done only when `verify-feature` sets `success`.
Format: see `~/.claude/skills/spec-writer/status-template.md`.

| ID | Feature | Wave | Depends on | Spec | Phases | Criteria | Live | Status | Verified at |
|---|---|---|---|---|---|---|---|---|---|
| RF-01 | Platform Foundation and Data Model | 1 | none | yes | 5/5 | 4/4 | n/a | implemented | 2026-11-20 4e6a8e1 |
| RF-02 | Customer Identification | 2 | RF-01 | yes | 3/3 | 7/7 | n/a | implemented | 2026-11-20 f5f5630 |
| RF-03 | Question Bank and Scoring Engine | 2 | RF-01 | yes | 3/3 | 7/7 | n/a | implemented | 2026-11-20 9d11d05 |
| RF-04 | Interactive Questionnaire | 3 | RF-02, RF-03 | yes | 3/4 | 0/8 | n/a | in progress | none |
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

### RF-02. Customer Identification
Last run: 2026-11-20, commit f5f5630
- ✓ Empty form: every field shows its error and no attempt is created (customer-schema.test.ts::empty input yields an error for every field; attempts-route.test.ts::empty body creates no attempt; browser script step 2)
- ✓ Name "Maria" on blur shows "Informe seu nome completo" (customer-schema.test.ts::a single word name is rejected with the name message; browser script step 3)
- ✓ WhatsApp "(11) 1234-5678" is rejected (phone.test.ts::normalizeWhatsapp rejects a landline-length number; customer-schema.test.ts::whatsapp without the ninth digit is rejected; browser script step 4)
- ✓ Valid data with consent unchecked is blocked with the consent message (customer-schema.test.ts::consent false is rejected with the consent message; browser script step 5)
- ✓ Valid data and consent store attempt, consent version and timestamp, and the questionnaire address opens (attempts-route.test.ts::valid submission creates customer attempt and consent, consent stores text version and accepted_at, response sets a signed HttpOnly cookie; browser script step 6)
- ✓ Direct request with invalid data is rejected with field errors (attempts-route.test.ts::invalid data sent directly gets 400 with field errors, non-JSON body gets INVALID_JSON, oversized body gets PAYLOAD_TOO_LARGE)
- ✓ The 11th registration from one IP in an hour is refused with the rate-limit message (attempts-route.test.ts::the eleventh registration from one IP in an hour gets 429 with Retry-After, replaying an idempotency key does not count against the limit)

### RF-03. Question Bank and Scoring Engine
Last run: 2026-11-20, commit 9d11d05
- ✓ Active set has 15 questions with 4 alternatives each, six styles, each style in exactly 10 questions (question-bank.test.ts::active set has 15 questions with 4 alternatives each, each style appears in exactly 10 questions, six styles in total and no sexy)
- ✓ The public question set contains no style or weight (question-bank.test.ts::public question set contains no style or weight; the HTTP response check belongs to the RF-04 hand-off test)
- ✓ Elegante with 6 points and Tradicional with 4 give Elegante predominant and Tradicional secondary (scoring.test.ts::elegante with 6 points and tradicional with 4 gives that order)
- ✓ A tie is broken by more answers in questions 11 to 15 (scoring.test.ts::tie is broken by more answers in questions 11 to 15, tie-break applies to the secondary pick too)
- ✓ A tie still equal after questions 11 to 15 falls to the fixed order (scoring.test.ts::tie still equal falls to the fixed order, fixed order is elegante tradicional romantico esportivo criativo dramatico)
- ✓ The same answers scored 100 times give identical results (scoring.test.ts::same answers scored 100 times give identical results, answer order does not change the result)
- ✓ Past answers are scored with the version stored on them after a new version is published (question-bank.test.ts::past answers are scored with the version stored on them)
