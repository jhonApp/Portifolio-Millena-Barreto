# Evaluation: RF-04 Chapters, Badges and Look Progress

## Re-check after approval (closing cycle 1): success
Date: 2026-11-23
Commit evaluated: d843012 (unchanged since the run below), branch feat/result-consultancy-cta, base 13420c5
Owner input: `approved: schema`, `approved: dependencies` (2026-11-23).
Reading of the cycle limit: cycle 1 ended in `needs human` waiting for these approvals; Step 1.2 allows a re-check from that status, so this closes cycle 1 and is not a new cycle.

| Check | Result | Evidence |
|---|---|---|
| Lint, typecheck, unit tests | pass (rerun) | lint no error, `tsc --noEmit` exit 0, unit 46 files, 317/317 |
| Integration suite, browser script, named tests, test diff, Component Overview | pass (not rerun) | `HEAD` and the code are identical to the run below (only the two evaluation files are uncommitted), so the 443/443 integration run and the browser steps 1 to 9 of that run stand. The database was not touched again |
| Criteria | 10/10 ✓ | Same mapping and evidence as below |
| Gates | schema: approved by the owner on 2026-11-23. dependencies: approved by the owner on 2026-11-23. security, adr, architecture-contract: not fired |

Soft-fails and "What I did not verify" are unchanged from the run below.

## Cycle 1 of 2: needs human
Date: 2026-11-23
Commit evaluated: d843012, branch feat/result-consultancy-cta, base 13420c5
Judging: model-assisted for the criteria judged from the browser run (criteria 1 to 8 depend on the DOM); deterministic first
Overrides: none
Owner input: the full integration suite and the browser script were allowed on the shared local database for this run (2026-11-23).

### Deterministic checks
| Check | Result | Evidence |
|---|---|---|
| Full suite (lint, typecheck, tests) | pass | `npm run lint` exit 0 (6 warnings, none in RF-04 files: Checkout.tsx x2, diagnosis-pdf.tsx x4). `tsc --noEmit` exit 0. `npm test`: 46 files, 317/317. `npm run test:integration`: 42 files, 443/443, none skipped |
| Named tests exist and ran | pass | All tests named in the spec exist and ran: chapters (3), chapter-screen-view (4), look-progress-view (5), questionnaire-state (the 8 RF-04 tests, among 29), chapters-handoff (2) |
| Test diff against the base | pass | RF-04 commits (a897dba..4df29ad) only add test lines, no deletion and no changed assertion. No new `skip`, `todo` or `xfail` in `base..HEAD` |
| Architecture contracts | pass | No architecture-test configuration changed |
| Component Overview | pass | `lib/diagnostico/chapters.ts`, `questionnaire-state.ts`, `ChapterScreen.tsx`, `LookProgress.tsx`, `Questionnaire.tsx` and the five test files exist and match their roles |
| Live evidence | n/a | Spec: no live checks |

### Criteria
- ✓ 1. After the 5th step of a chapter is saved, "Próxima" shows the badge, the message and "Continuar" (questionnaire-state.test.ts::chapterToShow returns the chapter…, chapter-screen-view.test.ts::shows the badge…; browser step 1: "Selo Rotina", message and CONTINUAR, 5 of 5 saved)
- ✓ 2. The message has no style name, percentage or score and is the same for everyone (chapters.test.ts, chapter-screen-view.test.ts::has no style name…; browser step 2: whole screen text checked, no style word, `%` or score)
- ✓ 3. 7 answered steps give 7 filled segments, group 1 complete, its piece drawn (look-progress-view.test.ts::7 saved steps…; browser step 5: after a reload 7 segments filled, group 1 complete with its piece, groups 2 and 3 not)
- ✓ 4. Going back keeps the earned badges (questionnaire-state.test.ts::earnedChapters does not depend on the current step; browser step 4: back at step 5, group 1 stays complete with its piece)
- ✓ 5. A returning customer sees the bar and badges of her saved answers (chapters-handoff.test.ts, real database; browser step 5: reload opens at step 8, 7 filled, no chapter screen)
- ✓ 6. At 360 px no horizontal scroll, "Capítulo N de 3" readable, chapter screen fits 640 px (look-progress-view.test.ts::shows Capítulo N de 3…; browser: scrollWidth 360 on step 1, the chapter screen and the reload at 360 px; at 640 px high the "Continuar" button ends at y 468; 1280 px scrollWidth 1280)
- ✓ 7. Reduced motion: the badge appears with no animation (chapter-screen-view.test.ts::no animation is applied…; browser with `reduce`: opacity 1 and no transform at 20, 100, 300 and 800 ms; with `no-preference` the badge goes 0.14 to 1 in opacity and 0.66 to 1 in scale)
- ✓ 8. "Concluir" shows the third badge, then the completion page (questionnaire-state.test.ts::the last step shows the chapter 3 screen…; browser step 8: "Selo Desejos" with 3 groups complete, "Continuar" leads to `/diagnostico-estilo/concluido`)
- ✓ 9. RF-02 to RF-04 hand-off (chapters-handoff.test.ts::the progress built from the real version 2…; real version 2, nothing mocked, passed in the full integration run)
- ✓ 10. RF-01 to RF-04 hand-off (chapters-handoff.test.ts::the progress and the earned badges of a returning customer…; saves with `saveAnswer`, reads with `getSavedChoices`, 7 steps give 1 badge and 10 steps give 2)

Criteria: 10/10.

### Application run
- Environment: version 2 published with `npm run quiz:publish -- 2` (owner allowed), dev server on port 3003 (3000 to 3002 belong to other sessions and were not touched), headless Chromium at 360 and 1280 px, test customers created through `POST /api/diagnostico/attempts` (201). A distinct `x-forwarded-for` was sent per attempt because the route allows 10 attempts per hour per IP.
- Verification script, step 1 (criteria 1, 2): ok (heading "Selo Rotina", the message, one button CONTINUAR; the heading has the focus; the section is named by it through `aria-labelledby`; screenshot `scratchpad/shots/step1-chapter1-360.png`).
- Step 2 (criterion 2): ok (no style word, no percentage, no score on the screen).
- Step 3 (criteria 1, 3): ok (label "Pergunta 6 de 15 Capítulo 2 de 3", 5 filled segments, group 1 complete with its piece, groups 2 and 3 with outline pieces, focus on the question heading; screenshot `step3-step6-360.png`).
- Step 4 (criterion 4): ok ("Anterior" to step 5 and "Próxima" again: no chapter screen, the same bar).
- Step 5 (criteria 3, 5): ok (reload at step 8: 7 filled, group 1 complete, no chapter screen; segment names "Passo 1, respondido" to "Passo 8, atual", "Passo 9, pendente"; group names "Seu dia a dia, completo", "Suas ocasiões, incompleto", "Seus desejos, incompleto"; screenshot `step5-reload-360.png`).
- Step 6 (criterion 6): ok (see criterion 6).
- Step 7 (criterion 7): ok ("Selo Ocasiões" at once, computed style static under `reduce`; screenshot `step7-reduced-360.png`).
- Step 8 (criterion 8): ok (see criterion 8; screenshot `step8-chapter3-360.png`).
- Step 9 (criterion 3, fallback): ok (version 1 republished, a new attempt shows only "Pergunta 1 de 15", no look progress, no word "Capítulo"; after step 5 the next step appears with no chapter screen; screenshot `step9-v1-360.png`).
- Extra check by the evaluator: keyboard only. Tab from the chapter screen reaches CONTINUAR and Enter moves on, with the focus on the next question heading. Can only lower a result; it did not.
- Restoration: version 1 published again and version 2 back to draft with `published_at` empty, the same ids and dates as the snapshot taken before; the 13 test customers I created were deleted (customers 7 and orders 5, as before); the server on 3003 was stopped.

### Gates
- schema: approved by the owner on 2026-11-23. Fired by `base..HEAD` (migrations `20260101000018_two_choice_answers.sql` and `20260101000019_questionnaire_v2.sql`, from RF-01 and RF-02, not from RF-04). Not approved in this run's input. (The owner approved it on 2026-11-23 in the RF-01 and RF-03 evaluations; this skill records an approval only when it is given for this run.)
- dependencies: approved by the owner on 2026-11-23. Fired by `base..HEAD` (`package.json`, from RF-01 to RF-03 commits). Same note.
- security, adr, architecture-contract: not fired.

### Findings
1. No failure found. The only open items are the two gates above, which RF-04's own commits do not touch.

### Soft-fails
- No per-session database: the tests and the app reach only the `postgres` database of the local Supabase stack, so the published versions were changed temporarily and restored, as in the RF-03 evaluation.

### What I did not verify
- Real mobile devices, other browsers, a real screen reader (the accessible names were read from the DOM attributes, not from a screen reader).
- The visual quality of the three drawings and the draft names and messages, which Millena reviews.
- `next build` on this commit (the implementer reports it clean; I ran lint, typecheck and tests only).
- Whether another session used the shared database while version 2 was published (a few minutes).

**To reach `success`, the owner has to decide:** approve or reject the gates `schema` and `dependencies` for this run (`approved: schema`, `approved: dependencies`) and ask for a re-check. Nothing else is pending.
