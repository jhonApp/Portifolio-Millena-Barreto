import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signAttemptId, ATTEMPT_COOKIE } from "@/lib/diagnostico/attempt-session";
import {
  getActiveAttemptId,
  getAnswerProgress,
  getAttemptVersionId,
  getSavedAnswers,
  getSavedChoices,
  saveAnswer,
} from "@/lib/diagnostico/answers";
import { getPublicQuestionSet, loadQuestionBank } from "@/lib/diagnostico/question-bank";
import {
  adminClient,
  cleanupFixture,
  createAttempt,
  createCustomer,
  createTwoChoiceFixture,
  pinAttemptToVersion,
} from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
let bank: Awaited<ReturnType<typeof loadQuestionBank>>;

function storeWith(value?: string) {
  return { get: (name: string) => (name === ATTEMPT_COOKIE && value ? { value } : undefined) };
}

async function newAttempt() {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  return createAttempt(db, customer.id);
}

/** Answers questions at the given positions with their first alternative. */
async function answer(attemptId: string, positions: number[]) {
  for (const position of positions) {
    const question = bank.questions.find((q) => q.position === position)!;
    await saveAnswer(db, attemptId, question.id, question.alternatives[0].id);
  }
}

beforeAll(async () => {
  bank = await loadQuestionBank(db);
});

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
});

describe("answer helpers", () => {
  it("progress is empty for a new attempt", async () => {
    const attempt = await newAttempt();
    expect(await getAnswerProgress(db, attempt.id)).toEqual({
      versionId: null,
      answeredCount: 0,
      firstUnansweredPosition: 1,
    });
    expect(await getSavedAnswers(db, attempt.id)).toEqual({});
    expect(await getAttemptVersionId(db, attempt.id)).toBeNull();
  });

  it("firstUnansweredPosition is the first gap, not the count", async () => {
    const attempt = await newAttempt();
    await answer(attempt.id, [1, 2, 4]);
    const progress = await getAnswerProgress(db, attempt.id);
    expect(progress.answeredCount).toBe(3);
    expect(progress.firstUnansweredPosition).toBe(3);
  });

  it("all answered gives no unanswered position", async () => {
    const attempt = await newAttempt();
    await answer(attempt.id, Array.from({ length: 15 }, (_, i) => i + 1));
    expect(await getAnswerProgress(db, attempt.id)).toMatchObject({
      answeredCount: 15,
      firstUnansweredPosition: null,
    });
  });

  it("the version of an attempt comes from its first answer", async () => {
    const attempt = await newAttempt();
    await answer(attempt.id, [1]);
    expect(await getAttemptVersionId(db, attempt.id)).toBe(bank.versionId);
    expect((await getAnswerProgress(db, attempt.id)).versionId).toBe(bank.versionId);
  });

  it("getSavedAnswers maps question to alternative", async () => {
    const attempt = await newAttempt();
    await answer(attempt.id, [1, 2]);
    const saved = await getSavedAnswers(db, attempt.id);
    const q1 = bank.questions[0];
    const q2 = bank.questions[1];
    expect(saved).toEqual({ [q1.id]: q1.alternatives[0].id, [q2.id]: q2.alternatives[0].id });
  });

  it("a pinned archived version is still served", async () => {
    const attempt = await newAttempt();
    await answer(attempt.id, [1]);
    const pinned = (await getAttemptVersionId(db, attempt.id))!;
    await db.from("questionnaire_versions").update({ status: "archived" }).eq("id", pinned);
    try {
      const served = await getPublicQuestionSet(db, attempt.id, pinned);
      expect(served.versionId).toBe(pinned);
      expect(served.questions).toHaveLength(15);
    } finally {
      await db.from("questionnaire_versions").update({ status: "published" }).eq("id", pinned);
    }
  });
});

describe("active attempt from the cookie", () => {
  it("no cookie yields no active attempt", async () => {
    expect(await getActiveAttemptId(db, storeWith())).toBeNull();
  });

  it("a tampered cookie yields no active attempt", async () => {
    const attempt = await newAttempt();
    const other = "11111111-2222-4333-8444-555555555555";
    const signature = signAttemptId(attempt.id).split(".")[1];
    expect(await getActiveAttemptId(db, storeWith(`${other}.${signature}`))).toBeNull();
    expect(await getActiveAttemptId(db, storeWith(attempt.id))).toBeNull();
  });

  it("a valid cookie yields the attempt", async () => {
    const attempt = await newAttempt();
    expect(await getActiveAttemptId(db, storeWith(signAttemptId(attempt.id)))).toBe(attempt.id);
  });

  it("an expired attempt yields no active attempt", async () => {
    const attempt = await newAttempt();
    await db
      .from("purchase_attempts")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", attempt.id);
    expect(await getActiveAttemptId(db, storeWith(signAttemptId(attempt.id)))).toBeNull();
  });

  it("a deleted attempt yields no active attempt", async () => {
    const attempt = await newAttempt();
    const cookie = signAttemptId(attempt.id);
    await db.from("purchase_attempts").delete().eq("id", attempt.id);
    expect(await getActiveAttemptId(db, storeWith(cookie))).toBeNull();
  });
});

describe("answer helpers with second choices", () => {
  it("getSavedChoices reads the first and second choice of each question", async () => {
    const attempt = await newAttempt();
    await answer(attempt.id, [1]);
    const choices = await getSavedChoices(db, attempt.id);
    const question = bank.questions.find((q) => q.position === 1)!;
    expect(choices).toEqual({ [question.id]: { first: question.alternatives[0].id, second: null } });
    // getSavedAnswers keeps returning the first choice only.
    expect(await getSavedAnswers(db, attempt.id)).toEqual({ [question.id]: question.alternatives[0].id });
  });

  it("second choices do not change the first unanswered position", async () => {
    const fixture = await createTwoChoiceFixture(db);
    try {
      const attempt = await newAttempt();
      await pinAttemptToVersion(db, attempt.id, fixture);
      for (const position of [2, 3]) {
        const question = fixture.questions[position - 1];
        await saveAnswer(db, attempt.id, question.id, question.alternatives[0].id, question.alternatives[1].id);
      }
      const progress = await getAnswerProgress(db, attempt.id);
      expect(progress).toEqual({
        versionId: fixture.version.id,
        answeredCount: 3, // questions, not choices (5)
        firstUnansweredPosition: 4,
      });
      const choices = await getSavedChoices(db, attempt.id);
      expect(Object.keys(choices)).toHaveLength(3);
    } finally {
      await db.from("customers").delete().in("id", customerIds);
      customerIds.length = 0;
      await cleanupFixture(db, fixture);
    }
  });
});
