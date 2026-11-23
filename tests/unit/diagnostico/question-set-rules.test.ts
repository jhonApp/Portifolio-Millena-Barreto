import { describe, expect, it } from "vitest";
import { STYLES, type Style } from "@/lib/diagnostico/constants";
import type { EditableQuestionSet } from "@/lib/diagnostico/question-types";
import { styleAppearances, validateQuestionSet } from "@/lib/diagnostico/question-set-rules";
import { toEditableSet, version2Steps } from "../../support/version2-set";

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

describe("validateQuestionSet with the version 2 profile", () => {
  const codes = (set: EditableQuestionSet) => validateQuestionSet(set).map((issue) => issue.code);

  it("the version 2 profile accepts the seeded structure", () => {
    const set = toEditableSet(version2Steps());
    expect(validateQuestionSet(set)).toEqual([]);
    for (const style of STYLES) expect(styleAppearances(set)[style]).toBe(9);
  });

  it("the profile is chosen from the set: a set with a duel uses version 2, any other uses version 1", () => {
    // Without kinds, a 15 x 4 balanced set is validated as version 1 (see the cases above).
    expect(validateQuestionSet(balancedSet())).toEqual([]);
    // The version 2 structure is not a valid version 1 set (its steps are not all 4 alternatives).
    const asV1 = toEditableSet(version2Steps());
    for (const question of asV1.questions) delete question.kind;
    expect(codes(asV1)).toContain("ALTERNATIVE_COUNT");
  });

  it("version 2 profile rejects a style that appears in 8 steps and names it", () => {
    const steps = version2Steps();
    // In step 1 replace one style by a style that step does not have: the first goes to 8, the other to 10.
    const step = steps[0];
    const removed = step.styles[0];
    const added = STYLES.find((style) => !step.styles.includes(style))!;
    step.styles[0] = added;
    const issues = validateQuestionSet(toEditableSet(steps)).filter((issue) => issue.code === "STYLE_BALANCE");
    expect(issues).toHaveLength(2);
    expect(issues.find((issue) => issue.message.includes(removed))?.message).toContain("8");
    expect(issues.find((issue) => issue.message.includes(added))?.message).toContain("10");
  });

  it("rejects a duel outside steps 5, 10 and 15", () => {
    const steps = version2Steps();
    steps[4].kind = "choice";
    steps[4].styles = [...STYLES.slice(0, 4)];
    steps[3].kind = "duel";
    steps[3].styles = [...STYLES.slice(0, 2)];
    const issue = validateQuestionSet(toEditableSet(steps)).find((candidate) => candidate.code === "DUEL_POSITION");
    expect(issue?.questionPosition).toBe(4);
  });

  it("rejects a version with two duels or four duels", () => {
    const fewer = version2Steps();
    fewer[14].kind = "choice";
    fewer[14].styles = [...STYLES.slice(0, 4)];
    expect(codes(toEditableSet(fewer))).toContain("KIND_COUNT");
    const more = version2Steps();
    more[0].kind = "duel";
    more[0].styles = [...STYLES.slice(0, 2)];
    expect(codes(toEditableSet(more))).toContain("KIND_COUNT");
  });

  it("rejects a chapter that does not have 5 steps", () => {
    const steps = version2Steps();
    steps[0].chapter = 2;
    const issues = validateQuestionSet(toEditableSet(steps)).filter((issue) => issue.code === "CHAPTER_SIZE");
    expect(issues.map((issue) => issue.message).join(" ")).toMatch(/capítulo 1 precisa ter 5 etapas \(tem 4\)/);
    expect(issues).toHaveLength(2);
  });

  it("rejects a style that is in two duels or in none", () => {
    const steps = version2Steps();
    steps[9].styles = ["esportivo_natural", "criativo"]; // esportivo_natural twice, tradicional never
    const issues = validateQuestionSet(toEditableSet(steps)).filter((issue) => issue.code === "DUEL_STYLES");
    expect(issues.map((issue) => issue.message).join(" ")).toContain("esportivo_natural");
    expect(issues.map((issue) => issue.message).join(" ")).toContain("tradicional");
  });

  it("rejects a duel with four alternatives and a regular question with two", () => {
    const set = toEditableSet(version2Steps());
    set.questions[4].alternatives.push(
      { id: "x1", position: 3, text: "x", style: "criativo", weight: 1 },
      { id: "x2", position: 4, text: "x", style: "romantico", weight: 1 },
    );
    set.questions[0].alternatives.pop();
    set.questions[0].alternatives.pop();
    const positions = validateQuestionSet(set)
      .filter((issue) => issue.code === "ALTERNATIVE_COUNT")
      .map((issue) => issue.questionPosition);
    expect(positions).toEqual([1, 5]);
  });

  it("rejects a weight outside 1 to 3 in a duel", () => {
    const set = toEditableSet(version2Steps());
    set.questions[4].alternatives[0].weight = 5;
    expect(codes(set)).toContain("INVALID_WEIGHT");
  });
});
