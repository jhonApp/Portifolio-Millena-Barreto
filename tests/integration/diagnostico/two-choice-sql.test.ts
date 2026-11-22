import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AnswerError, getSavedChoices, saveAnswer } from "@/lib/diagnostico/answers";
import { getScoredAnswers, getScoringRules } from "@/lib/diagnostico/question-bank";
import { loadQuestionnaire } from "@/lib/diagnostico/questionnaire-page";
import {
  adminClient,
  cleanupFixture,
  createAttempt,
  createCustomer,
  createTwoChoiceFixture,
  pinAttemptToVersion,
  type TwoChoiceFixture,
} from "./helpers";

// save_answer with an optional second choice (quiz v2 RF-01), on a non-published fixture version
// with the version 2 rules. Version 1 is never touched.

const db = adminClient();
const customerIds: string[] = [];
let fixture: TwoChoiceFixture;

/** A new attempt pinned to the fixture (its first answer is on question 1, first alternative). */
async function pinnedAttempt() {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  const attempt = await createAttempt(db, customer.id);
  await pinAttemptToVersion(db, attempt.id, fixture);
  return attempt;
}

const alt = (question: number, position: number) => fixture.questions[question - 1].alternatives[position - 1].id;
const qid = (question: number) => fixture.questions[question - 1].id;

async function rejectedWith(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AnswerError);
    return (error as AnswerError).code;
  }
  throw new Error("expected the save to be rejected");
}

beforeAll(async () => {
  fixture = await createTwoChoiceFixture(db);
});

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  await cleanupFixture(db, fixture);
});

describe("save_answer with a second choice", () => {
  it("saves a first and a second choice in one row", async () => {
    const attempt = await pinnedAttempt();
    const count = await saveAnswer(db, attempt.id, qid(2), alt(2, 1), alt(2, 2));
    expect(count).toBe(2);
    const { data } = await db.from("answers").select("*").eq("attempt_id", attempt.id).eq("question_id", qid(2));
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ alternative_id: alt(2, 1), second_alternative_id: alt(2, 2) });
    expect(await getSavedChoices(db, attempt.id)).toMatchObject({
      [qid(2)]: { first: alt(2, 1), second: alt(2, 2) },
    });
  });

  it("a new second alternative replaces the previous one", async () => {
    const attempt = await pinnedAttempt();
    await saveAnswer(db, attempt.id, qid(2), alt(2, 1), alt(2, 2));
    await saveAnswer(db, attempt.id, qid(2), alt(2, 1), alt(2, 3));
    expect((await getSavedChoices(db, attempt.id))[qid(2)]).toEqual({ first: alt(2, 1), second: alt(2, 3) });
  });

  it("a save without a second choice clears it, and the first choice can change", async () => {
    const attempt = await pinnedAttempt();
    await saveAnswer(db, attempt.id, qid(2), alt(2, 1), alt(2, 2));
    await saveAnswer(db, attempt.id, qid(2), alt(2, 1));
    expect((await getSavedChoices(db, attempt.id))[qid(2)]).toEqual({ first: alt(2, 1), second: null });
    await saveAnswer(db, attempt.id, qid(2), alt(2, 4), null);
    expect((await getSavedChoices(db, attempt.id))[qid(2)]).toEqual({ first: alt(2, 4), second: null });
  });

  it("the answered count stays the number of questions, not of choices", async () => {
    const attempt = await pinnedAttempt();
    expect(await saveAnswer(db, attempt.id, qid(2), alt(2, 1), alt(2, 2))).toBe(2);
    expect(await saveAnswer(db, attempt.id, qid(3), alt(3, 1), alt(3, 2))).toBe(3);
    expect(await saveAnswer(db, attempt.id, qid(3), alt(3, 1), alt(3, 3))).toBe(3);
  });

  it("refuses the same alternative as first and second choice", async () => {
    const attempt = await pinnedAttempt();
    expect(await rejectedWith(saveAnswer(db, attempt.id, qid(2), alt(2, 1), alt(2, 1)))).toBe("CHOICE_NOT_ALLOWED");
    expect(await getSavedChoices(db, attempt.id)).not.toHaveProperty(qid(2));
  });

  it("refuses a second alternative of another question", async () => {
    const attempt = await pinnedAttempt();
    expect(await rejectedWith(saveAnswer(db, attempt.id, qid(2), alt(2, 1), alt(3, 1)))).toBe("ALTERNATIVE_MISMATCH");
  });

  it("refuses a second choice on a single-choice question", async () => {
    const attempt = await pinnedAttempt();
    expect(await rejectedWith(saveAnswer(db, attempt.id, qid(4), alt(4, 1), alt(4, 2)))).toBe("CHOICE_NOT_ALLOWED");
    expect(await saveAnswer(db, attempt.id, qid(4), alt(4, 1))).toBe(2);
  });

  it("overlapping saves of one question are serialized and leave one consistent state", async () => {
    const attempt = await pinnedAttempt();
    const states = [alt(2, 2), alt(2, 3), alt(2, 4), null, alt(2, 2), alt(2, 3), null, alt(2, 4)];
    const counts = await Promise.all(states.map((second) => saveAnswer(db, attempt.id, qid(2), alt(2, 1), second)));
    expect(counts.every((count) => count === 2)).toBe(true);
    const { data } = await db.from("answers").select("alternative_id, second_alternative_id").eq("attempt_id", attempt.id).eq("question_id", qid(2));
    expect(data).toHaveLength(1);
    expect(data![0].alternative_id).toBe(alt(2, 1));
    expect([alt(2, 2), alt(2, 3), alt(2, 4), null]).toContain(data![0].second_alternative_id);
  });

  it("a call with three arguments still works (version 1 compatibility)", async () => {
    const attempt = await pinnedAttempt();
    const { error } = await db.rpc("save_answer", {
      p_attempt: attempt.id,
      p_question: qid(3),
      p_alternative: alt(3, 2),
    });
    expect(error).toBeNull();
    expect((await getSavedChoices(db, attempt.id))[qid(3)]).toEqual({ first: alt(3, 2), second: null });
  });

  it("an attempt without answers cannot start on a version that is not published", async () => {
    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    const attempt = await createAttempt(db, customer.id);
    expect(await rejectedWith(saveAnswer(db, attempt.id, qid(1), alt(1, 1), alt(1, 2)))).toBe("VERSION_MISMATCH");
  });
});

describe("scoring reads of a two-choice attempt", () => {
  it("getScoredAnswers returns one item per choice with its rank", async () => {
    const attempt = await pinnedAttempt();
    await saveAnswer(db, attempt.id, qid(2), alt(2, 1), alt(2, 2));
    const items = await getScoredAnswers(db, attempt.id);
    expect(items).toHaveLength(3); // question 1 (first only) and question 2 (first and second)
    const second = items.filter((item) => item.rank === 2);
    expect(second).toEqual([{ questionPosition: 2, style: "tradicional", weight: 1, rank: 2 }]);
    expect(items.filter((item) => item.rank === 1).map((item) => item.questionPosition).sort()).toEqual([1, 2]);
  });

  it("getScoringRules reads the rules of the version stored on the answers", async () => {
    const attempt = await pinnedAttempt();
    expect(await getScoringRules(db, attempt.id)).toEqual({ firstPoints: 2, secondPoints: 1, lateBasis: "points" });
  });

  it("getScoringRules gives the version 1 rules to an attempt without answers or on version 1", async () => {
    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    const attempt = await createAttempt(db, customer.id);
    expect(await getScoringRules(db, attempt.id)).toEqual({ firstPoints: 1, secondPoints: 0, lateBasis: "answers" });
  });
});

describe("questionnaire loader with two choices", () => {
  it("loadQuestionnaire restores both choices, maxChoices and the first unanswered step", async () => {
    const attempt = await pinnedAttempt();
    await saveAnswer(db, attempt.id, qid(2), alt(2, 1), alt(2, 3));
    const state = await loadQuestionnaire(db, attempt.id);
    expect(state.choices[qid(2)]).toEqual({ first: alt(2, 1), second: alt(2, 3) });
    expect(state.choices[qid(1)]).toEqual({ first: alt(1, 1), second: null });
    expect(state.answers[qid(2)]).toBe(alt(2, 1)); // first choices only
    expect(state.startIndex).toBe(2); // question 3 is the first without an answer
    expect(state.questionSet.questions.map((question) => question.maxChoices)).toEqual([2, 2, 2, 1]);
    // The public set never carries a style or a weight.
    expect(JSON.stringify(state.questionSet)).not.toMatch(/"style"|"weight"/);
  });
});
