import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PUT } from "@/app/api/diagnostico/answers/route";
import { ATTEMPT_COOKIE, signAttemptId } from "@/lib/diagnostico/attempt-session";
import { loadQuestionBank } from "@/lib/diagnostico/question-bank";
import {
  adminClient,
  createAttempt,
  createCustomer,
  createFullVersion,
} from "./helpers";

const db = adminClient();
const customerIds: string[] = [];
const versionIds: string[] = [];
let bank: Awaited<ReturnType<typeof loadQuestionBank>>;

function put(body: unknown, cookie?: string, raw?: string) {
  return PUT(
    new Request("http://localhost/api/diagnostico/answers", {
      method: "PUT",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: raw ?? JSON.stringify(body),
    }),
  );
}

const cookieFor = (attemptId: string) => `${ATTEMPT_COOKIE}=${signAttemptId(attemptId)}`;

async function newAttempt() {
  const customer = await createCustomer(db);
  customerIds.push(customer.id);
  return createAttempt(db, customer.id);
}

const q = (position: number) => bank.questions.find((item) => item.position === position)!;

async function rows(attemptId: string) {
  const { data } = await db.from("answers").select("*").eq("attempt_id", attemptId);
  return data ?? [];
}

async function setStatus(id: string, status: "draft" | "published" | "archived") {
  const { error } = await db.from("questionnaire_versions").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

beforeAll(async () => {
  bank = await loadQuestionBank(db);
});

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  if (versionIds.length) await db.from("questionnaire_versions").delete().in("id", versionIds);
});

describe("PUT /api/diagnostico/answers", () => {
  it("first answer is saved for the attempt of the cookie", async () => {
    const attempt = await newAttempt();
    const response = await put(
      { questionId: q(1).id, alternativeId: q(1).alternatives[0].id },
      cookieFor(attempt.id),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ answeredCount: 1 });
    const saved = await rows(attempt.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      attempt_id: attempt.id,
      question_id: q(1).id,
      alternative_id: q(1).alternatives[0].id,
      version_id: bank.versionId,
    });
  });

  it("answeredCount grows with each new question", async () => {
    const attempt = await newAttempt();
    for (const position of [1, 2, 3]) {
      const response = await put(
        { questionId: q(position).id, alternativeId: q(position).alternatives[1].id },
        cookieFor(attempt.id),
      );
      expect((await response.json()).answeredCount).toBe(position);
    }
  });

  it("changing an answer replaces the saved one", async () => {
    const attempt = await newAttempt();
    const cookie = cookieFor(attempt.id);
    await put({ questionId: q(3).id, alternativeId: q(3).alternatives[0].id }, cookie);
    const response = await put({ questionId: q(3).id, alternativeId: q(3).alternatives[2].id }, cookie);
    expect(response.status).toBe(200);
    const saved = await rows(attempt.id);
    expect(saved).toHaveLength(1);
    expect(saved[0].alternative_id).toBe(q(3).alternatives[2].id);
  });

  it("answeredCount does not grow when an answer is replaced", async () => {
    const attempt = await newAttempt();
    const cookie = cookieFor(attempt.id);
    await put({ questionId: q(1).id, alternativeId: q(1).alternatives[0].id }, cookie);
    await put({ questionId: q(2).id, alternativeId: q(2).alternatives[0].id }, cookie);
    const replaced = await put({ questionId: q(1).id, alternativeId: q(1).alternatives[3].id }, cookie);
    expect((await replaced.json()).answeredCount).toBe(2);
  });

  it("request without cookie gets 403", async () => {
    const response = await put({ questionId: q(1).id, alternativeId: q(1).alternatives[0].id });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("tampered cookie gets 403", async () => {
    const attempt = await newAttempt();
    const other = "11111111-2222-4333-8444-555555555555";
    const signature = signAttemptId(attempt.id).split(".")[1];
    const response = await put(
      { questionId: q(1).id, alternativeId: q(1).alternatives[0].id },
      `${ATTEMPT_COOKIE}=${other}.${signature}`,
    );
    expect(response.status).toBe(403);
    expect(await rows(attempt.id)).toHaveLength(0);
  });

  it("expired attempt gets 403", async () => {
    const attempt = await newAttempt();
    await db
      .from("purchase_attempts")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", attempt.id);
    const response = await put(
      { questionId: q(1).id, alternativeId: q(1).alternatives[0].id },
      cookieFor(attempt.id),
    );
    expect(response.status).toBe(403);
    expect(await rows(attempt.id)).toHaveLength(0);
  });

  it("alternative from another question gets 400", async () => {
    const attempt = await newAttempt();
    const response = await put(
      { questionId: q(1).id, alternativeId: q(2).alternatives[0].id },
      cookieFor(attempt.id),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.fields.alternativeId).toBeDefined();
    expect(await rows(attempt.id)).toHaveLength(0);
  });

  it("unknown ids get 400", async () => {
    const attempt = await newAttempt();
    const unknown = await put({ questionId: randomUUID(), alternativeId: randomUUID() }, cookieFor(attempt.id));
    expect(unknown.status).toBe(400);
    const malformed = await put({ questionId: "x", alternativeId: "y" }, cookieFor(attempt.id));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.fields.questionId).toBeDefined();
  });

  it("invalid JSON gets INVALID_JSON", async () => {
    const attempt = await newAttempt();
    const response = await put(null, cookieFor(attempt.id), "{not json");
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_JSON");
  });

  it("answers of one attempt never touch another attempt", async () => {
    const first = await newAttempt();
    const second = await newAttempt();
    await put({ questionId: q(1).id, alternativeId: q(1).alternatives[0].id }, cookieFor(first.id));
    expect(await rows(second.id)).toHaveLength(0);
    await put({ questionId: q(1).id, alternativeId: q(1).alternatives[1].id }, cookieFor(second.id));
    expect((await rows(first.id))[0].alternative_id).toBe(q(1).alternatives[0].id);
    expect((await rows(second.id))[0].alternative_id).toBe(q(1).alternatives[1].id);
  });

  it("attempt is pinned to the version of its first answer", async () => {
    const other = await createFullVersion(db, "archived");
    versionIds.push(other.version.id);

    const pinned = await newAttempt();
    await put({ questionId: q(1).id, alternativeId: q(1).alternatives[0].id }, cookieFor(pinned.id));

    // Publish the other version: version 1 becomes archived.
    await setStatus(bank.versionId, "archived");
    await setStatus(other.version.id, "published");
    try {
      const otherQuestion = other.questions[1];
      // The pinned attempt cannot move to the new version...
      const mixed = await put(
        { questionId: otherQuestion.id, alternativeId: otherQuestion.alternatives[0].id },
        cookieFor(pinned.id),
      );
      expect(mixed.status).toBe(400);
      // ...but can keep answering version 1, even though it is archived now.
      const stays = await put({ questionId: q(2).id, alternativeId: q(2).alternatives[0].id }, cookieFor(pinned.id));
      expect(stays.status).toBe(200);
      expect((await stays.json()).answeredCount).toBe(2);

      // A new attempt starts on the published version and cannot answer the archived one.
      const fresh = await newAttempt();
      const onOld = await put({ questionId: q(1).id, alternativeId: q(1).alternatives[0].id }, cookieFor(fresh.id));
      expect(onOld.status).toBe(400);
      const onNew = await put(
        { questionId: other.questions[0].id, alternativeId: other.questions[0].alternatives[0].id },
        cookieFor(fresh.id),
      );
      expect(onNew.status).toBe(200);
    } finally {
      await setStatus(other.version.id, "archived");
      await setStatus(bank.versionId, "published");
    }
  });

  it("first answer on a non-published version is rejected", async () => {
    const archived = await createFullVersion(db, "archived");
    versionIds.push(archived.version.id);
    const attempt = await newAttempt();
    const response = await put(
      { questionId: archived.questions[0].id, alternativeId: archived.questions[0].alternatives[0].id },
      cookieFor(attempt.id),
    );
    expect(response.status).toBe(400);
    expect(await rows(attempt.id)).toHaveLength(0);
  });

  it("concurrent saves for one attempt keep one row per question", async () => {
    const attempt = await newAttempt();
    const cookie = cookieFor(attempt.id);
    const results = await Promise.all(
      q(1).alternatives.map((alternative) => put({ questionId: q(1).id, alternativeId: alternative.id }, cookie)),
    );
    expect(results.every((response) => response.status === 200)).toBe(true);
    expect(await rows(attempt.id)).toHaveLength(1);
  });

  it("missing SESSION_SECRET returns CONFIG_ERROR", async () => {
    const attempt = await newAttempt();
    const cookie = cookieFor(attempt.id);
    const saved = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      const response = await put({ questionId: q(1).id, alternativeId: q(1).alternatives[0].id }, cookie);
      expect(response.status).toBe(500);
      expect((await response.json()).error.code).toBe("CONFIG_ERROR");
    } finally {
      process.env.SESSION_SECRET = saved;
    }
    expect(await rows(attempt.id)).toHaveLength(0);
  });
});
