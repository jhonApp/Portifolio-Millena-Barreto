import { describe, expect, it } from "vitest";
import { ANSWER_MESSAGES, answerBodySchema } from "@/lib/diagnostico/schemas/answer";
import { parseInput } from "@/lib/diagnostico/validation";

const Q = "0b9e5f0e-3a8e-4f3b-9d5a-6c1c3f2a8b10";
const A = "7c1a4d62-91a0-4f6e-8a47-2b5d9c3e7f11";

describe("answer body schema", () => {
  it("accepts two uuids", () => {
    expect(parseInput(answerBodySchema, { questionId: Q, alternativeId: A })).toEqual({
      ok: true,
      data: { questionId: Q, alternativeId: A },
    });
  });

  it("rejects non-uuid values", () => {
    const result = parseInput(answerBodySchema, { questionId: "1", alternativeId: "abc" }) as {
      ok: boolean;
      fields: Record<string, string[]>;
    };
    expect(result.ok).toBe(false);
    expect(result.fields.questionId).toEqual([ANSWER_MESSAGES.questionId]);
    expect(result.fields.alternativeId).toEqual([ANSWER_MESSAGES.alternativeId]);
  });

  it("rejects missing fields", () => {
    const result = parseInput(answerBodySchema, {}) as { ok: boolean; fields: Record<string, string[]> };
    expect(result.ok).toBe(false);
    expect(Object.keys(result.fields).sort()).toEqual(["alternativeId", "questionId"]);
  });

  it("rejects extra types such as numbers", () => {
    expect(parseInput(answerBodySchema, { questionId: 1, alternativeId: 2 }).ok).toBe(false);
  });
});
