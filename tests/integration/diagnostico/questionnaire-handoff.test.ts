import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { POST as register } from "@/app/api/diagnostico/attempts/route";
import { PUT as saveAnswerRoute } from "@/app/api/diagnostico/answers/route";
import { STYLES } from "@/lib/diagnostico/constants";
import { loadQuestionBank } from "@/lib/diagnostico/question-bank";
import { loadQuestionnaire } from "@/lib/diagnostico/questionnaire-page";
import { adminClient } from "./helpers";

// Hand-off tests of RF-04 as the consumer of RF-02 (attempt) and RF-03 (public question set).
// The real registration route of RF-02 is driven into the real save route of RF-04.

const db = adminClient();
const emails: string[] = [];

function randomIp(): string {
  const n = () => Math.floor(Math.random() * 250) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

async function registerCustomer() {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const response = await register(
    new Request("http://localhost/api/diagnostico/attempts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": randomIp() },
      body: JSON.stringify({
        fullName: "Maria Souza",
        email,
        whatsapp: "(11) 91234-5678",
        deliveryPreference: "both",
        consent: true,
        idempotencyKey: randomUUID(),
      }),
    }),
  );
  expect(response.status).toBe(201);
  const { attemptId } = await response.json();
  // The cookie exactly as the browser would send it back.
  const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0];
  return { attemptId: attemptId as string, cookie };
}

function saveWith(cookie: string, questionId: string, alternativeId: string) {
  return saveAnswerRoute(
    new Request("http://localhost/api/diagnostico/answers", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ questionId, alternativeId }),
    }),
  );
}

afterAll(async () => {
  if (emails.length) await db.from("customers").delete().in("email", emails);
  await db.from("rate_limits").delete().like("key", "attempt:%");
});

describe("RF-02 to RF-04 hand-off", () => {
  it("answers saved with the cookie of a real registration belong only to that attempt", async () => {
    const bank = await loadQuestionBank(db);
    const first = await registerCustomer();
    const second = await registerCustomer();
    expect(first.attemptId).not.toBe(second.attemptId);

    const question = bank.questions[0];
    const response = await saveWith(first.cookie, question.id, question.alternatives[0].id);
    expect(response.status).toBe(200);

    const { data: firstRows } = await db.from("answers").select("*").eq("attempt_id", first.attemptId);
    expect(firstRows).toHaveLength(1);
    expect(firstRows![0].attempt_id).toBe(first.attemptId);
    expect(firstRows![0].question_id).toBe(question.id);

    const { data: secondRows } = await db.from("answers").select("*").eq("attempt_id", second.attemptId);
    expect(secondRows).toHaveLength(0);
  });
});

describe("RF-03 to RF-04 hand-off", () => {
  it("the page state carries the public question set without style or weight", async () => {
    const { attemptId } = await registerCustomer();
    const state = await loadQuestionnaire(db, attemptId);
    expect(state.questionSet.questions).toHaveLength(15);

    const json = JSON.stringify(state);
    expect(json).not.toMatch(/"style"/);
    expect(json).not.toMatch(/"weight"/);
    // A leak would be a key or a value that is exactly a style key. Plain words inside the
    // alternative texts (for example "tradicional") are content, not a leak.
    for (const style of STYLES) expect(json, `style key ${style}`).not.toContain(`"${style}"`);
    for (const question of state.questionSet.questions) {
      for (const alternative of question.alternatives) {
        expect(Object.keys(alternative).sort()).toEqual(["id", "text"]);
      }
    }
  });

  it("loadQuestionnaire starts at the first unanswered question and returns the saved answers", async () => {
    const bank = await loadQuestionBank(db);
    const { attemptId, cookie } = await registerCustomer();

    const fresh = await loadQuestionnaire(db, attemptId);
    expect(fresh.startIndex).toBe(0);
    expect(fresh.answers).toEqual({});

    for (const question of bank.questions.slice(0, 7)) {
      expect((await saveWith(cookie, question.id, question.alternatives[0].id)).status).toBe(200);
    }
    const resumed = await loadQuestionnaire(db, attemptId);
    expect(resumed.startIndex).toBe(7); // question 8
    expect(Object.keys(resumed.answers)).toHaveLength(7);
    expect(resumed.answers[bank.questions[0].id]).toBe(bank.questions[0].alternatives[0].id);

    // The alternatives keep the per-attempt order after a reload.
    const again = await loadQuestionnaire(db, attemptId);
    expect(again.questionSet).toEqual(resumed.questionSet);
  });
});
