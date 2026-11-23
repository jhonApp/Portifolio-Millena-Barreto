import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSavedChoices, saveAnswer } from "@/lib/diagnostico/answers";
import { getPublicQuestionSet } from "@/lib/diagnostico/question-bank";
import { chapterToShow, earnedChapters, hasChapters, segmentStates } from "@/lib/diagnostico/questionnaire-state";
import { adminClient, createAttempt, createCustomer, makeVersionOneLive, publishVersionTemporarily } from "./helpers";

// Hand-offs of RF-04 as the consumer. RF-02 gives the chapter and the kind of every step of version
// 2; RF-01 saves the answers the progress is rebuilt from. Both contracts are the real ones.

const db = adminClient();
const customerIds: string[] = [];
let restoreLive: () => Promise<void>;
let versionTwoId: string;

beforeAll(async () => {
  restoreLive = await makeVersionOneLive(db);
  const { data } = await db.from("questionnaire_versions").select("id").eq("version", 2).single();
  versionTwoId = data!.id;
});

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  await restoreLive();
});

async function newAttempt() {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  return createAttempt(db, customer.id);
}

describe("RF-02 to RF-04 hand-off", () => {
  it("the progress built from the real version 2 has 15 segments, 3 groups of 5 and 3 duel steps", async () => {
    const attempt = await newAttempt();
    const set = await getPublicQuestionSet(db, attempt.id, versionTwoId);
    expect(set.version).toBe(2);
    expect(hasChapters(set.questions)).toBe(true);

    const segments = segmentStates(set.questions, {}, 0);
    expect(segments).toHaveLength(15);
    for (const chapter of [1, 2, 3]) {
      expect(segments.filter((segment) => segment.chapter === chapter)).toHaveLength(5);
    }
    const duelPositions = set.questions.filter((question) => question.kind === "duel").map((question) => question.position);
    expect(duelPositions).toEqual([5, 10, 15]);
    // Each chapter ends on a duel, so each chapter screen follows a duel step.
    const all = Object.fromEntries(set.questions.map((question) => [question.id, true]));
    for (const [chapter, position] of [[1, 5], [2, 10], [3, 15]] as const) {
      expect(chapterToShow(set.questions, all, position - 1, new Set())).toBe(chapter);
    }
  });
});

describe("RF-01 to RF-04 hand-off", () => {
  it("the progress and the earned badges of a returning customer match her saved answers", async () => {
    const attempt = await newAttempt();
    await publishVersionTemporarily(db, versionTwoId, async () => {
      const set = await getPublicQuestionSet(db, attempt.id);
      expect(set.version).toBe(2);

      const answer = async (from: number, to: number) => {
        for (const question of set.questions.slice(from, to)) {
          await saveAnswer(db, attempt.id, question.id, question.alternatives[0].id);
        }
      };

      await answer(0, 7);
      let saved = await getSavedChoices(db, attempt.id);
      let segments = segmentStates(set.questions, saved, 7);
      expect(segments.filter((segment) => segment.filled)).toHaveLength(7);
      expect(earnedChapters(set.questions, saved)).toEqual([1]);

      await answer(7, 10);
      saved = await getSavedChoices(db, attempt.id);
      segments = segmentStates(set.questions, saved, 10);
      expect(segments.filter((segment) => segment.filled)).toHaveLength(10);
      expect(earnedChapters(set.questions, saved)).toEqual([1, 2]);
    });
  });
});
