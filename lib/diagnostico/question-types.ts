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
    alternatives: { id: string; text: string }[];
  }[];
};

// What the admin editor works with: the complete mapping.
export type EditableQuestionSet = {
  versionId: string;
  version: number;
  status: "draft" | "published" | "archived";
  questions: {
    id: string;
    position: number;
    text: string;
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
    | "STYLE_IMBALANCE";
  message: string;
  questionPosition?: number;
};
