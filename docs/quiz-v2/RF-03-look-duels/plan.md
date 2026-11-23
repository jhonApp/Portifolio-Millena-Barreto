# RF-03. Look Duels: Implementation Plan

Spec: docs/quiz-v2/RF-03-look-duels/spec.md · Complexity: simple · Phases: 3

## Prerequisites

- **Features:** RF-03 depends on RF-01 and RF-02 of docs/prd/PRD-Quiz-Multipla-Escolha-Gamificado.md (waves 1 and 2). Both have specs and plans but **are not implemented yet**: migrations `20260101000018` (RF-01) and `20260101000019` (RF-02) must be applied and committed, so that `questions.kind`, `max_choices`, the seeded duel questions and the two-choice answer saving exist. The original RF-01 to RF-09 are implemented (docs/STATUS.md). No Foundation feature is pending.
- **Images:** the light copies in `assets/pdf-images/` already exist (six files). No image is created or downloaded.
- **Database:** the shared local Supabase is running; browser checks use a disposable per-session database. Migrations are applied only with `supabase migration up`. This feature adds no migration.
- **Release order:** version 2 must not be published in a real environment before this feature and RF-04 are implemented and Millena has reviewed the texts.
- **Conventions:** English for code, comments and commit messages; Portuguese for customer-facing text (the captions and alt texts are drafts for Millena's review). Commit, push and pull requests only when asked.
- **No live checks:** the spec has none, so no keys or cost caps are needed.

## Phase 1: Look registry and delivery route

**Goal:** a look can be fetched by the id of its alternative, with no style visible anywhere, and the public question set carries the image data of the duel alternatives.

**Covers:** RF-03 Consumes (duel steps of RF-02) and the no-style rule; criteria 1 and 4 at data level.

**Steps:**

1. **Look registry (`duel-looks`)** - Adds the table that ties each style to its light copy, width and height, and the helper that builds the neutral look address, as in spec Sections 3 and 5.
2. **Look route** - Adds the endpoint that finds the style of a duel alternative on the server and returns the light copy with long cache headers, answering 404 for anything that is not a duel alternative; it also lists the new route in the production file tracing.
3. **Public question set** - Adds the image data (neutral address and size) to the duel alternatives without copying the style into the result, as in spec Section 5.

**Done when:** `duel-looks.test.ts`, `duel-look-route.test.ts` and `duel-public-set.test.ts` pass, and the existing suites are still green.

## Phase 2: Duel screen

**Goal:** a customer can see two looks, pick one, change the pick, and the choice is saved and restored, with an accessible and responsive layout.

**Covers:** RF-03 Experience; criteria 1, 2, 5, 6, 7 and 8.

**Steps:**

4. **Duel screen (`DuelStep`)** - Builds the radio group of two looks with captions, neutral alt texts, selected state with border and checkmark, stacked and side-by-side layout, whole images with reserved proportion and the neutral block when an image fails.
5. **Questionnaire screen** - Chooses the duel screen for duel steps and reuses the existing save, retry and failure messages and the reduced-motion transition, so the duel is saved as a first choice without a second one.

**Done when:** `duel-step-view.test.ts` passes and the verification script of spec Section 7 runs through steps 1 to 8 in a browser at 360 px and 1280 px.

## Phase 3: Integration and hardening

**Goal:** the duel is proven to flow from the question set of RF-02 through the answer saving and scoring of RF-01, and the error cases behave as specified.

**Covers:** the two cross-feature criteria where RF-03 is the consumer; criterion 3; Error Handling of spec Section 1.

**Steps:**

6. **Hand-off RF-02 → RF-03** - Proves with a test that a duel step of the real version 2 reaches the screen data with its neutral ids, position and images and that the choice is saved through RF-01.
7. **Hand-off RF-01 → RF-03** - Proves with a test that a saved duel choice gives exactly 2 points to the chosen style and none to the other.
8. **Error and privacy checks** - Verifies the 404 cases of the route, the image-failure fallback, the save-failure messages and that no response, markup or log names a style, adding any missing case to the suites of spec Section 7.

**Done when:** `duel-handoff.test.ts` (both tests) and all suites of spec Section 7 pass, `npx tsc --noEmit` and `next build` are clean.
