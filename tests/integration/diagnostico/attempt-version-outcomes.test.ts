import { afterAll, describe, expect, it } from "vitest";
import {
  adminClient,
  cleanupFixture,
  createAttempt,
  createCustomer,
  createOrder,
  createTwoChoiceFixture,
  type TwoChoiceFixture,
} from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const fixtures: TwoChoiceFixture[] = [];

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  for (const fixture of fixtures) await cleanupFixture(db, fixture);
});

async function newAttempt() {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  return createAttempt(db, customer.id);
}

async function newFixture() {
  const fixture = await createTwoChoiceFixture(db);
  fixtures.push(fixture);
  return fixture;
}

async function outcome(attemptId: string) {
  const { data, error } = await db.from("attempt_version_outcomes").select("*").eq("attempt_id", attemptId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function answerRow(attemptId: string, fixture: TwoChoiceFixture, position: number, answeredAt: string) {
  const question = fixture.questions[position - 1];
  return {
    attempt_id: attemptId,
    version_id: fixture.version.id,
    question_id: question.id,
    alternative_id: question.alternatives[0].id,
    answered_at: answeredAt,
  };
}

describe("attempt_version_outcomes", () => {
  it("has one row per attempt with answers, the version of its first answer and reached_checkout from the orders", async () => {
    const fixture = await newFixture();
    const withAnswers = await newAttempt();
    const withOrder = await newAttempt();
    const withoutAnswers = await newAttempt();

    await db.from("answers").insert([
      answerRow(withAnswers.id, fixture, 1, "2026-03-01T10:00:00Z"),
      answerRow(withAnswers.id, fixture, 2, "2026-03-01T10:05:00Z"),
      answerRow(withOrder.id, fixture, 1, "2026-03-02T09:00:00Z"),
    ]);
    await createOrder(db, withOrder.id);

    const first = await outcome(withAnswers.id);
    expect(first).toHaveLength(1);
    expect(first[0]).toEqual({
      attempt_id: withAnswers.id,
      version_id: fixture.version.id,
      version: fixture.version.version,
      started_at: "2026-03-01T10:00:00+00:00",
      reached_checkout: false,
    });

    const second = await outcome(withOrder.id);
    expect(second).toHaveLength(1);
    expect(second[0].reached_checkout).toBe(true);

    // An attempt without answers has not started: it is not in the view.
    expect(await outcome(withoutAnswers.id)).toEqual([]);
  });

  it("reports the version of the first answer when the attempt has answers on two versions", async () => {
    const older = await newFixture();
    const newer = await newFixture();
    const attempt = await newAttempt();
    await db.from("answers").insert([
      answerRow(attempt.id, newer, 1, "2026-03-05T12:00:00Z"),
      answerRow(attempt.id, older, 1, "2026-03-05T11:00:00Z"),
    ]);
    const rows = await outcome(attempt.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].version_id).toBe(older.version.id);
    expect(rows[0].started_at).toBe("2026-03-05T11:00:00+00:00");
  });

  it("is not readable with the anonymous key", async () => {
    const { anonClient } = await import("./helpers");
    const { data, error } = await anonClient().from("attempt_version_outcomes").select("*").limit(1);
    expect(data ?? []).toEqual([]);
    expect(error).not.toBeNull();
  });
});
