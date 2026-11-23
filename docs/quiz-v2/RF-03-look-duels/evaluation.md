# Evaluation: RF-03 Look Duels

## Cycle 2 of 2: success
Date: 2026-11-23
Commit evaluated: ca471d0, branch feat/result-consultancy-cta, base 13420c5
Judging: deterministic first, then model-assisted per criterion (browser-driven criteria and fired gates)
Overrides: none
Starting state: `evaluation.md` (the cycle 1 output of this skill) was the only untracked file; no other change.

### Deterministic checks
| Check | Result | Evidence |
|---|---|---|
| Full suite (lint, typecheck, tests) | pass, with soft-fails | `npm run typecheck` exit 0. `npm test`: 294/294 (the earlier timeout did not repeat). `npm run test:integration` with the project command, no extra flag: 8 files, 85/85 (duel, questionnaire-v2, two-choice, answers). Lint still cannot run (no ESLint config). The rest of the integration suite was not run (see Soft-fails) |
| Named tests exist and ran | pass | The 14 tests named in the spec ran and passed: duel-looks (4), duel-step-view (8), duel-public-set (5), duel-look-route (4), duel-handoff (2). None skipped |
| Test diff against the base | pass | Since cycle 1 only `consultancy-cta.test.ts` changed (a 30 s timeout added, no assertion touched). No new skip, todo or xfail. The earlier `questionnaire-handoff.test.ts` change is still an exact key check |
| Architecture contracts | pass | No architecture-test configuration |
| Component Overview | pass | Unchanged since cycle 1: all files exist; commits after e539b8a touch only `vitest.integration.config.mts`, one test and `STATUS.md` |
| Live evidence | n/a | Spec: no live checks |

### Criteria
- ✓ 1. Steps 5, 10 and 15 each show 2 looks and one can be selected (duel-public-set and duel-step-view tests; browser: two radios and two images at steps 5, 10 and 15)
- ✓ 2. Tapping a look shows border and checkmark, enables forward, saves (duel-step-view test; browser: tap changes the checked radio, ✓ on the selected card only, Próxima enabled after the save, selection restored with "Anterior")
- ✓ 3. Chosen style gets 2 points, the other 0 (duel-handoff, real database)
- ✓ 4. No style name or key in address, alt text or response (three tests; browser: src is `/api/diagnostico/duel-look/<uuid>`, no `Content-Disposition`, no style word in the duel markup)
- ✓ 5. At 360 px stacked, whole, uncropped, no horizontal scroll (duel-step-view test; browser: scrollWidth 360, images 278×347 and 278×494 with ratios 0.801 and 0.563 matching the files 800×999 and 765×1360, stacked at 360 px and side by side at 1280 px; screenshot `c2-step2-360.png`)
- ✓ 6. A look that fails to load shows a neutral block and stays answerable (duel-step-view test; browser with the image route aborted: no image loaded, captions shown, a card was selected and Próxima enabled)
- ✓ 7. Reduced motion: no slide or fade (browser, page reloaded after emulation: only `opacity 1, transform none` under `reduce`; opacity 0 to 1 with a slide under `no-preference`)
- ✓ 8. Screen reader names each look neutrally with its state (duel-step-view test; browser: radiogroup named by the question, radios "Look de referência A/B", arrow keys change the choice)
- ✓ 9. RF-02 to RF-03 hand-off (duel-handoff, nothing mocked)
- ✓ 10. RF-01 to RF-03 hand-off (duel-handoff, real database)

Criteria: 10/10.

### Application run
- Environment: version 2 published temporarily (owner approved this run), dev server on port 3003, headless Chromium at 360 and 1280 px, test customer created through `POST /api/diagnostico/attempts` (201). Afterwards version 1 was republished and version 2 returned to draft (ids, status and `published_at` equal the snapshot taken before), the test customer was deleted and the server on 3003 stopped. The process on port 3002 is not mine and was not touched.
- Route `GET /api/diagnostico/duel-look/<id>`: 200, `image/jpeg`, `Cache-Control: public, max-age=31536000, immutable`; `…/not-a-uuid`: 404.
- Verification script steps 1 to 8: ok. Step 3 differs in wording only (after a reload the questionnaire resumes at step 6, and the saved look is shown selected after "Anterior"; same as cycle 1, finding 4).
- Note: the order of the two looks is shuffled per attempt (this attempt got "Look B" first), as the spec says.
- Extra check by the evaluator: a first measurement under `reduce` without reloading the page showed animated states, because the setting is read when the page loads. Repeated with a reload, as above, it was static. This is a limit of my measurement, not a defect.

### Gates
- schema: fired by `base..HEAD` (migrations `20260101000018_two_choice_answers.sql` and `20260101000019_questionnaire_v2.sql`, from RF-01 and RF-02). Not approved.
- dependencies: fired by `base..HEAD` (`package.json`, from RF-01/RF-02 commits). Not approved.
- security, adr, architecture-contract: not fired.

### Findings
1. Cycle 1 findings 1 and 3 are fixed (the integration command runs as configured; the PDF test no longer times out in the full run).
2. `npm run lint` still cannot run: the repository has no ESLint configuration. Open from cycle 1 (finding 2).
3. Spec Section 7 step 3 still says the look is selected "after a reload" (cycle 1, finding 4). Spec wording only.

### Soft-fails
- Lint: no configuration.
- Integration suite: only the 8 files related to this feature and its dependencies were run (owner's choice, shared local database). The other integration files were not run, so "the whole suite" is not met.
- No per-session database: the tests and the app only reach the `postgres` database of the local Supabase stack.

### What I did not verify
- Real mobile devices, other browsers, real screen readers, the visual quality of the photos (owner's).
- `next build` and the file tracing on a deployed build; only the dev server was run.
- RF-01 and RF-02 beyond the hand-off tests, and the remaining integration tests.
- Whether another session used the shared database during the minutes when version 2 was published.

**To reach `success`, the owner has to decide:** (a) approve or reject the gates `schema` and `dependencies` (`approved: schema`, `approved: dependencies`); (b) add an ESLint configuration or accept that lint does not exist; (c) allow the full integration suite on the shared database. This was the last allowed cycle.

### Re-check after approval (closing cycle 2): success
Date: 2026-11-23
Commit evaluated: 5465c78 (adds the ESLint configuration on top of ca471d0), branch feat/result-consultancy-cta, base 13420c5
Owner input: `approved: schema`, `approved: dependencies` (2026-11-23), full integration suite on the shared local database allowed.
Reading of the cycle limit: cycle 2 ended in `needs human` waiting for these approvals, and Step 1.2 of the skill lists `needs human` as a valid start for a re-check after approval, so this closes cycle 2 and is not a third cycle.

| Check | Result | Evidence |
|---|---|---|
| Lint | pass | `npm run lint` exit 0, 6 warnings, no error (2 `exhaustive-deps` in Checkout.tsx, 4 `alt-text` on the react-pdf `Image` in diagnosis-pdf.tsx; none in RF-03 files) |
| Typecheck | pass | `tsc --noEmit` exit 0 |
| Unit tests | pass | 43 files, 294/294 |
| Integration tests, whole suite, project command | pass | 41 files, 441/441, none skipped. The local database was checked before and after: versions 1 and 2, orphan orders and customer count are identical |
| Named tests, test diff, Component Overview | pass | Unchanged since cycle 2: `ca471d0..5465c78` touches only `.eslintrc.json`, `package.json` and `package-lock.json` |
| Criteria | 10/10 ✓ | Same mapping as cycle 2; the mapped integration and unit tests passed again in this run |
| Gates | schema: approved by the owner on 2026-11-23. dependencies: approved by the owner on 2026-11-23 (this also covers the ESLint devDependencies added in 5465c78). security, adr, architecture-contract: not fired |

Browser script, rerun on 5465c78 (owner authorized publishing version 2 for this run): version 2 published temporarily, dev server on port 3003, headless Chromium at 360 px and 1280 px, test customer created through the API (201).
- Step 1 (criterion 1): ok. "Pergunta 5 de 15", two looks with captions "Look A" and "Look B", Próxima disabled.
- Step 2 (1, 5): ok. scrollWidth 360; image boxes 278×494 and 278×347, ratios 0.563 and 0.801 equal the files (765×1360 and 800×999), `object-fit: fill` on a ratio-reserved box (no crop); stacked at 360 px, side by side at 1280 px (same top position).
- Step 3 (2): ok. Tapping A then B leaves only B checked, ✓ only on B, Próxima enabled; after a reload the questionnaire resumes at step 6 and "Anterior" shows B selected (wording difference of the spec, finding 3 of cycle 2).
- Step 4 (1, 8): ok. A radiogroup with radios "Look de referência A" and "Look de referência B"; ArrowDown moves the choice.
- Step 5 (4): ok. src is `/api/diagnostico/duel-look/<uuid>`, 200 `image/jpeg`, no `Content-Disposition`, no style word or file name in the duel markup.
- Step 6 (6): ok. With the route aborted no image loads, the grey blocks show their captions, a card was selected (✓) and Próxima enabled.
- Step 7 (7): ok. After a reload under `reduce` the step container only shows `opacity 1, transform none`; under `no-preference` it goes from opacity 0 with a slide.
- Step 8 (1): ok with one anomaly. Steps 10 and 15 show two radios and two images, and "Concluir" is enabled after a choice at step 15. At step 10 the first reading, 1.8 s after the tap, still showed Próxima disabled (it was enabled when the script clicked it moments later). I repeated the check on step 10: three taps enabled Próxima in 396, 221 and 451 ms, the choice was saved and restored, and the server log shows `PUT /api/diagnostico/answers` 200 in 85 to 228 ms. I count the first reading as a timing artifact of the headless run; it can only lower a result and the repeat did not reproduce it.
- Afterwards: version 1 republished and version 2 back to draft (ids, status and `published_at` equal the snapshot taken before), the test customer deleted, the server on 3003 stopped.

Verdict: every deterministic check passed, 10 of 10 criteria are ✓, both hand-off tests passed, there are no live checks, the two fired gates are approved, and nothing was skipped. The only environmental limit is the one already accepted by the owner: no per-session database, because the tests and the app only reach the `postgres` database of the local Supabase stack.

What I did not verify (unchanged): real mobile devices, other browsers, real screen readers, `next build` and the file tracing on a deployed build, the visual quality of the photos (owner's).

## Cycle 1 of 2: failed evaluation
Date: 2026-11-23
Commit evaluated: e539b8a, branch feat/result-consultancy-cta, base 13420c5
Judging: deterministic first, then model-assisted per criterion (a live-free feature, but with browser-driven criteria and fired gates)
Overrides: none

### Deterministic checks
| Check | Result | Evidence |
|---|---|---|
| Full suite (lint, typecheck, tests) | fail | `npm run lint`: not runnable (no ESLint config, `next lint` opens an interactive prompt). `npm run typecheck`: exit 0. `npm test` (unit): 1st run 293/294 (`consultancy-cta.test.ts` timed out at 5 s under load), 2nd run 294/294, and that file passes alone. `npm run test:integration` as written: every file fails ("Vitest failed to find the current suite/runner"). With `--pool=vmThreads`, the subset `duel questionnaire-v2 two-choice answers` passes 85/85 (8 files). The rest of the integration suite was not run (see Soft-fails) |
| Named tests exist and ran | pass | All 14 tests named in spec Section 7 exist and passed: `duel-looks.test.ts` (4), `duel-step-view.test.ts` (8), `duel-public-set.test.ts` (5), `duel-look-route.test.ts` (4), `duel-handoff.test.ts` (2). None skipped |
| Test diff against the base | pass | No new `skip`/`todo`/`xfail`. RF-03 commits changed one existing assertion: `questionnaire-handoff.test.ts` now expects keys `["id","image","text"]` for duel alternatives and `["id","text"]` otherwise. It is still an exact key check, so it is not loosened. Earlier removed lines under `base..HEAD` belong to RF-01/RF-02 (not RF-03 scope) and were not judged here |
| Architecture contracts | pass | No architecture-test configuration exists or changed |
| Component Overview | pass | All 5 backend, 2 frontend and 5 test files exist. `next.config.mjs` traces `assets/pdf-images` into the new route; `question-bank.ts` adds `image` to duel alternatives only; the route logs only the alternative id |
| Live evidence | n/a | Spec: no live checks |

### Criteria
- ✓ 1. Steps 5, 10 and 15 each show 2 looks and one can be selected (duel-public-set `version 2 has three duels…` and duel-step-view `a duel renders a radio group…` passed; browser steps 1 and 8: two radios, two images at steps 5, 10, 15)
- ✓ 2. Tapping a look shows border and checkmark, enables forward, saves (duel-step-view `the selected look shows the checkmark…`; browser step 3: Próxima enabled after tap, border-accent and ✓ on the selected card, selection restored when returning to step 5)
- ✓ 3. Chosen style gets 2 points, the other 0 (duel-handoff `a duel choice gives exactly 2 points…`: real database, two attempts, tally compared by hand against `scoreAnswers`)
- ✓ 4. No style name or key in address, alt text or response (duel-public-set, duel-look-route, duel-step-view tests; browser step 5: image src is `/api/diagnostico/duel-look/<uuid>`, response headers have no file name or style, duel markup has no style word)
- ✓ 5. At 360 px stacked, whole, uncropped, no horizontal scroll (duel-step-view `the looks are stacked below 480 px…`; browser step 2: scrollWidth 360, images at 278×494 and 278×347 keep the file ratios, side by side at 1280 px; screenshots `step1-2-360.png`, `step2-1280.png`)
- ✓ 6. A look that fails to load shows a neutral block and stays answerable (duel-step-view `a look without an image…`; browser step 6 with the image route aborted: grey block with caption, card still selectable and Próxima enabled)
- ✓ 7. Reduced motion: no slide or fade (existing `useReducedMotion`; browser step 7: step container stays at opacity 1, no transform under `reduce`, while `no-preference` shows opacity 0 to 1 and a slide)
- ✓ 8. Screen reader names each look neutrally with its state (duel-step-view `each look has the neutral alt text…`; browser step 4: accessibility tree shows a radiogroup named by the question, radios "Look de referência A/B", `[checked]` on the selected one; arrow keys and Space change the choice)
- ✓ 9. RF-02 to RF-03 hand-off (duel-handoff `a duel step of the real version 2…`: real `getPublicQuestionSet` and `saveAnswer`, nothing mocked; also checks refusal of a second choice and of another duel's look)
- ✓ 10. RF-01 to RF-03 hand-off (duel-handoff `a duel choice gives exactly 2 points…`)

Criteria: 10/10 pass. The status is not `success` because of the failed deterministic check and the open gates below.

### Application run
- Environment: local Supabase already running; version 2 published temporarily with `npm run quiz:publish -- 2` (owner approved), dev server on port 3003, headless browser at 360 px and 1280 px, test customer created through `POST /api/diagnostico/attempts`. Afterwards version 1 was republished, version 2 returned to draft (ids, status and `published_at` match the snapshot taken before), the test customer was deleted and the server on 3003 stopped. The server on port 3002 (not mine) was not touched.
- `GET /api/diagnostico/duel-look/<id>`: 200, `image/jpeg`, 70580 bytes, `Cache-Control: public, max-age=31536000, immutable`, `ETag` = alternative id, no `Content-Disposition`. `…/not-a-uuid`: 404 `{"error":{"code":"NOT_FOUND","message":"Imagem não encontrada."}}`.
- Verification script, step 1 (criterion 1): ok (Pergunta 5 de 15, question text, Look A and Look B, Próxima disabled)
- Step 2 (1, 5): ok (see criterion 5)
- Step 3 (2): differs in wording only. After a reload the questionnaire resumes at the first unanswered step (6), not at the duel; the saved look is shown selected when going back with "Anterior". The spec says "after a reload the last look tapped is still selected". This is the RF-01 resume behavior, so the script step should say "after going back".
- Step 4 (1, 8): ok. Step 5 (4): ok for the duel; the page source contains the words "tradicional" and "elegante" only as ordinary Portuguese in the texts of regular questions, which are not about the looks.
- Step 6 (6): ok. Step 7 (7): ok. Step 8 (1): ok (steps 10 and 15 show two looks; "Concluir" enabled after a choice; "Concluir" was not clicked).
- Extra check by the evaluator: console shows only blocked Google Analytics requests (no network in the sandbox) and a deliberate 400 from my first attempt request. No other errors.

### Gates
- schema: fired by `base..HEAD` (migrations `20260101000018_two_choice_answers.sql`, `20260101000019_questionnaire_v2.sql`). Neither comes from the RF-03 commits; they belong to RF-01 and RF-02. Not approved.
- dependencies: fired by `base..HEAD` (`package.json`). Not from the RF-03 commits. Not approved.
- security, adr, architecture-contract: not fired.

### Findings
1. `npm run test:integration` fails for every file on Vitest 5.1.1 with Node 24 ("Vitest failed to find the current suite/runner"): `vitest.integration.config.mts` has no `pool: "vmThreads"`, which `vitest.config.mts` already sets with a comment explaining this exact failure. With `--pool=vmThreads` the tests pass. Fix hint: add `pool: "vmThreads"` to `vitest.integration.config.mts`.
2. `npm run lint` cannot run: the repository has no ESLint configuration and `next lint` waits for an interactive choice. There is no lint check for any feature. Fix hint: add a config or remove the script.
3. `tests/unit/diagnostico/consultancy-cta.test.ts › closes the PDF…` timed out (5 s) once in a full run and passed on rerun and alone. It is outside RF-03 (PDF, branch `feat/result-consultancy-cta`) but is a flaky test. Fix hint: give it a longer timeout.
4. Spec Section 7 step 3 says the saved look is selected "after a reload"; the real behavior resumes at the first unanswered step. Spec wording only.

### Soft-fails
- Lint: no configuration (finding 2).
- Integration suite: only the 8 files related to this feature and its dependencies were run (owner's choice, because the tests share one local database). The other integration files (checkout, generation, privacy, retention and others) were not run, so "the whole suite, fresh" is not met.
- The project integration config setup `tests/setup/clean-detached-orders.ts` deletes orders with no attempt in the shared database; it was not run because the project command fails (finding 1).
- No per-session database was created: the integration tests and the application only reach the `postgres` database of the local Supabase stack through its API.

### What I did not verify
- Real mobile devices, browsers other than headless Chromium, screen readers other than the accessibility tree, and the visual quality of the photos (owner's).
- The production build (`next build`) and the tracing of `assets/pdf-images` into the route on a deployed build; only the dev server was run.
- Behavior of RF-01 and RF-02 beyond the hand-off tests, and the remaining integration tests.
- Whether another session depended on the shared database during the few minutes version 2 was published; a process was listening on port 3002.
