import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAttemptVersion, saveAnswer } from "@/lib/diagnostico/answers";
import { getPublicQuestionSet } from "@/lib/diagnostico/question-bank";
import { adminClient, createAttempt, createCustomer, makeVersionOneLive, publishVersionTemporarily } from "./helpers";

// The version of an attempt comes from its first answer (loading feedback RF-04): the completion
// page uses it to choose between the plain link and the hand-off link.

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

describe("getAttemptVersion", () => {
  it("an attempt without answers has no version", async () => {
    const attempt = await newAttempt();
    expect(await getAttemptVersion(db, attempt.id)).toBeNull();
  });

  it("an attempt with a version 2 answer reports 2", async () => {
    const attempt = await newAttempt();
    await publishVersionTemporarily(db, versionTwoId, async () => {
      const set = await getPublicQuestionSet(db, attempt.id);
      const question = set.questions[0];
      await saveAnswer(db, attempt.id, question.id, question.alternatives[0].id);
    });
    expect(await getAttemptVersion(db, attempt.id)).toBe(2);
  });

  it("an attempt keeps version 1 after version 2 is published", async () => {
    const attempt = await newAttempt();
    const set = await getPublicQuestionSet(db, attempt.id);
    expect(set.version).toBe(1);
    await saveAnswer(db, attempt.id, set.questions[0].id, set.questions[0].alternatives[0].id);
    await publishVersionTemporarily(db, versionTwoId, async () => {
      expect(await getAttemptVersion(db, attempt.id)).toBe(1);
    });
  });
});
