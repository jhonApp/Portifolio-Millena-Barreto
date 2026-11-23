# Evaluation: RF-01 Two-Choice Answers and Weighted Scoring

## Cycle 1 of 2: failed evaluation
Date: 2026-11-23
Commit evaluated: 63d0543, branch feat/result-consultancy-cta, base 13420c5
Judging: model-assisted (complexity medium, two gates fired)
Overrides: `approved: schema`, `approved: dependencies` (owner, 2026-11-23)

### Deterministic checks
| Check | Result | Evidence |
|---|---|---|
| Full suite (lint, typecheck, tests) | fail | `npm run lint` exit 0 (6 old warnings, none in RF-01 files). `npm run typecheck` exit 0. `npm test` (unit): 43 files, 294/294. `npm run test:integration` (whole suite, project command): 40 files passed, 1 failed; 440/441. The failure is `payment-sql.test.ts › approve_order stores only the token hash and a 30 day expiry` (RF-06): `expected 30.000000034722223 to be less than or equal to 30`, about 3 ms between the clock of the database container and the host. The file passed 3 of 3 reruns on its own |
| Named tests exist and ran | pass | Every test named in the spec's Testing Strategy ran and passed (unit and integration, checked in the verbose report). One name differs: the spec says `retry delays stay 500, 1500 and 3000 ms`, the test is `retry delays are 500 1500 and 3000 ms` (same body, a naming adaptation) |
| Test diff against the base | pass | RF-01 commits (`a997825..39f1268`) add no skip, todo or xfail and remove no assertion. Removed lines: two imports and one key check in `question-bank.test.ts`, which now also expects `maxChoices` and asserts it is 1 for version 1 (stricter, not looser) |
| Architecture contracts | pass | No architecture-test configuration |
| Component Overview | pass | All 21 files exist; exports and contracts found: `ScoringRules`, `DEFAULT_RULES`, `scoreAnswers`, `getScoredAnswers`, `getScoringRules`, `saveAnswer`, `getSavedChoices`, `CHOICE_NOT_ALLOWED`, `SavedChoice`, `nextChoices`, `canAdvance`, `createTwoChoiceFixture`, `pinAttemptToVersion`, `cleanupFixture`, and the migration with the four rule columns, `second_alternative_id`, the check and the new `save_answer` |
| Live evidence | n/a | Spec: no live checks |

### Criteria
- ✓ 1. One tap marks "1ª escolha" and enables "Próxima" (questionnaire-state `nextChoices: a first tap…`, `canAdvance…`, view test `a saved first choice shows "1ª escolha"`; browser: the first tap shows "1ª escolha" and enables Próxima, which was disabled before)
- ✓ 2. A different card becomes "2ª escolha" and is saved (state test; `answers-route › saves a second choice and returns the answered count`; `two-choice-sql › saves a first and a second choice in one row`; browser: the second card shows "2ª escolha", and after going back the same labels come back)
- ✓ 3. Tapping "2ª escolha" removes it (state test; `answers-route › a null secondAlternativeId clears…`; browser: A "1ª", B "2ª", tap B leaves only A labelled)
- ✓ 4. A third card replaces the second choice (state test; `two-choice-sql › a new second alternative replaces the previous one`; browser: a third card took the "2ª escolha" and the old second was cleared; tapping the first card while a second exists promoted the second)
- ✓ 5. 2 points per first choice, 1 per second, total 30 to 42 (scoring-two-choice: `first choice gives 2 points and second gives 1`, `an attempt of 12 two-choice questions and 3 duels totals between 30 and 42`)
- ✓ 6. Only first choices rank like single choice (scoring-two-choice test)
- ✓ 7. Tie-break by points in steps 11 to 15, then the fixed order (three tests, including the `answers` basis)
- ✓ 8. The secondary style has at least 2 points (property test, seeded, 5000 cases plus the 30 style pairs)
- ✓ 9. Repeated alternative or alternative of another question is refused (three `two-choice-sql` refusals and `answers-route › answers 400 on the second choice rejections`, real database)
- ✓ 10. A version 1 attempt scores as before (`default rules give the same result as the version 1 engine for 1000 random attempts`; `scoring.test.ts` and `generation-handoff.test.ts` pass)
- ✓ 11. Failed save: offline message and advancing blocked (`retry delays…` test; browser with the answers request aborted: "Sem conexão. Suas respostas já salvas estão seguras. Tente novamente.", Próxima disabled, a retry button; after the network returned, the retry cleared the message and enabled Próxima)
- ✓ 12. Incomplete attempt goes back to the first unanswered step (`answers-lib › second choices do not change the first unanswered position`, `checkout-route › an incomplete attempt is refused…`; browser: opening the completion path with 3 of 15 answered redirected to `/diagnostico-estilo/perguntas?aviso=incompleto` and the questionnaire resumed at the first unanswered question)

Criteria: 12/12. The status is `failed evaluation` because of the deterministic check above, not because of a criterion. RF-01 owns no hand-off test as consumer (spec).

### Application run
- Environment: the local Supabase stack, version 2 published temporarily (owner authorized this run; its regular questions already have `max_choices = 2` and the rules 2, 1 and points), dev server on port 3003, headless Chromium at 360 px (and 1280 px), two test customers created through `POST /api/diagnostico/attempts` (201). Afterwards version 1 was republished and version 2 put back to draft (ids, status and `published_at` equal the snapshot taken before), both test customers deleted, the server on 3003 stopped. The database state after the integration suite also equalled the state before it.
- Verification script step 1 (criterion 1): ok. Question 1 shows four cards, the hint "Se mais de uma opção combina com você, escolha uma segunda. É opcional." and Próxima disabled.
- Steps 2 and 3 (1, 2): ok. Step 4 (2): ok; after a reload the questionnaire resumes at the first unanswered question (2), and "Anterior" shows question 1 with "1ª" and "2ª" restored.
- Steps 5, 6 and 7 (3, 4, 2): ok. The order of the script was not followed literally because the reload moved me to question 2, so the same rules were checked on questions 2 and 3.
- Step 8 (11): ok, exact message as in the spec.
- Step 9 (single choice unchanged): differs in method. The spec asks to set `max_choices` back to 1 on a regular question of a disposable database, which is not possible here (the app reaches only the `postgres` database of the local stack, and I do not modify version 1 or its questions). I checked a single-choice step of version 2, the duel at step 5: two taps leave only the last look selected, with no "1ª/2ª escolha" label and no hint. The regular single-choice rendering is covered by the view test `a single-choice question is unchanged: radio group, no labels, no hint`.
- Step 10 (12): ok with a copy difference: the notice reads "Faltam algumas respostas para concluir." (the spec's inferred copy was "Faltou uma resposta. Vamos terminar?").
- Extra checks by the evaluator: keyboard (Space on a focused card changes the choice), 360 px with scrollWidth 360 and 1280 px with scrollWidth 1280, no style name or point value in the page text, and the answers response body is only `{"answeredCount":N}`.

### Gates
- schema: fired (migration `20260101000018_two_choice_answers.sql`). Approved by the owner on 2026-11-23.
- dependencies: fired (`package.json` changed since the base). Approved by the owner on 2026-11-23.
- security, adr, architecture-contract: not fired.

### Findings
1. `payment-sql.test.ts › approve_order stores only the token hash and a 30 day expiry` (an RF-06 test, not changed by RF-01) failed once in the whole integration suite: `days` was 30.0000000347 against `toBeLessThanOrEqual(30)`, because the database clock was about 3 ms ahead of the host clock when the test ran. It passed in the RF-03 verification run and in 3 reruns. It is a real defect of the test (it compares a database timestamp with the host clock without tolerance), so it can fail again. Fix hint: compare with a small tolerance, for example `toBeLessThanOrEqual(30.001)`.
2. Naming: the spec test `retry delays stay 500, 1500 and 3000 ms` is `retry delays are 500 1500 and 3000 ms` in the code. Spec wording only.
3. Spec copy: the incomplete-attempt notice in the product is "Faltam algumas respostas para concluir." (spec: "Faltou uma resposta. Vamos terminar?", marked inferred). Spec wording only.

### Soft-fails
- Verification script prerequisite not met as written: no disposable per-session database (the app and the tests reach only the local stack's `postgres` database), so step 9 was checked on a duel (see above).

### What I did not verify
- Real mobile devices, other browsers, real screen readers (only the keyboard and the labels in the DOM), `next build`.
- The wording of the labels and the hint, which belongs to Millena.
- The 14-of-15 case of step 10 literally (checked with 3 of 15 answered).
- Whether another session used the shared database during the minutes when version 2 was published.

Next step: run `implement-feature` on RF-01 again to fix finding 1, then `verify-feature` (cycle 2 of 2).
