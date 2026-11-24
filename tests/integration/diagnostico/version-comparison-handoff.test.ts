import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveAnswer } from "@/lib/diagnostico/answers";
import { getPublicQuestionSet } from "@/lib/diagnostico/question-bank";
import { readOutcomeRows, summarizeVersions } from "@/lib/diagnostico/version-comparison.mjs";
import { adminClient, createAttempt, createCustomer, createOrder, makeVersionOneLive, publishVersionTemporarily } from "./helpers";

// Hand-off of RF-05 as the consumer of RF-02. Attempts are served and pinned by the real answer
// saving; the real view attempt_version_outcomes is read through the module. The database is shared,
// so the test compares the figures before and after with the counts it created.

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

async function summary() {
  const rows = await readOutcomeRows(db);
  const byVersion = new Map(summarizeVersions(rows).map((item) => [item.version, item]));
  const figures = (version: number) => ({
    started: byVersion.get(version)?.started ?? 0,
    reached: byVersion.get(version)?.reachedCheckout ?? 0,
  });
  return { one: figures(1), two: figures(2), rows };
}

/** A new attempt that answers `answers` steps of the version that is live now, and optionally has orders. */
async function attemptWith(answers: number, orders: number) {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  const attempt = await createAttempt(db, customer.id);
  const set = await getPublicQuestionSet(db, attempt.id);
  for (const question of set.questions.slice(0, answers)) {
    await saveAnswer(db, attempt.id, question.id, question.alternatives[0].id);
  }
  for (let i = 0; i < orders; i++) await createOrder(db, attempt.id, i === 0 ? "PENDING" : "FAILED");
  return { attemptId: attempt.id, version: set.version };
}

describe("RF-02 to RF-05 hand-off", () => {
  it("each attempt is counted once under the version it started on, with its checkout reach", async () => {
    const before = await summary();

    const created: { attemptId: string; version: number }[] = [];
    // Version 1 is published: three attempts with 3, 1 and 15 answers; two of them reach the checkout
    // (one of those with two orders, which still counts once); a fourth never answers (not listed).
    created.push(await attemptWith(3, 0), await attemptWith(1, 1), await attemptWith(15, 2));
    const silent = await createCustomer(db);
    customerIds.push(silent.id);
    const noAnswers = await createAttempt(db, silent.id);

    // Version 2 is published: two attempts with 2 and 1 answers; one reaches the checkout.
    await publishVersionTemporarily(db, versionTwoId, async () => {
      created.push(await attemptWith(2, 1), await attemptWith(1, 0));
    });
    expect(created.map((item) => item.version)).toEqual([1, 1, 1, 2, 2]);

    const after = await summary();
    expect(after.one.started - before.one.started).toBe(3);
    expect(after.one.reached - before.one.reached).toBe(2);
    expect(after.two.started - before.two.started).toBe(2);
    expect(after.two.reached - before.two.reached).toBe(1);

    // Each attempt appears exactly once in the view, with the version it started on.
    for (const item of created) {
      const own = after.rows.filter((row: { attempt_id: string }) => row.attempt_id === item.attemptId);
      expect(own).toHaveLength(1);
      expect(own[0].version).toBe(item.version);
    }
    expect(after.rows.some((row: { attempt_id: string }) => row.attempt_id === noAnswers.id)).toBe(false);
    // The checkout reach is the one of the same attempt.
    const reach = (id: string) => after.rows.find((row: { attempt_id: string }) => row.attempt_id === id)!.reached_checkout;
    expect(created.map((item) => reach(item.attemptId))).toEqual([false, true, true, true, false]);
  });
});
