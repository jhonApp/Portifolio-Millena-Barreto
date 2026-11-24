# Feature status

Central state of the quiz loading feedback features (docs/prd/PRD-Quiz-Loading-Feedback.md). Updated by `spec-writer`, `implement-feature` and `verify-feature`. Read it first when starting a session. A feature is done only when `verify-feature` sets `success`.
Format: see `~/.claude/skills/spec-writer/status-template.md`.
The IDs RF-01 to RF-04 here are the ones of the quiz loading feedback PRD. They are not the IDs of `docs/quiz-v2/STATUS.md` or of `docs/STATUS.md`.

| ID | Feature | Wave | Depends on | Spec | Phases | Criteria | Live | Status | Verified at |
|---|---|---|---|---|---|---|---|---|---|
| RF-01 | Loading Line and Chapter Auto-Advance | 1 | none | yes | 2/2 | 8/8 | n/a | implemented | 2026-11-24, 091b130 |
| RF-02 | Answer Saving Feedback | 1 | none | yes | 0/2 | 0/8 | n/a | spec ready | none |
| RF-03 | Question Transition Loading | 2 | RF-01 | yes | 0/2 | 0/8 | n/a | spec ready | none |
| RF-04 | Checkout Hand-off Loading | 2 | RF-01 | yes | 0/3 | 0/8 | n/a | spec ready | none |

## Criteria

### RF-01. Loading Line and Chapter Auto-Advance
Last run: 2026-11-24, commit 091b130 (implement-feature; not yet checked by verify-feature)
- ✓ 1. Badge screen shows the badge, the message and a loading line, with no "Continuar" (chapter-screen-view.test.ts::shows the badge, the message and the loading line, with no button; browser step 1: 0 buttons, line 312 x 4 px)
- ✓ 2. The next question opens on its own after 2 s (loading.test.ts::scheduleAdvance calls back once after 2000 ms and not before; browser: badge gone at 2001 ms)
- ✓ 3. After the chapter 3 badge the customer goes to the completion path with no tap (questionnaire-state.test.ts::the last step shows the chapter 3 screen before completing; browser: /concluido reached, 3.9 s including the dev compile of the page)
- ✓ 4. A tap, Enter, Space or Esc does nothing and does not shorten the wait (chapter-screen-view.test.ts::has no interactive element besides the focusable title; browser: still on the badge after the inputs, gone at 2001 ms)
- ✓ 5. Reduced motion: static full line, the screen still moves on after 2 s (chapter-screen-view.test.ts::the loading line is static under reduced motion, loading-line-view.test.ts::a static line is drawn full without animation; browser at 1280 px: both data-animated false, line 420 of 420 px, next question at 2.4 s)
- ✓ 6. A screen reader announces "Preparando a próxima etapa…" once as a status (loading-line-view.test.ts::the label is a status and shows no percentage; browser accessibility tree: one status)
- ✓ 7. A reload during the badge screen does not show it again (questionnaire-state.test.ts::a chapter screen already shown in this visit is not shown again; browser: after the reload no badge and "Pergunta 11 de 15")
- ✓ 8. Version 1 shows no loading line and no auto-advance (questionnaire-state.test.ts::a set without chapters never shows a chapter screen; the browser check on version 1 was not run, see the notes below)
Unit 356/356, `tsc` and `next build` pass. The whole integration suite was not green in two full runs on a slow local Supabase (5 and 18 failures: 30 s timeouts, plus `question-bank.test.ts` reading `docs/RF-03-question-bank-and-scoring-engine/questionnaire-source.md`, which was moved to `docs/questions/` outside this run); the failing files pass when run in smaller groups or alone. Browser step 8 (version 1) was not run: publishing version 1 again would archive version 2, which the owner asked to keep published locally.

### RF-02. Answer Saving Feedback
Last run: none (spec written 2026-11-24)
- — 1. Tapping an alternative shows the spinner and "Salvando…", disabled until the server confirms (no run yet)
- — 2. A fast confirmation returns the button to "Próxima", enabled, with no minimum display time (no run yet)
- — 3. On a throttled network "Salvando…" shows within 100 ms and stays until the save ends (no run yet)
- — 4. During the retries "Salvando…" stays on and the retry message shows (no run yet)
- — 5. After the last retry fails the button is "Próxima", disabled, with the offline message and "Tentar novamente" (no run yet)
- — 6. A look duel shows the same saving state (no run yet)
- — 7. The button keeps its width and height in the saving and normal states (no run yet)
- — 8. Version 1 keeps the button as today (no run yet)

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
