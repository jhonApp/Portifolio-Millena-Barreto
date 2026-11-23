import { STYLES, type Style } from "./constants";
import type { EditableQuestionSet, QuestionSetIssue } from "./question-types";

// Pure rules for a question set. Reused by the admin editor (RF-12) at publish time.

export const REQUIRED_QUESTIONS = 15;
export const REQUIRED_ALTERNATIVES = 4;
// Largest accepted difference between the most and the least frequent style (inferred, spec Section 1).
export const MAX_IMBALANCE = 2;

// Version 2 profile (a set with any duel): 12 regular questions, 3 look duels, 3 chapters.
export const DUEL_ALTERNATIVES = 2;
export const REQUIRED_DUELS = 3;
export const DUEL_POSITIONS = [5, 10, 15];
export const CHAPTERS = [1, 2, 3];
export const STEPS_PER_CHAPTER = 5;
export const STYLE_STEPS_V2 = 9;

/** The version 2 profile applies to any set that has a duel; every other set uses version 1. */
export function usesVersion2Profile(set: EditableQuestionSet): boolean {
  return set.questions.some((question) => question.kind === "duel");
}

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

    const expectedAlternatives = question.kind === "duel" ? DUEL_ALTERNATIVES : REQUIRED_ALTERNATIVES;
    if (question.alternatives.length !== expectedAlternatives) {
      issues.push({
        code: "ALTERNATIVE_COUNT",
        message: `Pergunta ${position} precisa ter ${expectedAlternatives} alternativas (tem ${question.alternatives.length}).`,
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
  if (usesVersion2Profile(set)) {
    issues.push(...validateVersion2Structure(set, counts));
  } else {
    const values = STYLES.map((style) => counts[style]);
    if (Math.max(...values) - Math.min(...values) > MAX_IMBALANCE) {
      issues.push({
        code: "STYLE_IMBALANCE",
        message: `Os estilos aparecem de forma desigual (${STYLES.map((style) => `${style}: ${counts[style]}`).join(", ")}).`,
      });
    }
  }

  return issues;
}

function validateVersion2Structure(set: EditableQuestionSet, counts: Record<Style, number>): QuestionSetIssue[] {
  const issues: QuestionSetIssue[] = [];
  const duels = set.questions.filter((question) => question.kind === "duel");

  if (duels.length !== REQUIRED_DUELS) {
    issues.push({
      code: "KIND_COUNT",
      message: `A versão 2 precisa de ${REQUIRED_DUELS} duelos de looks (tem ${duels.length}).`,
    });
  }

  for (const duel of duels) {
    if (!DUEL_POSITIONS.includes(duel.position)) {
      issues.push({
        code: "DUEL_POSITION",
        message: `A etapa ${duel.position} é um duelo, mas os duelos ficam nas etapas ${DUEL_POSITIONS.join(", ")}.`,
        questionPosition: duel.position,
      });
    }
  }

  for (const chapter of CHAPTERS) {
    const steps = set.questions.filter((question) => question.chapter === chapter).length;
    if (steps !== STEPS_PER_CHAPTER) {
      issues.push({
        code: "CHAPTER_SIZE",
        message: `O capítulo ${chapter} precisa ter ${STEPS_PER_CHAPTER} etapas (tem ${steps}).`,
      });
    }
  }

  for (const style of STYLES) {
    const inDuels = duels.filter((duel) => duel.alternatives.some((alternative) => alternative.style === style)).length;
    if (inDuels !== 1) {
      issues.push({
        code: "DUEL_STYLES",
        message: `O estilo ${style} aparece em ${inDuels} duelos (esperado 1).`,
      });
    }
  }

  for (const style of STYLES) {
    if (counts[style] !== STYLE_STEPS_V2) {
      issues.push({
        code: "STYLE_BALANCE",
        message: `O estilo ${style} aparece em ${counts[style]} etapas (esperado ${STYLE_STEPS_V2}).`,
      });
    }
  }

  return issues;
}
