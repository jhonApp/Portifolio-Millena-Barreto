# RF-02. Release notes and hand-over

For the owner. Version 2 of the questionnaire exists in the database as a **draft**. Nothing changes for customers until the publish command below is run.

## Release order

1. Implement RF-03 (look duel screen) and RF-04 (chapters, badges, progress). Until then a duel opens as a plain two-card choice ("Look A" and "Look B"), which is not meant for customers.
2. Millena reviews the draft copy:
   - the question text of the three duels ("Qual look combina mais com você?");
   - the notice "Atualizamos o questionário. Vamos começar de novo?";
   - the maintenance message "Estamos ajustando o questionário. Volte em alguns minutos.";
   - the labels and hint of RF-01 ("1ª escolha", "2ª escolha", "Se mais de uma opção combina com você, escolha uma segunda. É opcional.").
3. Fix any text of version 2 while it is still a draft. The functions `updateQuestionText` and `updateAlternativeText` in `lib/diagnostico/question-bank.ts` only change the text of a draft; there is no admin screen yet.
4. Publish: `npm run quiz:publish -- 2`. Output: `published version 2, archived version 1`. The command fails with a non-zero exit code and names the broken rule if the set is invalid, for example `INVALID_SET: STYLE_BALANCE: romantico appears in 8 steps, expected 9`.

## What happens at the release

- New attempts, and attempts without answers, get version 2.
- An attempt that already has answers keeps version 1 (single choice, no chapters) until it finishes; its stored result and scoring never change.
- A customer who has the questionnaire open without answers gets, on the first tap, a reload on version 2 with the notice above. Nothing is saved from the old page.
- Diagnoses already generated are untouched.

## Rollback

`npm run quiz:publish -- 1` publishes version 1 again and archives version 2. Attempts that already answered on version 2 keep version 2 until they finish.

A published version is never edited. To correct a text that is already live, a new draft version is needed (the original RF-12 admin editor); until it exists, publish the rollback, correct a draft and publish again.

## Contracts consumed by the next features

- **RF-03 and RF-04:** `getPublicQuestionSet(db, seed, versionId?)` returns, for each step, `position`, `chapter` (1 to 3, or `null` in version 1), `kind` (`choice` or `duel`), `maxChoices`, `text` and `alternatives` (`id`, `text` only; never style or weight). A duel is a step with 2 alternatives ("Look A" and "Look B") and `maxChoices = 1`. The order of the alternatives is a seeded shuffle, stable for the same attempt.
- **RF-05:** the view `attempt_version_outcomes` (`attempt_id`, `version_id`, `version`, `started_at`, `reached_checkout`), one row per attempt with at least one answer, with the version of its first answer. It is readable only with the service role.
- **Answers route:** besides RF-01's responses, `409 VERSION_CHANGED` (first answer on a version that is no longer published) and `503 UNAVAILABLE` (no version is published).

## Operating notes

- Migration `20260101000019_questionnaire_v2.sql` is applied with `supabase migration up` only, never `db reset`.
- `save_answer` keeps the signature of RF-01. A pinned attempt may keep saving on an archived version; an attempt without answers must start on the published one.
- While no version is published the questionnaire page shows the maintenance message and nothing is saved. This only happens if every version is archived by hand.
