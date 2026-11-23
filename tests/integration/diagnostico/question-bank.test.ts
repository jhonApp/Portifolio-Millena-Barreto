import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { STYLES, type Style } from "@/lib/diagnostico/constants";
import {
  QuestionBankError,
  getPublicQuestionSet,
  getScoredAnswers,
  loadQuestionBank,
} from "@/lib/diagnostico/question-bank";
import { styleAppearances, validateQuestionSet } from "@/lib/diagnostico/question-set-rules";
import { scoreAnswers } from "@/lib/diagnostico/scoring";
import { adminClient, createAttempt, createCustomer, uniqueVersion } from "./helpers";

const db = adminClient();
const versionIds: string[] = [];
const customerIds: string[] = [];

/** Creates a complete throwaway version: 15 questions x 4 alternatives with the given styles. */
async function createFullVersion(
  styleFor: (questionPosition: number, alternativePosition: number) => Style,
  status: "draft" | "published" | "archived" = "archived",
) {
  const { data: version, error } = await db
    .from("questionnaire_versions")
    .insert({ version: uniqueVersion(), status })
    .select()
    .single();
  if (error) throw new Error(error.message);
  versionIds.push(version.id);

  const { data: questions, error: qError } = await db
    .from("questions")
    .insert(
      Array.from({ length: 15 }, (_, i) => ({
        version_id: version.id,
        position: i + 1,
        text: `Pergunta de teste ${i + 1}`,
      })),
    )
    .select();
  if (qError) throw new Error(qError.message);

  const rows = questions!.flatMap((question) =>
    [1, 2, 3, 4].map((position) => ({
      question_id: question.id,
      position,
      text: `Alternativa ${question.position}.${position}`,
      style: styleFor(question.position, position),
      weight: 1,
    })),
  );
  const { error: aError } = await db.from("alternatives").insert(rows);
  if (aError) throw new Error(aError.message);
  return { version, questions: questions! };
}

async function setStatus(id: string, status: "draft" | "published" | "archived") {
  const { error } = await db.from("questionnaire_versions").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

async function publishedVersionOne() {
  const { data, error } = await db
    .from("questionnaire_versions")
    .select("id")
    .eq("version", 1)
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

afterAll(async () => {
  if (customerIds.length) await db.from("customers").delete().in("id", customerIds);
  if (versionIds.length) await db.from("questionnaire_versions").delete().in("id", versionIds);
});

describe("seeded questionnaire version 1", () => {
  it("active set has 15 questions with 4 alternatives each", async () => {
    const bank = await loadQuestionBank(db);
    expect(bank.version).toBe(1);
    expect(bank.status).toBe("published");
    expect(bank.questions).toHaveLength(15);
    expect(bank.questions.map((q) => q.position)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    for (const question of bank.questions) expect(question.alternatives, `Q${question.position}`).toHaveLength(4);
  });

  it("each style appears in exactly 10 questions", async () => {
    const bank = await loadQuestionBank(db);
    expect(styleAppearances(bank)).toEqual({
      esportivo_natural: 10,
      tradicional: 10,
      elegante: 10,
      romantico: 10,
      criativo: 10,
      dramatico: 10,
    });
  });

  it("six styles in total and no sexy", async () => {
    const bank = await loadQuestionBank(db);
    const used = new Set(bank.questions.flatMap((q) => q.alternatives.map((a) => a.style)));
    const usedList = Array.from(used) as string[];
    expect(usedList).toHaveLength(6);
    expect(usedList.slice().sort()).toEqual([...STYLES].sort());
    expect(usedList.some((style) => style.includes("sexy"))).toBe(false);
  });

  it("version 1 passes validateQuestionSet", async () => {
    expect(validateQuestionSet(await loadQuestionBank(db))).toEqual([]);
  });

  it("all weights in version 1 are 1 and no question repeats a style", async () => {
    const bank = await loadQuestionBank(db);
    for (const question of bank.questions) {
      expect(new Set(question.alternatives.map((a) => a.style)).size).toBe(4);
      for (const alternative of question.alternatives) expect(alternative.weight).toBe(1);
    }
  });

  it("seeded original alternatives match questionnaire-source.md", async () => {
    const source = readFileSync(
      path.join(process.cwd(), "docs/RF-03-question-bank-and-scoring-engine/questionnaire-source.md"),
      "utf8",
    );
    const body = source.slice(
      source.indexOf("## Questions and alternatives"),
      source.indexOf("## Alternatives dropped from the original text"),
    );
    const letters: Record<string, Style> = {
      E: "esportivo_natural",
      T: "tradicional",
      L: "elegante",
      R: "romantico",
      C: "criativo",
      D: "dramatico",
    };
    const expected: { position: number; style: Style; text: string }[] = [];
    let position = 0;
    for (const line of body.split(/\r?\n/)) {
      const q = line.match(/^### (\d+)\. /);
      if (q) position = Number(q[1]);
      const a = line.match(/^- ([ETLRCD]): (.+?)(?: \[new\])?$/);
      if (a && position) expected.push({ position, style: letters[a[1]], text: a[2].trim() });
    }
    expect(expected).toHaveLength(60);

    const bank = await loadQuestionBank(db);
    for (const item of expected) {
      const question = bank.questions.find((q) => q.position === item.position)!;
      const found = question.alternatives.find((alt) => alt.style === item.style);
      expect(found?.text, `Q${item.position} ${item.style}`).toBe(item.text);
    }
  });
});

describe("public question set", () => {
  it("public question set contains no style or weight", async () => {
    const set = await getPublicQuestionSet(db, randomUUID());
    expect(set.questions).toHaveLength(15);
    for (const question of set.questions) {
      expect(Object.keys(question).sort()).toEqual(["alternatives", "chapter", "id", "kind", "maxChoices", "position", "text"]);
      expect(question.maxChoices).toBe(1); // version 1: one choice per question
      for (const alternative of question.alternatives) {
        expect(Object.keys(alternative).sort()).toEqual(["id", "text"]);
      }
    }
    const json = JSON.stringify(set);
    expect(json).not.toMatch(/"style"/);
    expect(json).not.toMatch(/"weight"/);
  });

  it("shuffle is stable per attempt and varies between attempts", async () => {
    const seed = randomUUID();
    const first = await getPublicQuestionSet(db, seed);
    const second = await getPublicQuestionSet(db, seed);
    expect(second).toEqual(first);

    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const other = await getPublicQuestionSet(db, randomUUID());
      orders.add(other.questions[0].alternatives.map((a) => a.id).join(","));
    }
    expect(orders.size).toBeGreaterThan(1);
    // Same four alternatives, only the order differs.
    const sorted = (set: typeof first) => set.questions[0].alternatives.map((a) => a.id).sort();
    expect(sorted(await getPublicQuestionSet(db, randomUUID()))).toEqual(sorted(first));
  });

  it("getPublicQuestionSet serves a given version even when it is archived", async () => {
    const versionOne = await publishedVersionOne();
    await setStatus(versionOne, "archived");
    try {
      const set = await getPublicQuestionSet(db, "seed", versionOne);
      expect(set.versionId).toBe(versionOne);
      expect(set.questions).toHaveLength(15);
    } finally {
      await setStatus(versionOne, "published");
    }
  });

  it("getPublicQuestionSet fails with VERSION_NOT_FOUND for an unknown version", async () => {
    await expect(getPublicQuestionSet(db, "seed", randomUUID())).rejects.toMatchObject({
      code: "VERSION_NOT_FOUND",
    });
  });

  it("getPublicQuestionSet fails with NO_PUBLISHED_VERSION when none is published", async () => {
    const versionOne = await publishedVersionOne();
    await setStatus(versionOne, "archived");
    try {
      await expect(getPublicQuestionSet(db, "seed")).rejects.toBeInstanceOf(QuestionBankError);
      await expect(getPublicQuestionSet(db, "seed")).rejects.toMatchObject({ code: "NO_PUBLISHED_VERSION" });
    } finally {
      await setStatus(versionOne, "published");
    }
  });
});

describe("scoring with stored answers", () => {
  it("past answers are scored with the version stored on them", async () => {
    // Version A: the first alternative of every question is elegante.
    const a = await createFullVersion((_, alt) => (["elegante", "tradicional", "romantico", "esportivo_natural"] as Style[])[alt - 1]);
    // Version B (same positions, different mapping): the first alternative is dramatico.
    const b = await createFullVersion((_, alt) => (["dramatico", "criativo", "esportivo_natural", "romantico"] as Style[])[alt - 1]);

    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    const attempt = await createAttempt(db, customer.id);

    // Answers on version A: always the first alternative.
    const { data: alternativesA } = await db
      .from("alternatives")
      .select("id, question_id, position")
      .in("question_id", a.questions.map((q) => q.id))
      .eq("position", 1);
    const { error } = await db.from("answers").insert(
      alternativesA!.map((alt) => ({
        attempt_id: attempt.id,
        version_id: a.version.id,
        question_id: alt.question_id,
        alternative_id: alt.id,
      })),
    );
    expect(error).toBeNull();

    const before = scoreAnswers(await getScoredAnswers(db, attempt.id));
    expect(before.predominant).toBe("elegante");

    // Publish version B as the new active version, then score the old answers again.
    const versionOne = await publishedVersionOne();
    await setStatus(versionOne, "archived");
    await setStatus(b.version.id, "published");
    try {
      const served = await getPublicQuestionSet(db, "any-seed");
      expect(served.versionId).toBe(b.version.id); // new attempts get the new version
      const after = scoreAnswers(await getScoredAnswers(db, attempt.id));
      expect(after).toEqual(before); // the old answers keep their own version
      expect(after.points.dramatico).toBe(0);
    } finally {
      await setStatus(b.version.id, "archived");
      await setStatus(versionOne, "published");
    }
  });

  it("getScoredAnswers returns an empty list for an attempt without answers", async () => {
    const customer = await createCustomer(db);
    customerIds.push(customer.id);
    const attempt = await createAttempt(db, customer.id);
    expect(await getScoredAnswers(db, attempt.id)).toEqual([]);
  });
});
