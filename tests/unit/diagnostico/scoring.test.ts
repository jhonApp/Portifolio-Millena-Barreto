import { describe, expect, it } from "vitest";
import { STYLES, type Style } from "@/lib/diagnostico/constants";
import type { ScoredAnswer } from "@/lib/diagnostico/question-types";
import { FIXED_ORDER, ScoringError, scoreAnswers } from "@/lib/diagnostico/scoring";

/** One answer per position 1..15, with the style given for each position. */
function answersFor(styles: Style[], weight = 1): ScoredAnswer[] {
  return styles.map((style, index) => ({ questionPosition: index + 1, style, weight }));
}

const rep = (style: Style, times: number): Style[] => Array.from({ length: times }, () => style);

describe("scoreAnswers", () => {
  it("elegante with 6 points and tradicional with 4 gives that order", () => {
    const styles = [
      ...rep("elegante", 6),
      ...rep("tradicional", 4),
      ...rep("romantico", 2),
      "esportivo_natural",
      "criativo",
      "dramatico",
    ] as Style[];
    const result = scoreAnswers(answersFor(styles));
    expect(result.points).toEqual({
      esportivo_natural: 1,
      tradicional: 4,
      elegante: 6,
      romantico: 2,
      criativo: 1,
      dramatico: 1,
    });
    expect(result.predominant).toBe("elegante");
    expect(result.secondary).toBe("tradicional");
    expect(result.tieBreaks).toEqual({ predominant: "none", secondary: "none" });
  });

  it("tie is broken by more answers in questions 11 to 15", () => {
    // E and T tie at 5 points; T has all of its answers in 11-15, E has none.
    const tradicionalLate = [
      ...rep("esportivo_natural", 5), // positions 1-5
      "romantico", "romantico", "criativo", "dramatico", "elegante", // positions 6-10
      ...rep("tradicional", 5), // positions 11-15
    ] as Style[];
    const result = scoreAnswers(answersFor(tradicionalLate));
    expect(result.points.esportivo_natural).toBe(5);
    expect(result.points.tradicional).toBe(5);
    expect(result.predominant).toBe("tradicional");
    expect(result.secondary).toBe("esportivo_natural");
    expect(result.tieBreaks.predominant).toBe("late_answers");

    // Mirror: E has the late answers, so E wins.
    const esportivoLate = [
      ...rep("tradicional", 5),
      "romantico", "romantico", "criativo", "dramatico", "elegante",
      ...rep("esportivo_natural", 5),
    ] as Style[];
    expect(scoreAnswers(answersFor(esportivoLate)).predominant).toBe("esportivo_natural");
  });

  it("tie-break applies to the secondary pick too", () => {
    // Elegante clear at 7; tradicional and romantico tie at 3; romantico has more late answers.
    const styles = [
      ...rep("elegante", 7), // 1-7
      ...rep("tradicional", 3), // 8-10
      ...rep("romantico", 3), // 11-13
      "criativo", // 14
      "dramatico", // 15
    ] as Style[];
    const result = scoreAnswers(answersFor(styles));
    expect(result.predominant).toBe("elegante");
    expect(result.secondary).toBe("romantico");
    expect(result.tieBreaks).toEqual({ predominant: "none", secondary: "late_answers" });
  });

  it("tie still equal falls to the fixed order", () => {
    // Five styles with 3 points each and exactly one answer in 11-15 each: only the fixed order decides.
    const styles: Style[] = [
      // positions 1-10: two answers per style
      "esportivo_natural", "tradicional", "elegante", "romantico", "criativo",
      "esportivo_natural", "tradicional", "elegante", "romantico", "criativo",
      // positions 11-15: one answer per style
      "esportivo_natural", "tradicional", "elegante", "romantico", "criativo",
    ];
    const result = scoreAnswers(answersFor(styles));
    expect(result.predominant).toBe("elegante");
    expect(result.secondary).toBe("tradicional");
    expect(result.tieBreaks).toEqual({ predominant: "fixed_order", secondary: "fixed_order" });
  });

  it("fixed order is elegante tradicional romantico esportivo criativo dramatico", () => {
    expect([...FIXED_ORDER]).toEqual([
      "elegante",
      "tradicional",
      "romantico",
      "esportivo_natural",
      "criativo",
      "dramatico",
    ]);
    expect([...FIXED_ORDER].sort()).toEqual([...STYLES].sort());
  });

  it("same answers scored 100 times give identical results", () => {
    const styles = [
      ...rep("elegante", 5), ...rep("tradicional", 4), ...rep("romantico", 3),
      "criativo", "criativo", "dramatico",
    ] as Style[];
    const answers = answersFor(styles);
    const first = scoreAnswers(answers);
    for (let i = 0; i < 100; i++) expect(scoreAnswers(answers)).toEqual(first);
  });

  it("answer order does not change the result", () => {
    const styles = [
      ...rep("elegante", 5), ...rep("tradicional", 5), ...rep("romantico", 2),
      "criativo", "criativo", "dramatico",
    ] as Style[];
    const answers = answersFor(styles);
    const reversed = [...answers].reverse();
    expect(scoreAnswers(reversed)).toEqual(scoreAnswers(answers));
  });

  it("weights above 1 add up", () => {
    const answers = answersFor([...rep("tradicional", 14), "criativo"] as Style[]);
    answers[14] = { questionPosition: 15, style: "criativo", weight: 3 };
    const result = scoreAnswers(answers);
    expect(result.points.criativo).toBe(3);
    expect(result.points.tradicional).toBe(14);
  });

  it("all answers of one style still returns a different secondary", () => {
    const result = scoreAnswers(answersFor(rep("dramatico", 15)));
    expect(result.predominant).toBe("dramatico");
    expect(result.secondary).not.toBe("dramatico");
    expect(result.secondary).toBe("elegante"); // all others at 0: the fixed order decides
    expect(result.tieBreaks.secondary).toBe("fixed_order");
  });

  it("perfectly balanced answers are resolved by the tie-break, never at random", () => {
    const styles: Style[] = [
      "esportivo_natural", "tradicional", "elegante", "romantico", "criativo", "dramatico",
      "esportivo_natural", "tradicional", "elegante", "romantico", "criativo", "dramatico",
      "esportivo_natural", "tradicional", "elegante",
    ];
    const result = scoreAnswers(answersFor(styles));
    expect(result.predominant).toBe(scoreAnswers(answersFor(styles)).predominant);
    expect(result.predominant).not.toBe(result.secondary);
  });

  it("rejects fewer than 15 answers", () => {
    const fn = () => scoreAnswers(answersFor(rep("elegante", 14)));
    expect(fn).toThrow(ScoringError);
    try {
      fn();
    } catch (error) {
      expect((error as ScoringError).code).toBe("INVALID_ANSWERS");
    }
    expect(() => scoreAnswers([])).toThrow(ScoringError);
  });

  it("rejects a repeated question position", () => {
    const answers = answersFor(rep("elegante", 15));
    answers[14] = { ...answers[14], questionPosition: 1 };
    expect(() => scoreAnswers(answers)).toThrow(ScoringError);
  });

  it("rejects an unknown style or weight outside 1 to 3", () => {
    const unknown = answersFor(rep("elegante", 15));
    unknown[0] = { questionPosition: 1, style: "sexy" as Style, weight: 1 };
    expect(() => scoreAnswers(unknown)).toThrow(ScoringError);

    for (const weight of [0, 4, 1.5]) {
      const bad = answersFor(rep("elegante", 15));
      bad[0] = { ...bad[0], weight };
      expect(() => scoreAnswers(bad), `weight ${weight}`).toThrow(ScoringError);
    }
  });
});
