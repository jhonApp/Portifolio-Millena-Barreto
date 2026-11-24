# Evaluation: RF-01 Loading Line and Chapter Auto-Advance

## Cycle 1 of 2: failed evaluation
Date: 2026-11-24
Commit evaluated: 709f46d, branch feat/result-consultancy-cta, base 13420c5 (merge-base with master). 709f46d only adds docs (PRD, specs, plans) on top of the implementation commits c8d55ba and 091b130. Unrelated docs changes were stashed (`stash@{0}`, "pre-verify RF-01") with the owner's approval.
Judging: model-assisted for the browser evidence (criteria are DOM criteria with a verification script)
Overrides: none

### Deterministic checks
| Check | Result | Evidence |
|---|---|---|
| Lint, typecheck, build | pass | `next lint` no error (4 pre-existing warnings in Checkout.tsx and diagnosis-pdf.tsx, files not touched by this feature), `tsc --noEmit` exit 0, `next build` ok |
| Unit suite | pass | 50 files, 356/356 |
| Integration suite, project command | **fail** | 43 files, 443/444. Failing test: `tests/integration/diagnostico/delivery.test.ts` > `the diagnosis e-mail > the e-mail has the subject the first name both styles the secure link and the PDF attached` (`runDueDeliveries` returned `not_claimed`, expected `sent`; 20 s). The same file alone: 26/26. Same flaky file that failed RF-05 of quiz v2 |
| Named tests exist and ran | pass | All 4 `loading.test.ts`, 4 `loading-line-view.test.ts`, 6 `chapter-screen-view.test.ts` and the 5 named `questionnaire-state.test.ts` tests exist and passed (42/42 in the four files) |
| Test diff against the base | pass | Feature commits only: `chapter-screen-view.test.ts` replaced the "Continuar" assertions on purpose (spec Section 3); no deleted test, no skip, no loosened assertion (the replacements are stricter: no `<button`, one `tabindex`) |
| Architecture contracts | pass | No architecture test configuration changed |
| Component Overview | pass | `LoadingLine.tsx`, `ChapterScreen.tsx` (`onDone`, no button, 2 s timer with cleanup), `Questionnaire.tsx` (`advanceFromChapter`), `loading.ts` match spec Sections 4 and 5 |
| Live evidence | n/a | No live check in the spec |

### Criteria
- ✓ 1. Badge screen with message and line, no "Continuar" (chapter-screen-view.test.ts::shows the badge, the message and the loading line, with no button; browser step 1: 0 buttons, line 312 x 4 px)
- ✓ 2. Next question opens on its own after 2 s (loading.test.ts::scheduleAdvance calls back once after 2000 ms and not before; browser: badge shown to gone 2012 ms at 360 px, 2033 ms at 1280 px)
- ✓ 3. After the chapter 3 badge the customer reaches the completion path with no tap (questionnaire-state.test.ts::the last step shows the chapter 3 screen before completing; browser step 4: `/diagnostico-estilo/concluido` reached with no tap; the first dev compile of that page took 12.5 s, the badge stayed meanwhile as the spec says)
- ✓ 4. A tap, Enter, Space or Esc does nothing (chapter-screen-view.test.ts::has no interactive element besides the focusable title; browser step 3: click, Enter, Space, Esc on the chapter 2 badge, it still left after 2012 ms)
- ✓ 5. Reduced motion: static full line, still moves on after 2 s (chapter-screen-view.test.ts::the loading line is static under reduced motion, loading-line-view.test.ts::a static line is drawn full without animation; browser step 5: both `data-animated` false, line 420 of 420 px, next question after 2033 ms)
- ✓ 6. Screen reader announces the text once as a status (loading-line-view.test.ts::the label is a status and shows no percentage; browser step 6: one `role=status` "Preparando a próxima etapa…", 0 progressbars on the screen)
- ✓ 7. A reload during the badge does not show it again (questionnaire-state.test.ts::a chapter screen already shown in this visit is not shown again; browser step 7: after reload no badge, "Pergunta 11 de 15", still no badge 2.5 s later)
- ✓ 8. Version 1 shows no line and no auto-advance (questionnaire-state.test.ts::a set without chapters never shows a chapter screen; browser step 8, run after the owner's approval: "Pergunta 1 de 15", no chapter label, one progressbar, and after 6 answers, crossing the step 5 to 6 boundary, no chapter screen and no loading line ever appeared)

### Application run
- Dev server on port 3003 (3000 to 3002 were in use), local Supabase with version 2 published, two throwaway customers (`verify-rf01@example.test`, `verify-rf01-b@example.test`) created through the registration form. They are left in the local database; they are not cleaned.
- Verification script, step 1 (criterion 1): ok (chapter 2 badge "Selo Ocasiões", 0 buttons, line 312 x 4 px, text present, focus on the title)
- Verification script, step 2 (criterion 2): ok (2012 ms)
- Verification script, step 3 (criterion 4): ok
- Verification script, step 4 (criterion 3): ok
- Verification script, step 5 (criterion 5): ok
- Verification script, step 6 (criterion 6): ok (read from the DOM, `role=status` count, not from a full accessibility tree)
- Verification script, step 7 (criterion 7): ok
- Verification script, step 8 (criterion 8): ok, run on 2026-11-24 with the owner's approval. Version 2 was archived and version 1 published by SQL in a transaction (`published_at` untouched), then restored the same way: version 1 archived, version 2 published, `published_at` values equal to those before. Third throwaway customer `verify-rf01-c@example.test` left in the local database.
- Verification script, step 9 (layout, 1280 px): ok (track 420 px, no horizontal scroll, text present)
- Extra check by the evaluator: the chapter 1 badge at 360 px was missed by the first script (the click call returned after the badge was gone); chapter 2 and the reduced-motion run were observed with an in-page observer instead. Chapter 1 at 360 px with motion on is therefore covered only by the chapter 2 run, same component.

### Gates
- security: not fired
- schema: not fired
- adr: not fired
- architecture-contract: not fired
- dependencies: not fired
(Computed on the feature commits c8d55ba..091b130. Against the whole branch since the merge-base, `schema` and `dependencies` would fire because of quiz v2 RF-01 and RF-05, which are other features.)

### Findings
1. The whole integration suite is not green on a fresh run: 1 of 444 failed in `delivery.test.ts` (`not_claimed` instead of `sent`). The file passes alone (26/26) and the feature touches no delivery code, so this looks like the known flaky delivery test, not a regression of RF-01. By the verdict rules a failing Step 3 check still gives `failed evaluation`. Fix hint: stabilise `delivery.test.ts` (it also failed RF-05 of quiz v2), or the owner decides it is out of scope.

### Soft-fails
- None. Browser step 8 was first skipped (it needs version 1 published, which archives version 2), then run after the owner approved it; this closes cycle 1 and is not a new cycle. The status stays `failed evaluation` only because of finding 1.

### What I did not verify
- Chapter 1 badge timing with motion on at 360 px (only chapter 2 was timed there).
- The full accessibility tree of the badge screen; I read the DOM for `role=status` and progressbars.
- Any delivery, payment or e-mail behavior beyond the integration suite result above.
