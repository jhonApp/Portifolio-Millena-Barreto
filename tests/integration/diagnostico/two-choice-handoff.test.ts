import { afterAll, describe, expect, it } from "vitest";
import { getSavedChoices, saveAnswer } from "@/lib/diagnostico/answers";
import { loadQuestionBank } from "@/lib/diagnostico/question-bank";
import { loadQuestionnaire } from "@/lib/diagnostico/questionnaire-page";
import {
  adminClient,
  createAttempt,
  createCustomer,
  createVersionFromSteps,
  deleteVersions,
  publishVersionTemporarily,
} from "./helpers";

// Hand-off RF-01 -> RF-02. RF-01 saves a first and a second choice; RF-02 serves the attempt again.
// The choices are saved through the real saveAnswer of RF-01 on a published version 2 structure,
// and read back through the real loader of RF-02: no contract is mocked.

const db = adminClient();
const customerIds: string[] = [];
const versionIds: string[] = [];

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  await deleteVersions(db, versionIds);
});

describe("RF-01 to RF-02 hand-off", () => {
  it("a saved first and second choice are restored by the loader and the first unanswered step is shown", async () => {
    const draft = await createVersionFromSteps(db);
    versionIds.push(draft.id);
    const bank = await loadQuestionBank(db, draft.id);
    const step = (position: number) => bank.questions.find((question) => question.position === position)!;

    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    const attempt = await createAttempt(db, customer.id);

    await publishVersionTemporarily(db, draft.id, async () => {
      // Step 1 with two choices, step 2 with one choice, step 3 with two choices (all through RF-01).
      await saveAnswer(db, attempt.id, step(1).id, step(1).alternatives[0].id, step(1).alternatives[2].id);
      await saveAnswer(db, attempt.id, step(2).id, step(2).alternatives[1].id);
      await saveAnswer(db, attempt.id, step(3).id, step(3).alternatives[3].id, step(3).alternatives[0].id);
    });

    // The version is not published any more (the fixture was restored); the attempt keeps its own.
    const state = await loadQuestionnaire(db, attempt.id);
    expect(state.questionSet.versionId).toBe(draft.id);
    expect(state.choices[step(1).id]).toEqual({ first: step(1).alternatives[0].id, second: step(1).alternatives[2].id });
    expect(state.choices[step(2).id]).toEqual({ first: step(2).alternatives[1].id, second: null });
    expect(state.choices[step(3).id]).toEqual({ first: step(3).alternatives[3].id, second: step(3).alternatives[0].id });
    expect(Object.keys(state.choices)).toHaveLength(3);
    // The first unanswered step is step 4 (index 3), whatever the number of choices saved so far.
    expect(state.startIndex).toBe(3);
    expect(state.questionSet.questions).toHaveLength(15);
    expect(state.questionSet.questions.map((question) => question.maxChoices)).toEqual(
      bank.questions.map((question) => question.maxChoices),
    );
    // What the screen restores is what is stored.
    expect(await getSavedChoices(db, attempt.id)).toEqual(state.choices);
  });
});
