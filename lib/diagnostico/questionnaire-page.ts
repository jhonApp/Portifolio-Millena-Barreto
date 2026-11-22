import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAttemptVersionId, getSavedChoices } from "./answers";
import type { Database } from "./database.types";
import { getPublicQuestionSet } from "./question-bank";
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
