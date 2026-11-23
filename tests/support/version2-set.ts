import { STYLES, type Style } from "@/lib/diagnostico/constants";
import type { EditableQuestionSet } from "@/lib/diagnostico/question-types";

// A valid version 2 structure built in code, shared by the unit and the integration tests.
// 12 regular questions of 4 styles and 3 duels of 2 styles; each style in exactly 9 of the 15 steps.

export type StepSpec = {
  position: number;
  kind: "choice" | "duel";
  chapter: number;
  /** One style per alternative, in alternative order. */
  styles: Style[];
};

export const DUEL_STYLES: Style[][] = [
  ["esportivo_natural", "elegante"],
  ["tradicional", "criativo"],
  ["romantico", "dramatico"],
];

/**
 * The 12 regular questions omit the 12 style pairs that are not (0,1), (2,3) or (4,5) of STYLES:
 * every style is omitted 4 times, so it appears in 8 regular questions and, with its one duel, in 9.
 */
function regularStyleSets(): Style[][] {
  const matching = new Set(["0,1", "2,3", "4,5"]);
  const sets: Style[][] = [];
  for (let a = 0; a < STYLES.length; a++) {
    for (let b = a + 1; b < STYLES.length; b++) {
      if (matching.has(`${a},${b}`)) continue;
      sets.push(STYLES.filter((_, index) => index !== a && index !== b));
    }
  }
  return sets;
}

export function version2Steps(): StepSpec[] {
  const regular = regularStyleSets();
  const steps: StepSpec[] = [];
  let regularIndex = 0;
  let duelIndex = 0;
  for (let position = 1; position <= 15; position++) {
    const chapter = Math.ceil(position / 5);
    if (position % 5 === 0) {
      steps.push({ position, kind: "duel", chapter, styles: [...DUEL_STYLES[duelIndex++]] });
    } else {
      steps.push({ position, kind: "choice", chapter, styles: [...regular[regularIndex++]] });
    }
  }
  return steps;
}

export function toEditableSet(steps: StepSpec[]): EditableQuestionSet {
  return {
    versionId: "v",
    version: 2,
    status: "draft",
    questions: steps.map((step) => ({
      id: `q${step.position}`,
      position: step.position,
      text: `Pergunta ${step.position}`,
      kind: step.kind,
      chapter: step.chapter,
      maxChoices: step.kind === "duel" ? 1 : 2,
      alternatives: step.styles.map((style, index) => ({
        id: `q${step.position}a${index + 1}`,
        position: index + 1,
        text: `Alternativa ${index + 1}`,
        style,
        weight: 1,
      })),
    })),
  };
}
