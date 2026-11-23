import type { Style } from "./constants";

// Input of the scoring engine: one entry per chosen alternative. `rank` is 1 for the first choice
// (the default) and 2 for the optional second choice of a question.
export type ScoredAnswer = {
  questionPosition: number;
  style: Style;
  weight: number;
  rank?: 1 | 2;
};

// What the customer receives: never includes the style or the weight of an alternative.
export type PublicQuestionSet = {
  versionId: string;
  version: number;
  questions: {
    id: string;
    position: number;
    text: string;
    /** How many alternatives the customer may choose: 1, or 2 (a first and an optional second). */
    maxChoices: 1 | 2;
    /** A regular question or a look duel (RF-03). */
    kind: QuestionKind;
    /** Chapter 1 to 3 of the step, or null for a version without chapters (version 1). */
    chapter: 1 | 2 | 3 | null;
    alternatives: { id: string; text: string }[];
  }[];
};

export type QuestionKind = "choice" | "duel";

// What the admin editor works with: the complete mapping.
export type EditableQuestionSet = {
  versionId: string;
  version: number;
  status: "draft" | "published" | "archived";
  /** Scoring rules of the version (RF-01). Absent in sets built by hand. */
  rules?: { firstChoicePoints: number; secondChoicePoints: number; lateTiebreakBasis: "answers" | "points" };
  questions: {
    id: string;
    position: number;
    text: string;
    /** Absent means a regular question. A set with any duel is validated with the version 2 profile. */
    kind?: QuestionKind;
    chapter?: number | null;
    maxChoices?: 1 | 2;
    alternatives: {
      id: string;
      position: number;
      text: string;
      style: Style;
      weight: number;
    }[];
  }[];
};

export type QuestionSetIssue = {
  code:
    | "QUESTION_COUNT"
    | "ALTERNATIVE_COUNT"
    | "UNKNOWN_STYLE"
    | "REPEATED_STYLE"
    | "INVALID_WEIGHT"
    | "STYLE_IMBALANCE"
    // Version 2 profile
    | "KIND_COUNT"
    | "DUEL_POSITION"
    | "CHAPTER_SIZE"
    | "DUEL_STYLES"
    | "STYLE_BALANCE";
  message: string;
  questionPosition?: number;
};
