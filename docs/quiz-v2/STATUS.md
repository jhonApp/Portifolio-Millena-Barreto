# Feature status

Central state of the quiz v2 features (docs/prd/PRD-Quiz-Multipla-Escolha-Gamificado.md). Updated by `spec-writer`, `implement-feature` and `verify-feature`. Read it first when starting a session. A feature is done only when `verify-feature` sets `success`.
Format: see `~/.claude/skills/spec-writer/status-template.md`.
The IDs RF-01 to RF-05 here are the ones of the quiz v2 PRD. They are not the RF-01 to RF-12 of `docs/STATUS.md`, which tracks the original product.

| ID | Feature | Wave | Depends on | Spec | Phases | Criteria | Live | Status | Verified at |
|---|---|---|---|---|---|---|---|---|---|
| RF-01 | Two-Choice Answers and Weighted Scoring | 1 | none | yes | 4/4 | 12/12 | n/a | implemented | 2026-11-23, c43a824 |
| RF-02 | Question Set Version 2 and Version Routing | 2 | RF-01 | yes | 4/4 | 11/11 | n/a | implemented | 2026-11-23, 86ccf3f |
| RF-03 | Look Duels | 3 | RF-01, RF-02 | yes | 3/3 | 10/10 | n/a | success | 2026-11-23, 5465c78 |
| RF-04 | Chapters, Badges and Look Progress | 3 | RF-01, RF-02 | yes | 3/3 | 10/10 | n/a | implemented | 2026-11-23, 4df29ad |
| RF-05 | Completion Comparison by Questionnaire Version | 3 | RF-02 | yes | 0/3 | 0/5 | n/a | spec ready | none |

## Criteria

### RF-01. Two-Choice Answers and Weighted Scoring
Last run: 2026-11-23, on top of commit 669fd27 (implement-feature rework after verify-feature cycle 2 of 2: the generation-job test now has a 120 s timeout; full suite green, unit 294/294, integration 441/441; see docs/quiz-v2/RF-01-two-choice-answers-and-weighted-scoring/evaluation.md)
- ✓ 1. One tap marks "1ª escolha" and enables "Próxima" (questionnaire-state.test.ts::nextChoices: a first tap…, questionnaire-two-choice-view.test.ts; browser steps 1-2)
- ✓ 2. A different card becomes "2ª escolha" and is saved (answers-route.test.ts::saves a second choice…, two-choice-sql.test.ts::saves a first and a second choice in one row; browser steps 3-4)
- ✓ 3. Tapping "2ª escolha" removes it (questionnaire-state.test.ts, answers-route.test.ts::a null secondAlternativeId clears…; browser step 5)
- ✓ 4. A third card replaces the second choice (questionnaire-state.test.ts, two-choice-sql.test.ts::a new second alternative replaces…; browser step 6)
- ✓ 5. 2 points per first choice, 1 per second, total 30 to 42 (scoring-two-choice.test.ts)
- ✓ 6. Only first choices rank like single choice (scoring-two-choice.test.ts)
- ✓ 7. Tie-break by points in steps 11 to 15, then the fixed order (scoring-two-choice.test.ts)
- ✓ 8. The secondary style has at least 2 points (scoring-two-choice.test.ts, 5000 cases + 30 pairs)
- ✓ 9. Repeated alternative or alternative of another question is refused (two-choice-sql.test.ts, answers-route.test.ts)
- ✓ 10. A version 1 attempt scores as before (scoring-two-choice.test.ts::default rules…1000 random attempts; scoring.test.ts and generation-handoff.test.ts unchanged and green; 5 stored diagnoses rescored identically)
- ✓ 11. Failed save: offline message and advancing blocked (questionnaire-state.test.ts::retry delays…; browser step 8)
- ✓ 12. Incomplete attempt goes to the first unanswered step (answers-lib.test.ts::second choices do not change…, checkout-route.test.ts::an incomplete attempt is refused…)
All 12 criteria pass. Cycle 1 finding fixed (payment-sql expiry test). Cycle 2 failed on a deterministic check: a different flaky test outside RF-01 (generation-job, "processes at most five orders per run") timed out at 30 s in a slow whole-suite run (integration 440/441); it passes alone 3 of 3. Both cycles are used: the owner decides next (fix the flaky test, then accept or not). Gates schema and dependencies approved by the owner on 2026-11-23.

### RF-02. Question Set Version 2 and Version Routing
Last run: 2026-11-23, commit 86ccf3f (implement-feature; not yet checked by verify-feature)
- ✓ 1. A new attempt is served version 2 with 15 steps in 3 chapters of 5 (questionnaire-v2.test.ts::a new attempt is served version 2...; browser steps 1-2)
- ✓ 2. An attempt with answers keeps its own version (questionnaire-v2.test.ts::an attempt with answers keeps its own version after the release; browser step 4)
- ✓ 3. The public set has no style or weight (questionnaire-v2.test.ts::has no style or weight, question-bank.test.ts::public question set contains no style or weight)
- ✓ 4. A style in 8 or 10 steps cannot be published and the message names it (question-set-rules.test.ts::version 2 profile rejects a style that appears in 8 steps and names it, questionnaire-v2.test.ts::publishing an unbalanced draft is refused...)
- ✓ 5. Version 2 has 12 regular, 3 duels, each style in 9 steps (questionnaire-v2.test.ts::has 12 questions, 3 duels and 9 steps per style, the SQL and TypeScript validators agree...)
- ✓ 6. An edited alternative text is shown after publishing, mapping unchanged (questionnaire-v2.test.ts::an edited alternative text is shown after publishing...)
- ✓ 7. Only texts are editable; a published version is refused (questionnaire-v2.test.ts::the edit functions change text only..., there is no function that changes style...)
- ✓ 8. Stored version 1 results and scoring input unchanged (questionnaire-v2.test.ts::publishing version 2 does not change a stored version 1 result...; 5 stored results rescored identically)
- ✓ 9. Same order of alternatives and looks for the same attempt (questionnaire-v2.test.ts::keeps the order of alternatives and duel looks stable...; browser step 6)
- ✓ 10. No published set: maintenance message, nothing created (questionnaire-v2.test.ts::the loader reports unavailable..., answers-route.test.ts::answers 503...; browser step 5)
- ✓ 11. RF-01 to RF-02 hand-off: saved first and second choices restored, first unanswered step shown (two-choice-handoff.test.ts)

### RF-03. Look Duels
Last run: 2026-11-23, commit 5465c78 (verify-feature, re-check after approval, closing cycle 2; see docs/quiz-v2/RF-03-look-duels/evaluation.md)
- ✓ 1. Steps 5, 10 and 15 each show 2 looks and one can be selected (tests and browser steps 1, 4, 8)
- ✓ 2. Tapping a look shows border and checkmark, enables forward, saves (test and browser step 3)
- ✓ 3. The chosen look's style gets 2 points, the other 0 (duel-handoff, real database)
- ✓ 4. No style name or key in address, alt text or response (3 tests; browser step 5, route headers)
- ✓ 5. At 360 px stacked, whole, uncropped, no horizontal scroll (test; browser step 2, ratios match the files)
- ✓ 6. A look that fails to load shows a neutral block and stays answerable (test; browser step 6)
- ✓ 7. Reduced motion: no slide or fade (browser step 7: no opacity or transform change)
- ✓ 8. Screen reader names each look neutrally with its state (test; browser step 4 accessibility tree, keyboard)
- ✓ 9. RF-02 to RF-03 hand-off (duel-handoff, nothing mocked)
- ✓ 10. RF-01 to RF-03 hand-off (duel-handoff, real database)
Gates schema and dependencies approved by the owner on 2026-11-23. Lint, typecheck, unit (294), the whole integration suite (441) and the browser script (steps 1 to 8, rerun on this commit) pass.

### RF-04. Chapters, Badges and Look Progress
Last run: 2026-11-23, commit 4df29ad (implement-feature; not yet checked by verify-feature)
- ✓ 1. After the 5th step of a chapter is saved, "Próxima" shows the badge, the message and "Continuar" (questionnaire-state.test.ts::chapterToShow returns the chapter…, chapter-screen-view.test.ts; browser steps 1-2)
- ✓ 2. The message has no style name, percentage or score and is the same for everyone (chapters.test.ts, chapter-screen-view.test.ts)
- ✓ 3. 7 answered steps give 7 filled segments, group 1 complete, its piece drawn (questionnaire-state.test.ts, look-progress-view.test.ts; browser)
- ✓ 4. Going back keeps the earned badges (questionnaire-state.test.ts::earnedChapters does not depend on the current step; browser)
- ✓ 5. A returning customer sees the bar and badges of her saved answers (chapters-handoff.test.ts; browser reload at step 6, no chapter screen)
- ✓ 6. At 360 px no horizontal scroll, "Capítulo N de 3" readable, chapter screen fits 640 px (look-progress-view.test.ts; browser)
- ✓ 7. Reduced motion: the badge appears with no animation (chapter-screen-view.test.ts; browser: opacity 1, transform none)
- ✓ 8. "Concluir" shows the third badge, then the completion page (questionnaire-state.test.ts::the last step shows the chapter 3 screen…; browser)
- ✓ 9. RF-02 to RF-04 hand-off (chapters-handoff.test.ts, real version 2)
- ✓ 10. RF-01 to RF-04 hand-off (chapters-handoff.test.ts, real saved answers)
Unit 317, integration 443 (version 1 and version 2 published), tsc and next build clean.

### RF-05. Completion Comparison by Questionnaire Version
Last run: none
- — 5 criteria listed in the spec (Section 7), not run yet
