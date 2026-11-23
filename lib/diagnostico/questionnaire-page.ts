import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAttemptVersionId, getSavedChoices } from "./answers";
import type { Database } from "./database.types";
import { QuestionBankError, getPublicQuestionSet } from "./question-bank";
import type { PublicQuestionSet } from "./question-types";
import { firstUnansweredIndex, type SavedChoice } from "./questionnaire-state";

export type QuestionnaireInitialState = {
  questionSet: PublicQuestionSet;
  /** question id -> first alternative id, already saved on the server */
  answers: Record<string, string>;
  /** question id -> first and optional second alternative id, already saved on the server */
  choices: Record<string, SavedChoice>;
  /** 0-based index of the question to show first */
  startIndex: number;
};

/**
 * Everything the questionnaire page needs. The attempt keeps the questionnaire version of its first
 * saved answer; an attempt without answers gets the published version. Nothing here carries the
 * style or the weight of an alternative.
 */
export async function loadQuestionnaire(
  db: SupabaseClient<Database>,
  attemptId: string,
): Promise<QuestionnaireInitialState> {
  const pinnedVersion = await getAttemptVersionId(db, attemptId);
  const questionSet = await getPublicQuestionSet(db, attemptId, pinnedVersion ?? undefined);
  const choices = await getSavedChoices(db, attemptId);
  const answers = Object.fromEntries(Object.entries(choices).map(([questionId, choice]) => [questionId, choice.first]));
  return { questionSet, answers, choices, startIndex: firstUnansweredIndex(questionSet.questions, choices) };
}

export type QuestionnairePage =
  | { status: "ready"; initial: QuestionnaireInitialState }
  // No version is published and the attempt has no answers: show the maintenance message.
  | { status: "unavailable" }
  // The attempt points to a version that no longer exists (versions are never deleted).
  | { status: "expired" };

/**
 * `loadQuestionnaire` for the page: the two conditions that make the questionnaire impossible to
 * show are returned as states instead of thrown, so the page can answer them without an error.
 */
export async function loadQuestionnairePage(
  db: SupabaseClient<Database>,
  attemptId: string,
): Promise<QuestionnairePage> {
  try {
    return { status: "ready", initial: await loadQuestionnaire(db, attemptId) };
  } catch (error) {
    if (error instanceof QuestionBankError) {
      if (error.code === "NO_PUBLISHED_VERSION") return { status: "unavailable" };
      if (error.code === "VERSION_NOT_FOUND") return { status: "expired" };
    }
    throw error;
  }
}
