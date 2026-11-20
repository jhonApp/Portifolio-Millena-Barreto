# Feature status

Central state of the project. Updated by `spec-writer`, `implement-feature` and `verify-feature`. Read it first when starting a session. A feature is done only when `verify-feature` sets `success`.
Format: see `~/.claude/skills/spec-writer/status-template.md`.

| ID | Feature | Wave | Depends on | Spec | Phases | Criteria | Live | Status | Verified at |
|---|---|---|---|---|---|---|---|---|---|
| RF-01 | Platform Foundation and Data Model | 1 | none | yes | 5/5 | 4/4 | n/a | implemented | 2026-11-20 4e6a8e1 |
| RF-02 | Customer Identification | 2 | RF-01 | yes | 3/3 | 7/7 | n/a | implemented | 2026-11-20 f5f5630 |
| RF-03 | Question Bank and Scoring Engine | 2 | RF-01 | yes | 3/3 | 7/7 | n/a | implemented | 2026-11-20 9d11d05 |
| RF-04 | Interactive Questionnaire | 3 | RF-02, RF-03 | yes | 4/4 | 8/8 | n/a | implemented | 2026-11-20 b317eb6 |
| RF-05 | Questionnaire Completion and Pix Checkout | 4 | RF-02, RF-04 | yes | 4/4 | 7/8 | pending | implemented | 2026-11-20 42fec83 |
| RF-06 | Payment Confirmation | 5 | RF-05 | yes | 4/4 | 6/8 | pending | implemented | 2026-11-20 c6d2ea1 |
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

### RF-04. Interactive Questionnaire
Last run: 2026-11-20, commit b317eb6
- ✓ Question 1: "Anterior" hidden, "Próxima" disabled, label "Pergunta 1 de 15" (questionnaire-state.test.ts::canAdvance is false until the question has a saved answer, progressPercent for question 1 of 15; browser script steps 2, 3)
- ✓ Selecting and tapping "Próxima" shows the next question with a 300 ms transition and advances the progress bar (questionnaire-state.test.ts::transition is 300 ms, progressPercent grows by one fifteenth per question; browser script step 5: full opacity at about 245 ms)
- ✓ Returning to question 3 shows the chosen alternative, and changing it replaces the saved answer (answers-route.test.ts::changing an answer replaces the saved one, answeredCount does not grow when an answer is replaced; browser script step 6)
- ✓ Reloading at question 8 shows the first unanswered question with earlier answers kept (answers-lib.test.ts::firstUnansweredPosition is the first gap, not the count; questionnaire-handoff.test.ts::loadQuestionnaire starts at the first unanswered question and returns the saved answers; browser script step 7)
- ✓ A save failure shows "Não conseguimos salvar sua resposta. Tentando de novo…" and runs 3 retries (questionnaire-state.test.ts::retry delays are 500 1500 and 3000 ms; browser script step 8: 4 requests, then the offline message and the retry button)
- ✓ Opening the questionnaire without the attempt cookie sends the visitor to the registration (answers-lib.test.ts::no cookie yields no active attempt, a tampered cookie yields no active attempt, an expired attempt yields no active attempt; answers-route.test.ts::request without cookie gets 403; browser script steps 1, 10)
- ✓ Hand-off RF-02 to RF-04: a customer registered through RF-02 saves answers only to that attempt (questionnaire-handoff.test.ts::answers saved with the cookie of a real registration belong only to that attempt)
- ✓ Hand-off RF-03 to RF-04: the question shown carries no style or weight (questionnaire-handoff.test.ts::the page state carries the public question set without style or weight; browser script step 11)

### RF-05. Questionnaire Completion and Pix Checkout
Last run: 2026-11-20, commit 42fec83
- ✓ 15 answers saved: the completion screen shows "15 de 15 perguntas respondidas" and "R$ 9,90" (checkout-state.test.ts::formatPrice formats 990 cents as R$ 9,90; checkout-route.test.ts::resolveCheckoutAccess allows an attempt with 15 answers; browser script step 3)
- ✓ Fewer than 15 answers: the visitor is redirected to the first unanswered question with the notice (checkout-route.test.ts::resolveCheckoutAccess redirects an attempt with 14 answers to the questionnaire, POST checkout with 14 answers gets 409 ANSWERS_INCOMPLETE; browser script step 2)
- — Opening the checkout creates exactly one PENDING order and one charge of 990 cents, and reloading creates no second charge (live pending): fake proof passes (checkout-sql.test.ts::first call creates one PENDING order and the charge is attached, two concurrent calls create one order; checkout-route.test.ts::first POST creates one order and one payment of 990 cents, reloading returns the same order and does not call the gateway again; browser script steps 4, 6), but the real AbacatePay answer is not verified: live check L1 (tests/live/abacatepay-pix.live.test.ts) needs the owner's approval and a development-mode key
- ✓ "Copiar código Pix" copies the code and shows "Código Pix copiado!" (checkout-state.test.ts::copy confirmation text is Código Pix copiado!; browser script step 7: clipboard equals the displayed code)
- ✓ Expired Pix: "Seu Pix expirou", old order FAILED (PIX_EXPIRED), "Gerar novo Pix" creates a PENDING order without the questions (checkout-sql.test.ts::an expired Pix marks the order FAILED with PIX_EXPIRED and the payment EXPIRED, renew creates a new PENDING order for the same attempt; checkout-route.test.ts::POST renew after expiry creates a new order and keeps the answers; browser script step 8)
- ✓ No card fields and no payment instrument data stored (checkout-route.test.ts::the payments table holds identifiers, amount, code, image and times only, the checkout answer carries no payment instrument data; abacatepay-gateway.test.ts::the request body has no customer or card data; browser script step 5)
- ✓ Hand-off RF-02 + RF-04 to RF-05: a real registration with 15 saved answers opens a checkout whose order belongs to that customer (checkout-handoff.test.ts::a real registration with 15 saved answers opens a checkout whose order belongs to that customer)
- ✓ Hand-off RF-04 to RF-05: an incomplete answer set sends RF-05 back to the questionnaire (checkout-handoff.test.ts::answers saved by the RF-04 route with one question missing send RF-05 back to the questionnaire)

### RF-06. Payment Confirmation
Last run: 2026-11-20, commit c6d2ea1
- — A paid notification approves the PENDING order after verifying status and amount (live pending): fake proof passes (webhook-route.test.ts::a paid notification approves the PENDING order after verifying status and amount, the order is not approved when the provider says PENDING, an event amount different from 990 is not approved; payment-sql.test.ts::approve_order approves a PENDING order and sets paid_at), but the real AbacatePay v2 answers are not verified: live check L1 (tests/live/abacatepay-pix.live.test.ts) needs the owner's approval and a development-mode key
- ✓ A notification without valid authentication returns 401 and the order is unchanged (webhook-route.test.ts::a notification without proof returns 401 and changes nothing, a wrong secret returns 401, a wrong signature returns 401, a signature over a different body returns 401, a missing secret configuration never accepts a request; webhook-auth.test.ts)
- ✓ The same notification sent 5 times approves once and starts one generation (webhook-route.test.ts::the same notification sent five times approves once and starts one generation; payment-sql.test.ts::record_webhook_event answers duplicate_processed for a repeated id, approve_order called twice approves once and creates one token)
- ✓ "Já paguei" before paying shows "Ainda não identificamos seu pagamento" and the order stays PENDING (payment-check-route.test.ts::an unpaid charge answers pending and leaves the order PENDING, a second call within 5 seconds does not call the provider; checkout-state.test.ts::the not-paid message matches the PRD text; browser script steps 1, 2)
- — "Já paguei" after paying approves the order and the screen moves forward (live pending): fake proof passes (payment-check-route.test.ts::a paid charge approves the order and answers approved, an already approved order answers approved without calling the provider; checkout-state.test.ts::the view moves to confirmed on an approved answer; browser script steps 3, 4, 5: "Pagamento confirmado!" then "Estamos preparando seu diagnóstico…", one token), but live checks L1 and L2 have not run
- ✓ A notification and a "Já paguei" click at the same moment approve once (payment-check-route.test.ts::a notification and a check at the same moment approve once; payment-sql.test.ts::concurrent approve_order calls approve once and create one token)
- ✓ An order that is not APPROVED cannot be used to generate or deliver (order-guard.test.ts::assertOrderApproved refuses PENDING and FAILED orders, assertOrderApproved accepts APPROVED PROCESSING and DELIVERED, a result cannot be inserted for a PENDING order, a delivery cannot be inserted for a FAILED order)
- ✓ Hand-off RF-05 to RF-06: the notification of a charge created by RF-05 approves that order, matched by charge identifier (payment-handoff.test.ts::a real registration, saved answers and checkout produce a charge whose notification approves that order)

