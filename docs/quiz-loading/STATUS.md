# Feature status

Central state of the quiz loading feedback features (docs/prd/PRD-Quiz-Loading-Feedback.md). Updated by `spec-writer`, `implement-feature` and `verify-feature`. Read it first when starting a session. A feature is done only when `verify-feature` sets `success`.
Format: see `~/.claude/skills/spec-writer/status-template.md`.
The IDs RF-01 to RF-04 here are the ones of the quiz loading feedback PRD. They are not the IDs of `docs/quiz-v2/STATUS.md` or of `docs/STATUS.md`.

| ID | Feature | Wave | Depends on | Spec | Phases | Criteria | Live | Status | Verified at |
|---|---|---|---|---|---|---|---|---|---|
| RF-01 | Loading Line and Chapter Auto-Advance | 1 | none | yes | 2/2 | 8/8 | n/a | success | 2026-11-24, 8d38ccf |
| RF-02 | Answer Saving Feedback | 1 | none | yes | 2/2 | 8/8 | n/a | implemented | 2026-11-24, c0a43bc |
| RF-03 | Question Transition Loading | 2 | RF-01 | yes | 0/2 | 0/8 | n/a | spec ready | none |
| RF-04 | Checkout Hand-off Loading | 2 | RF-01 | yes | 0/3 | 0/8 | n/a | spec ready | none |

## Criteria

### RF-01. Loading Line and Chapter Auto-Advance
Last run: 2026-11-24, commit 8d38ccf (verify-feature, cycle 2 of 2; see evaluation.md)
- ✓ 1. Badge screen shows the badge, the message and a loading line, with no "Continuar" (chapter-screen-view.test.ts::shows the badge, the message and the loading line, with no button; browser step 1: 0 buttons, line 312 x 4 px)
- ✓ 2. The next question opens on its own after 2 s (loading.test.ts::scheduleAdvance calls back once after 2000 ms and not before; browser: badge gone at 2001 ms)
- ✓ 3. After the chapter 3 badge the customer goes to the completion path with no tap (questionnaire-state.test.ts::the last step shows the chapter 3 screen before completing; browser: /concluido reached, 3.9 s including the dev compile of the page)
- ✓ 4. A tap, Enter, Space or Esc does nothing and does not shorten the wait (chapter-screen-view.test.ts::has no interactive element besides the focusable title; browser: still on the badge after the inputs, gone at 2001 ms)
- ✓ 5. Reduced motion: static full line, the screen still moves on after 2 s (chapter-screen-view.test.ts::the loading line is static under reduced motion, loading-line-view.test.ts::a static line is drawn full without animation; browser at 1280 px: both data-animated false, line 420 of 420 px, next question at 2.4 s)
- ✓ 6. A screen reader announces "Preparando a próxima etapa…" once as a status (loading-line-view.test.ts::the label is a status and shows no percentage; browser accessibility tree: one status)
- ✓ 7. A reload during the badge screen does not show it again (questionnaire-state.test.ts::a chapter screen already shown in this visit is not shown again; browser: after the reload no badge and "Pergunta 11 de 15")
- ✓ 8. Version 1 shows no loading line and no auto-advance (questionnaire-state.test.ts::a set without chapters never shows a chapter screen; browser step 8: no chapter screen or line on version 1, version 2 restored afterwards)
Unit 356/356, integration 444/444, `tsc`, lint and `next build` pass. Browser steps 1 to 9 passed in cycle 2, including version 1 (version 2 restored afterwards).

### RF-02. Answer Saving Feedback
Last run: 2026-11-24, commit c0a43bc (implement-feature)
- ✓ 1. Tapping an alternative shows the spinner and "Salvando…", disabled until the server confirms (forward-button-view.test.ts::shows the spinner and "Salvando…" and is disabled while saving; browser: saving, disabled, "SALVANDO…")
- ✓ 2. A fast confirmation returns the button to "Próxima", enabled, with no minimum display time (forward-button-view.test.ts::shows the normal label, enabled, when it is not saving; browser: back to "PRÓXIMA" enabled)
- ✓ 3. On a throttled network "Salvando…" shows within 100 ms and stays until the save ends (browser: 14 ms from the click to the saving state in the DOM; stayed through the 1.5 s delay)
- ✓ 4. During the retries "Salvando…" stays on and the retry message shows (questionnaire-state.test.ts::showsSavingFeedback is true for saving and retrying on version 2; browser at 2.2 s: saving plus the retry message)
- ✓ 5. After the last retry fails the button is "Próxima", disabled, with the offline message and "Tentar novamente" (questionnaire-state.test.ts::showsSavingFeedback is false for failed and rejected; browser: failed after 6 s, then the retry button restored the enabled "Próxima")
- ✓ 6. A look duel shows the same saving state (same ForwardButton and rule; browser on step 5: "SALVANDO…", disabled)
- ✓ 7. The button keeps its width and height in the saving and normal states (forward-button-view.test.ts::reserves the width of every label so the size does not change; browser at 360 px: 159.9 x 48 in both states)
- ✓ 8. Version 1 keeps the button as today (questionnaire-state.test.ts::showsSavingFeedback is always false on version 1; questionnaire-two-choice-view.test.ts::a version 1 question set keeps the plain forward button; browser step 8 not run)
Unit 368/368, `tsc` and `next build` pass. Browser steps 1 to 7 and 9 passed (reduced motion: three static dots, one "Salvando…" in the live region). Browser step 8 (version 1) not run: re-publishing version 1 would archive version 2. Full integration suite not run (no server or database code changed).

### RF-03. Question Transition Loading
Last run: none (spec written 2026-11-24)
- — 1. "Próxima" on a saved step shows the line "Carregando próxima pergunta…" for 500 ms, then the next question slides in (no run yet)
- — 2. A second tap on "Próxima" or "Anterior" during the line does nothing (no run yet)
- — 3. "Anterior" shows the previous question at once, with no line (no run yet)
- — 4. On the last step of a chapter the badge screen shows with no 500 ms line before it (no run yet)
- — 5. A full version 2 run has at most 12 s of fixed waiting (no run yet)
- — 6. With reduced motion the next question appears at once, with no line (no run yet)
- — 7. Version 1 shows the next question as today (no run yet)
- — 8. RF-01 to RF-03 hand-off: the line is the RF-01 component with 500 ms and the RF-03 text (no run yet)

### RF-04. Checkout Hand-off Loading
Last run: none (spec written 2026-11-24)
- — 1. After the chapter 3 badge, "Preparando seu diagnóstico…" and the line show within 100 ms until the completion page renders (no run yet)
- — 2. "RECEBER MEU DIAGNÓSTICO" shows "Preparando seu Pix…" and the line within 100 ms until the checkout renders (no run yet)
- — 3. A double tap starts no second navigation (no run yet)
- — 4. After 15 s without the next page, the message and "Tentar novamente" appear and repeat the navigation (no run yet)
- — 5. An expired attempt goes to the registration page with the notice and no loading screen stays (no run yet)
- — 6. Reduced motion: static line and visible text on both screens (no run yet)
- — 7. A version 1 attempt reaches the completion page and the checkout as today (no run yet)
- — 8. RF-01 to RF-04 hand-off: the screen is the RF-01 line, static under reduced motion (no run yet)
