# RF-04. Chapters, Badges and Look Progress: Implementation Plan

Spec: docs/quiz-v2/RF-04-chapters-badges-and-look-progress/spec.md · Complexity: simple · Phases: 3

## Prerequisites

- **Features:** RF-04 depends on RF-01 and RF-02 of docs/prd/PRD-Quiz-Multipla-Escolha-Gamificado.md (waves 1 and 2). Both have specs and plans but **are not implemented yet**: migrations `20260101000018` and `20260101000019` must be applied and committed, so the public question set carries `chapter` and `kind` and the saved choices can be read. The original RF-01 to RF-09 are implemented (docs/STATUS.md). No Foundation feature is pending.
- **Order with the other features:** this feature changes `Questionnaire.tsx`, which RF-01, RF-02 and RF-03 also change. Implement it **after RF-03** to avoid conflicts; if it must be done earlier, update the branch from the main branch before starting and resolve conflicts there.
- **Database:** no migration is added. Browser checks use a disposable per-session database with version 2 published.
- **Release order:** version 2 must not be published in a real environment before this feature and RF-03 are implemented and Millena has reviewed the draft names, messages and drawings.
- **Conventions:** English for code, comments and commit messages; Portuguese for customer-facing text (names, badges, messages and labels are drafts for Millena's review). Commit, push and pull requests only when asked.
- **No live checks:** the spec has none, so no keys or cost caps are needed.

## Phase 1: Chapter content and state logic

**Goal:** the chapters, badges and messages exist as constants and the pure logic that turns a question set and the saved answers into segments, earned badges and "show a chapter screen" decisions is tested.

**Covers:** RF-04 Capabilities; criteria 2, 3, 4, 5 and 8 at logic level.

**Steps:**

1. **Chapter content (`chapters`)** - Adds the three chapters with their draft names, badge names and messages, free of any style, percentage or score, as in spec Section 1.
2. **Screen helpers (`questionnaire-state`)** - Adds the pure functions that give the state of each of the 15 segments, the earned chapters, whether a chapter screen is due when advancing and whether the question set has chapters at all.

**Done when:** `chapters.test.ts` and `questionnaire-state.test.ts` pass and the existing suites are still green.

## Phase 2: Components and screen

**Goal:** the customer sees the segmented look progress and the chapter screens, and a version 1 attempt still sees the original bar.

**Covers:** RF-04 Experience; criteria 1, 3, 4, 6, 7 and 8.

**Steps:**

3. **Look progress (`LookProgress`)** - Builds the 15 segments in three groups, the three look pieces drawn as inline icons, the chapter label and the accessible names, keeping the "Pergunta N de 15" label and the progress bar semantics.
4. **Chapter screen (`ChapterScreen`)** - Builds the pause screen with the badge, the message and the "Continuar" button, focus on its title and no animation under reduced motion.
5. **Questionnaire screen** - Wires the two components in: keeps the chapters already shown in this visit, shows the chapter screen before moving on, passes the last "Concluir" through the third badge, and falls back to the original bar when the question set has no chapters.

**Done when:** `look-progress-view.test.ts` and `chapter-screen-view.test.ts` pass and the verification script of spec Section 7 runs through steps 1 to 9 in a browser at 360 px and 1280 px.

## Phase 3: Integration and hardening

**Goal:** the feature is proven to follow the question set of RF-02 and the saved answers of RF-01 end to end, and the accessibility and fallback cases behave as specified.

**Covers:** the two cross-feature criteria where RF-04 is the consumer; criteria 5 and 6; Error Handling of spec Section 1.

**Steps:**

6. **Hand-off RF-02 → RF-04** - Proves with a test that the segments, the three groups and the three duel steps built from the real version 2 match its question set.
7. **Hand-off RF-01 → RF-04** - Proves with a test that the progress and the earned badges rebuilt from really saved answers equal the number of saved steps.
8. **Accessibility and fallback checks** - Verifies keyboard use, the accessible names, reduced motion, the 360 px layout and the version 1 fallback against spec Sections 1 and 7, adding any missing case to the suites named there.

**Done when:** `chapters-handoff.test.ts` (both tests) and all suites of spec Section 7 pass, `npx tsc --noEmit` and `next build` are clean.
