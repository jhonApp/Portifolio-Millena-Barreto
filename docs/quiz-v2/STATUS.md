# Feature status

Central state of the quiz v2 features (docs/prd/PRD-Quiz-Multipla-Escolha-Gamificado.md). Updated by `spec-writer`, `implement-feature` and `verify-feature`. Read it first when starting a session. A feature is done only when `verify-feature` sets `success`.
Format: see `~/.claude/skills/spec-writer/status-template.md`.
The IDs RF-01 to RF-05 here are the ones of the quiz v2 PRD. They are not the RF-01 to RF-12 of `docs/STATUS.md`, which tracks the original product.

| ID | Feature | Wave | Depends on | Spec | Phases | Criteria | Live | Status | Verified at |
|---|---|---|---|---|---|---|---|---|---|
| RF-01 | Two-Choice Answers and Weighted Scoring | 1 | none | yes | 4/4 | 12/12 | n/a | implemented | 2026-11-22, 39f1268 |
| RF-02 | Question Set Version 2 and Version Routing | 2 | RF-01 | yes | 4/4 | 0/11 | n/a | in progress | none |
| RF-03 | Look Duels | 3 | RF-01, RF-02 | yes | 0/3 | 0/10 | n/a | spec ready | none |
| RF-04 | Chapters, Badges and Look Progress | 3 | RF-01, RF-02 | yes | 0/3 | 0/10 | n/a | spec ready | none |
| RF-05 | Completion Comparison by Questionnaire Version | 3 | RF-02 | yes | 0/3 | 0/5 | n/a | spec ready | none |

## Criteria

### RF-01. Two-Choice Answers and Weighted Scoring
Last run: 2026-11-22, commit 39f1268 (implement-feature; not yet checked by verify-feature)
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

### RF-02. Question Set Version 2 and Version Routing
Last run: none
- — 11 criteria listed in the spec (Section 7), not run yet

### RF-03. Look Duels
Last run: none
- — 10 criteria listed in the spec (Section 7), not run yet

### RF-04. Chapters, Badges and Look Progress
Last run: none
- — 10 criteria listed in the spec (Section 7), not run yet

### RF-05. Completion Comparison by Questionnaire Version
Last run: none
- — 5 criteria listed in the spec (Section 7), not run yet
