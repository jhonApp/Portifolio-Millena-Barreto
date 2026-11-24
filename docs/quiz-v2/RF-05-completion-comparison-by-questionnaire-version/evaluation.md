# Evaluation: RF-05 Completion Comparison by Questionnaire Version

## Re-check after approval (closing cycle 1): failed evaluation
Date: 2026-11-23
Commit evaluated: 00bc755 (unchanged), branch feat/result-consultancy-cta, base 13420c5
Owner input: `approved: schema`, `approved: dependencies` (2026-11-23). Cycle 1 ended in `needs human`, so this re-check closes cycle 1 and is not a new cycle.

| Check | Result | Evidence |
|---|---|---|
| Lint, typecheck, unit tests | pass (rerun) | lint no error, `tsc` exit 0, unit 48 files, 346/346 |
| Integration suite, project command | **fail** | 43 files, 443/444. Failing test, now identified: `tests/integration/diagnostico/delivery.test.ts` > `runDueDeliveries sends a due retry and skips one that is not due`, "Test timed out in 30000ms". The same file alone: 26/26 in 67 s. So the failure is the unexplained one of run 1 of cycle 1: it failed in 2 of 4 whole-suite runs |
| Named tests, test diff, Component Overview | pass | Unchanged since cycle 1 |
| Criteria | 5/5 ✓ | Same mapping and evidence as below; the RF-05 tests passed again in this run |
| Gates | schema: approved by the owner on 2026-11-23. dependencies: approved by the owner on 2026-11-23. Others not fired |

Finding: the failing test is outside RF-05 (original RF-08 delivery pipeline, not touched by `base..HEAD`), a 30 s timeout in a slow whole-suite run, the same kind as the RF-01 cycle 2 failure. The rule is that a failure of the whole suite is a finding whoever caused it, so the status cannot be `success`.
Fix hint: give that test (or the file) a larger timeout, as was done for `generation-job` and the PDF test, then re-run the verification. This is the last rework: one cycle is left.
The database was checked again after the run: versions 1 published and 2 draft, customers 7, orders 5.

## Cycle 1 of 2: needs human
Date: 2026-11-23
Commit evaluated: 00bc755, branch feat/result-consultancy-cta, base 13420c5
Judging: model-assisted (gates fired), one criterion at a time from its test and the Step 4 run
Overrides: none
Owner input: the full integration suite on the shared local database was allowed for this run.

### Deterministic checks
| Check | Result | Evidence |
|---|---|---|
| Full suite (lint, typecheck, tests) | pass, with one unexplained failure | `npm run lint` no error. `tsc --noEmit` exit 0. `npm test`: 48 files, 346/346. `npm run test:integration`: run 1 had 443/444 (1 failed; the name was lost because only the tail of the output was kept), run 2 and run 3 (output kept to a file) 43 files, 444/444, none skipped. The failed test is unidentified and did not repeat; the RF-01 evaluation records a known flaky timeout in `generation-job` (see Soft-fails) |
| Named tests exist and ran | pass | The 4 acceptance tests, the "also covered" tests and the hand-off test of the spec ran and passed (`version-comparison.test.ts` and `quiz-compare-script.test.ts`: 29/29 in verbose; `version-comparison-handoff.test.ts` 1/1, alone and in the full runs) |
| Test diff against the base | pass | RF-05 commits only add test files (`quiz-compare-script.test.ts`, `version-comparison-handoff.test.ts`, `version-comparison.test.ts`); no deletion, no new `skip`, `todo` or `xfail` in `base..HEAD` |
| Architecture contracts | pass | No architecture-test configuration |
| Component Overview | pass | `lib/diagnostico/version-comparison.mjs` (constants and the five functions), `scripts/quiz-compare.mjs`, the `quiz:compare` script in `package.json` and the three test files exist; `.from(` appears once, on the view |
| Live evidence | n/a | Spec: no live checks |

### Criteria
- ✓ 1. 120 attempts, 60 at the checkout: 120, 60 and 50% (version-comparison.test.ts::120 started and 60 at the checkout give 50.0%, formatTable shows 120, 60 and 50,0% for version 1; the real command against the local database printed 7 started, 5 at the checkout, 71,4%, equal to a direct SQL count 7 and 5)
- ✓ 2. Fewer than 100 attempts is marked "poucos dados"; exactly 100 is not (tests with 99 and 100 attempts; the real run shows "(poucos dados)" for 7 attempts)
- ✓ 3. More than 5 points below version 1 carries the warning; exactly 5 does not (tests with 10 points, exactly 5, the unrounded difference and no version 1; the database has only version 1, so the warning is covered by the unit tests, which feed the real module with rows)
- ✓ 4. Only the view is read, nothing is written or tracked (quiz-compare-script.test.ts: the only `.from(` is `VIEW`, no `insert`, `update`, `delete`, `upsert`, `rpc` or `fetch`; my own grep of both files agrees)
- ✓ 5. RF-02 to RF-05 hand-off (version-comparison-handoff.test.ts: real answer saving, real publishing of version 2, real orders and the real view; asserts the increases 3, 2, 2 and 1, one row per attempt with its version and the reach of the same attempt; passed in the three full runs)

Criteria: 5/5.

### Application run
- Command `npm run quiz:compare` (read only, local database): table with version 1, 7 started, 5 at the checkout, 71,4%, "—", "(poucos dados)", exit 0.
- `--json`: same figures, `ratePercent` 71.4, `fewData` true, `warning` false, exit 0.
- `--since 2026-11-23`: period on the first line and "Nenhuma tentativa no período.", exit 0.
- `--since ontem`: "Data inválida em --since: use AAAA-MM-DD", exit 1. `--x`: the usage line, exit 1.
- No key and no attempt id in any output.
- Verification script: not applicable (spec: no DOM criterion).
- The integration suite restored the database: versions 1 published and 2 draft with the same ids and dates, customers 7, orders 5, as before.

### Gates
- schema: fired by `base..HEAD` (migrations 18 and 19, from RF-01 and RF-02). Not approved in this run's input.
- dependencies: fired by `base..HEAD` (`package.json`, including the new `quiz:compare` script of this feature). Not approved in this run's input.
- security, adr, architecture-contract: not fired.

### Findings
1. No failure that repeats. One of three integration runs had one failing test that I could not name (see Soft-fails).

### Soft-fails
- Integration run 1: 443/444, one unidentified failure; runs 2 and 3 passed 444/444. Probably the known timing-sensitive tests on a busy machine, but I did not prove it.
- No per-session database: the tests use the shared local Supabase.

### What I did not verify
- The warning and a version 2 row against real data (the database holds only version 1 attempts); only the unit tests and the hand-off test cover them.
- Windows only; no other terminal or Node version.
- `next build` on this commit.
- Whether another session used the shared database during the three integration runs.

**To reach `success`, the owner has to decide:** approve or reject the gates `schema` and `dependencies` for this run (`approved: schema`, `approved: dependencies`), and say whether the unidentified integration failure needs an investigation before that.
