import { STYLES, type Style } from "./constants";
import type { EditableQuestionSet, QuestionSetIssue } from "./question-types";

// Pure rules for a question set. Reused by the admin editor (RF-12) at publish time.

export const REQUIRED_QUESTIONS = 15;
export const REQUIRED_ALTERNATIVES = 4;
// Largest accepted difference between the most and the least frequent style (inferred, spec Section 1).
export const MAX_IMBALANCE = 2;

/** Number of questions in which each style appears (a style counts once per question). */
export function styleAppearances(set: EditableQuestionSet): Record<Style, number> {
  const counts = Object.fromEntries(STYLES.map((style) => [style, 0])) as Record<Style, number>;
  for (const question of set.questions) {
    const seen = new Set<Style>();
    for (const alternative of question.alternatives) {
      if (STYLES.includes(alternative.style)) seen.add(alternative.style);
    }
    seen.forEach((style) => {
      counts[style] += 1;
    });
  }
  return counts;
}

export function validateQuestionSet(set: EditableQuestionSet): QuestionSetIssue[] {
  const issues: QuestionSetIssue[] = [];

  if (set.questions.length !== REQUIRED_QUESTIONS) {
    issues.push({
      code: "QUESTION_COUNT",
      message: `O questionário precisa ter ${REQUIRED_QUESTIONS} perguntas (tem ${set.questions.length}).`,
    });
  }

  for (const question of set.questions) {
    const position = question.position;

    if (question.alternatives.length !== REQUIRED_ALTERNATIVES) {
      issues.push({
        code: "ALTERNATIVE_COUNT",
        message: `Pergunta ${position} precisa ter ${REQUIRED_ALTERNATIVES} alternativas (tem ${question.alternatives.length}).`,
        questionPosition: position,
      });
    }

    const seen = new Set<Style>();
    for (const alternative of question.alternatives) {
      if (!STYLES.includes(alternative.style)) {
        issues.push({
          code: "UNKNOWN_STYLE",
          message: `Pergunta ${position} tem uma alternativa com estilo desconhecido.`,
          questionPosition: position,
        });
        continue;
      }
      if (seen.has(alternative.style)) {
        issues.push({
          code: "REPEATED_STYLE",
          message: `Pergunta ${position} tem duas alternativas do estilo ${alternative.style}.`,
          questionPosition: position,
        });
      }
      seen.add(alternative.style);

      if (!Number.isInteger(alternative.weight) || alternative.weight < 1 || alternative.weight > 3) {
        issues.push({
          code: "INVALID_WEIGHT",
          message: `Pergunta ${position} tem uma alternativa com peso fora de 1 a 3.`,
          questionPosition: position,
        });
      }
    }
  }

  const counts = styleAppearances(set);
  const values = STYLES.map((style) => counts[style]);
  if (Math.max(...values) - Math.min(...values) > MAX_IMBALANCE) {
    issues.push({
      code: "STYLE_IMBALANCE",
      message: `Os estilos aparecem de forma desigual (${STYLES.map((style) => `${style}: ${counts[style]}`).join(", ")}).`,
    });
  }

  return issues;
}
