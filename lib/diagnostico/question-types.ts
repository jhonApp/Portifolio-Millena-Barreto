import type { Style } from "./constants";

// Input of the scoring engine: one entry per answered question.
export type ScoredAnswer = {
  questionPosition: number;
  style: Style;
  weight: number;
};

// What the customer receives: never includes the style or the weight of an alternative.
export type PublicQuestionSet = {
  versionId: string;
  version: number;
  questions: {
    id: string;
    position: number;
    text: string;
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
