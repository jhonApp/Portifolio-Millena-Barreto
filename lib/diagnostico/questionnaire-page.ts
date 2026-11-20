import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAttemptVersionId, getSavedAnswers } from "./answers";
import type { Database } from "./database.types";
import { getPublicQuestionSet } from "./question-bank";
import type { PublicQuestionSet } from "./question-types";
import { firstUnansweredIndex } from "./questionnaire-state";

export type QuestionnaireInitialState = {
  questionSet: PublicQuestionSet;
  /** question id -> alternative id, already saved on the server */
  answers: Record<string, string>;
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
  const answers = await getSavedAnswers(db, attemptId);
  return { questionSet, answers, startIndex: firstUnansweredIndex(questionSet.questions, answers) };
}
