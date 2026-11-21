import { describe, expect, it } from "vitest";
import { STYLES, type Style } from "@/lib/diagnostico/constants";
import type { EditableQuestionSet } from "@/lib/diagnostico/question-types";
import { styleAppearances, validateQuestionSet } from "@/lib/diagnostico/question-set-rules";

// Version-1 shape: every question omits a different pair of styles (15 pairs for 15 questions).
function balancedSet(): EditableQuestionSet {
  const pairs: [Style, Style][] = [];
  for (let i = 0; i < STYLES.length; i++)
    for (let j = i + 1; j < STYLES.length; j++) pairs.push([STYLES[i], STYLES[j]]);

  return {
    versionId: "v",
    version: 1,
    status: "draft",
    questions: pairs.map(([a, b], index) => ({
      id: `q${index + 1}`,
      position: index + 1,
      text: `Pergunta ${index + 1}`,
      alternatives: STYLES.filter((s) => s !== a && s !== b).map((style, k) => ({
        id: `q${index + 1}a${k + 1}`,
        position: k + 1,
        text: `Alternativa ${style}`,
        style,
        weight: 1,
      })),
    })),
  };
}

describe("validateQuestionSet", () => {
  it("accepts a balanced set of 15 questions", () => {
    const set = balancedSet();
    expect(validateQuestionSet(set)).toEqual([]);
    expect(styleAppearances(set)).toEqual({
      esportivo_natural: 10,
      tradicional: 10,
      elegante: 10,
      romantico: 10,
      criativo: 10,
      dramatico: 10,
    });
  });

  it("rejects a repeated style in a question", () => {
    const set = balancedSet();
    set.questions[6].alternatives[1].style = set.questions[6].alternatives[0].style;
    const issues = validateQuestionSet(set);
    const repeated = issues.find((issue) => issue.code === "REPEATED_STYLE");
    expect(repeated?.questionPosition).toBe(7);
    expect(repeated?.message).toContain("Pergunta 7");
  });

  it("rejects an imbalance greater than 2", () => {
    const set = balancedSet();
    // Make 'criativo' appear in every question where it is missing: 15 vs the others lower.
    for (const question of set.questions) {
      if (!question.alternatives.some((a) => a.style === "criativo")) {
        question.alternatives[0].style = "criativo";
      }
    }
    const issues = validateQuestionSet(set);
    expect(issues.some((issue) => issue.code === "STYLE_IMBALANCE")).toBe(true);
  });

  it("accepts an imbalance of exactly 2", () => {
    const set = balancedSet();
    // Swap one criativo alternative for a style that is missing in that question: criativo 9, other 11.
    const question = set.questions.find(
      (q) =>
        q.alternatives.some((a) => a.style === "criativo") &&
        STYLES.some((style) => !q.alternatives.some((a) => a.style === style)),
    )!;
    const missing = STYLES.find((style) => !question.alternatives.some((a) => a.style === style))!;
    question.alternatives.find((a) => a.style === "criativo")!.style = missing;
    const counts = styleAppearances(set);
    expect(Math.max(...Object.values(counts)) - Math.min(...Object.values(counts))).toBe(2);
    expect(validateQuestionSet(set).some((issue) => issue.code === "STYLE_IMBALANCE")).toBe(false);
  });

  it("rejects fewer than 15 questions", () => {
    const set = balancedSet();
    set.questions.pop();
    expect(validateQuestionSet(set).some((issue) => issue.code === "QUESTION_COUNT")).toBe(true);
  });

  it("rejects a question without 4 alternatives", () => {
    const set = balancedSet();
    set.questions[2].alternatives.pop();
    const issue = validateQuestionSet(set).find((i) => i.code === "ALTERNATIVE_COUNT");
    expect(issue?.questionPosition).toBe(3);
  });

  it("rejects an unknown style and a weight outside 1 to 3", () => {
    const set = balancedSet();
    set.questions[0].alternatives[0].style = "sexy" as Style;
    set.questions[1].alternatives[0].weight = 4;
    const codes = validateQuestionSet(set).map((issue) => issue.code);
    expect(codes).toContain("UNKNOWN_STYLE");
    expect(codes).toContain("INVALID_WEIGHT");
  });
});
