import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { Style } from "./constants";
import type { EditableQuestionSet, PublicQuestionSet, ScoredAnswer } from "./question-types";
import { shuffleWithSeed } from "./seeded-shuffle";

type Db = SupabaseClient<Database>;

export class QuestionBankError extends Error {
  code: "NO_PUBLISHED_VERSION" | "VERSION_NOT_FOUND";

  constructor(code: "NO_PUBLISHED_VERSION" | "VERSION_NOT_FOUND", message: string) {
    super(message);
    this.name = "QuestionBankError";
    this.code = code;
  }
}

function fail(context: string, message: string): never {
  throw new Error(`${context} failed: ${message}`);
}

async function loadVersionRow(db: Db, versionId?: string) {
  const query = db.from("questionnaire_versions").select("id, version, status");
  const { data, error } = versionId
    ? await query.eq("id", versionId).maybeSingle()
    : await query.eq("status", "published").maybeSingle();
  if (error) fail("loadVersionRow", error.message);
  if (!data) {
    throw versionId
      ? new QuestionBankError("VERSION_NOT_FOUND", "Questionnaire version not found.")
      : new QuestionBankError("NO_PUBLISHED_VERSION", "No published questionnaire version.");
  }
  return data;
}

/**
 * Question set shown to the customer, for the published version. It never includes the style or
 * the weight of an alternative (those columns are not even selected). The order of the four
 * alternatives is shuffled with a seed, so it is stable for the same seed (the attempt id).
 */
export async function getPublicQuestionSet(db: Db, seed: string): Promise<PublicQuestionSet> {
  const version = await loadVersionRow(db);

  const { data: questions, error: questionsError } = await db
    .from("questions")
    .select("id, position, text")
    .eq("version_id", version.id)
    .order("position");
  if (questionsError) fail("getPublicQuestionSet", questionsError.message);

  const ids = (questions ?? []).map((question) => question.id);
  const { data: alternatives, error: alternativesError } = await db
    .from("alternatives")
    .select("id, question_id, position, text")
    .in("question_id", ids)
    .order("position");
  if (alternativesError) fail("getPublicQuestionSet", alternativesError.message);

  return {
    versionId: version.id,
    version: version.version,
    questions: (questions ?? []).map((question) => ({
      id: question.id,
      position: question.position,
      text: question.text,
      alternatives: shuffleWithSeed(
        (alternatives ?? [])
          .filter((alternative) => alternative.question_id === question.id)
          .map((alternative) => ({ id: alternative.id, text: alternative.text })),
        `${seed}:${question.id}`,
      ),
    })),
  };
}

/**
 * The attempt's answers as scoring input. It reads the alternatives and questions stored with the
 * answers, so the result does not depend on which questionnaire version is published now.
 */
export async function getScoredAnswers(db: Db, attemptId: string): Promise<ScoredAnswer[]> {
  const { data: answers, error } = await db
    .from("answers")
    .select("question_id, alternative_id")
    .eq("attempt_id", attemptId);
  if (error) fail("getScoredAnswers", error.message);
  if (!answers || answers.length === 0) return [];

  const { data: alternatives, error: alternativesError } = await db
    .from("alternatives")
    .select("id, style, weight")
    .in("id", answers.map((answer) => answer.alternative_id));
  if (alternativesError) fail("getScoredAnswers", alternativesError.message);

  const { data: questions, error: questionsError } = await db
    .from("questions")
    .select("id, position")
    .in("id", answers.map((answer) => answer.question_id));
  if (questionsError) fail("getScoredAnswers", questionsError.message);

  const alternativeById = new Map((alternatives ?? []).map((a) => [a.id, a]));
  const positionById = new Map((questions ?? []).map((q) => [q.id, q.position]));

  return answers.map((answer) => {
    const alternative = alternativeById.get(answer.alternative_id);
    const position = positionById.get(answer.question_id);
    if (!alternative || position === undefined) {
      fail("getScoredAnswers", "an answer points to a missing alternative or question");
    }
    return {
      questionPosition: position,
      style: alternative.style as Style,
      weight: alternative.weight,
    };
  });
}

/** Complete question set with the style mapping and weights, for the admin editor (RF-12). */
export async function loadQuestionBank(db: Db, versionId?: string): Promise<EditableQuestionSet> {
  const version = await loadVersionRow(db, versionId);

  const { data: questions, error: questionsError } = await db
    .from("questions")
    .select("id, position, text")
    .eq("version_id", version.id)
    .order("position");
  if (questionsError) fail("loadQuestionBank", questionsError.message);

  const ids = (questions ?? []).map((question) => question.id);
  const { data: alternatives, error: alternativesError } = await db
    .from("alternatives")
    .select("id, question_id, position, text, style, weight")
    .in("question_id", ids)
    .order("position");
  if (alternativesError) fail("loadQuestionBank", alternativesError.message);

  return {
    versionId: version.id,
    version: version.version,
    status: version.status as EditableQuestionSet["status"],
    questions: (questions ?? []).map((question) => ({
      id: question.id,
      position: question.position,
      text: question.text,
      alternatives: (alternatives ?? [])
        .filter((alternative) => alternative.question_id === question.id)
        .map((alternative) => ({
          id: alternative.id,
          position: alternative.position,
          text: alternative.text,
          style: alternative.style as Style,
          weight: alternative.weight,
        })),
    })),
  };
}
