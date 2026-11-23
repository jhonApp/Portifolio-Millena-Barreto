import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { Style } from "./constants";
import { validateQuestionSet } from "./question-set-rules";
import type { EditableQuestionSet, PublicQuestionSet, QuestionKind, QuestionSetIssue, ScoredAnswer } from "./question-types";
import { DEFAULT_RULES, type ScoringRules } from "./scoring";
import { shuffleWithSeed } from "./seeded-shuffle";

type Db = SupabaseClient<Database>;

export type QuestionBankErrorCode =
  | "NO_PUBLISHED_VERSION"
  | "VERSION_NOT_FOUND"
  | "VERSION_ALREADY_PUBLISHED"
  | "VERSION_NOT_DRAFT"
  | "INVALID_SET"
  | "INVALID_TEXT"
  | "NOT_FOUND";

export class QuestionBankError extends Error {
  code: QuestionBankErrorCode;
  /** The broken rules, for INVALID_SET. */
  issues: QuestionSetIssue[];

  constructor(code: QuestionBankErrorCode, message: string, issues: QuestionSetIssue[] = []) {
    super(message);
    this.name = "QuestionBankError";
    this.code = code;
    this.issues = issues;
  }
}

/** Largest accepted text of a question or an alternative (inferred, spec Section 1). */
export const MAX_TEXT_LENGTH = 300;

function fail(context: string, message: string): never {
  throw new Error(`${context} failed: ${message}`);
}

async function loadVersionRow(db: Db, versionId?: string) {
  const query = db
    .from("questionnaire_versions")
    .select("id, version, status, first_choice_points, second_choice_points, late_tiebreak_basis");
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
 * An optional version id serves that exact version (used to keep an attempt on its own version).
 */
export async function getPublicQuestionSet(
  db: Db,
  seed: string,
  versionId?: string,
): Promise<PublicQuestionSet> {
  // With a version id (an attempt already pinned to a version) that version is served whatever
  // its status; without it, the published version is served.
  const version = await loadVersionRow(db, versionId);

  const { data: questions, error: questionsError } = await db
    .from("questions")
    .select("id, position, text, max_choices, kind, chapter")
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
      maxChoices: question.max_choices === 2 ? 2 : 1,
      kind: (question.kind === "duel" ? "duel" : "choice") as QuestionKind,
      chapter: question.chapter === 1 || question.chapter === 2 || question.chapter === 3 ? question.chapter : null,
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
 * The attempt's answers as scoring input, one item per chosen alternative: the first choice of a
 * question has rank 1 and its optional second choice rank 2. It reads the alternatives and
 * questions stored with the answers, so the result does not depend on which questionnaire version
 * is published now.
 */
export async function getScoredAnswers(db: Db, attemptId: string): Promise<ScoredAnswer[]> {
  const { data: answers, error } = await db
    .from("answers")
    .select("question_id, alternative_id, second_alternative_id")
    .eq("attempt_id", attemptId);
  if (error) fail("getScoredAnswers", error.message);
  if (!answers || answers.length === 0) return [];

  const alternativeIds = answers.flatMap((answer) =>
    answer.second_alternative_id ? [answer.alternative_id, answer.second_alternative_id] : [answer.alternative_id],
  );
  const { data: alternatives, error: alternativesError } = await db
    .from("alternatives")
    .select("id, style, weight")
    .in("id", alternativeIds);
  if (alternativesError) fail("getScoredAnswers", alternativesError.message);

  const { data: questions, error: questionsError } = await db
    .from("questions")
    .select("id, position")
    .in("id", answers.map((answer) => answer.question_id));
  if (questionsError) fail("getScoredAnswers", questionsError.message);

  const alternativeById = new Map((alternatives ?? []).map((a) => [a.id, a]));
  const positionById = new Map((questions ?? []).map((q) => [q.id, q.position]));

  return answers.flatMap((answer) => {
    const position = positionById.get(answer.question_id);
    const choices: [string, 1 | 2][] = [[answer.alternative_id, 1]];
    if (answer.second_alternative_id) choices.push([answer.second_alternative_id, 2]);
    return choices.map(([alternativeId, rank]) => {
      const alternative = alternativeById.get(alternativeId);
      if (!alternative || position === undefined) {
        fail("getScoredAnswers", "an answer points to a missing alternative or question");
      }
      return {
        questionPosition: position,
        style: alternative.style as Style,
        weight: alternative.weight,
        rank,
      };
    });
  });
}

/**
 * The scoring rules of the questionnaire version stored on the attempt's answers. An attempt
 * without answers gets the version 1 rules.
 */
export async function getScoringRules(db: Db, attemptId: string): Promise<ScoringRules> {
  const { data: answer, error } = await db
    .from("answers")
    .select("version_id")
    .eq("attempt_id", attemptId)
    .limit(1)
    .maybeSingle();
  if (error) fail("getScoringRules", error.message);
  if (!answer) return DEFAULT_RULES;

  const { data: version, error: versionError } = await db
    .from("questionnaire_versions")
    .select("first_choice_points, second_choice_points, late_tiebreak_basis")
    .eq("id", answer.version_id)
    .single();
  if (versionError) fail("getScoringRules", versionError.message);
  return {
    firstPoints: version.first_choice_points,
    secondPoints: version.second_choice_points,
    lateBasis: version.late_tiebreak_basis === "points" ? "points" : "answers",
  };
}

/** Complete question set with the style mapping and weights, for the admin editor (RF-12). */
export async function loadQuestionBank(db: Db, versionId?: string): Promise<EditableQuestionSet> {
  const version = await loadVersionRow(db, versionId);

  const { data: questions, error: questionsError } = await db
    .from("questions")
    .select("id, position, text, max_choices, kind, chapter")
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
    rules: {
      firstChoicePoints: version.first_choice_points,
      secondChoicePoints: version.second_choice_points,
      lateTiebreakBasis: version.late_tiebreak_basis === "points" ? "points" : "answers",
    },
    questions: (questions ?? []).map((question) => ({
      id: question.id,
      position: question.position,
      text: question.text,
      kind: (question.kind === "duel" ? "duel" : "choice") as QuestionKind,
      chapter: question.chapter,
      maxChoices: question.max_choices === 2 ? 2 : 1,
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

/**
 * Publishes a version: it must pass the structural rules of its profile (checked here for readable
 * messages and again, authoritatively, by the SQL function). The published version, if any, is
 * archived in the same transaction. Returns the number published and the number archived.
 */
export async function publishQuestionnaireVersion(
  db: Db,
  versionId: string,
): Promise<{ published: number; archived: number | null }> {
  const bank = await loadQuestionBank(db, versionId);
  if (bank.status === "published") {
    throw new QuestionBankError("VERSION_ALREADY_PUBLISHED", `Version ${bank.version} is already published.`);
  }
  const issues = validateQuestionSet(bank);
  if (issues.length > 0) {
    throw new QuestionBankError("INVALID_SET", issues[0].message, issues);
  }

  const { data: current, error: currentError } = await db
    .from("questionnaire_versions")
    .select("version")
    .eq("status", "published")
    .maybeSingle();
  if (currentError) fail("publishQuestionnaireVersion", currentError.message);

  const { error } = await db.rpc("publish_questionnaire_version", { p_version: versionId });
  if (error) {
    if (error.message.includes("VERSION_ALREADY_PUBLISHED")) {
      throw new QuestionBankError("VERSION_ALREADY_PUBLISHED", `Version ${bank.version} is already published.`);
    }
    if (error.message.includes("VERSION_NOT_FOUND")) {
      throw new QuestionBankError("VERSION_NOT_FOUND", "Questionnaire version not found.");
    }
    if (error.message.includes("INVALID_SET")) {
      throw new QuestionBankError("INVALID_SET", error.message);
    }
    fail("publishQuestionnaireVersion", error.message);
  }
  return { published: bank.version, archived: current?.version ?? null };
}

function cleanText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LENGTH) {
    throw new QuestionBankError("INVALID_TEXT", `The text must have 1 to ${MAX_TEXT_LENGTH} characters.`);
  }
  return trimmed;
}

async function requireDraft(db: Db, versionId: string) {
  const { data, error } = await db.from("questionnaire_versions").select("status").eq("id", versionId).single();
  if (error) fail("requireDraft", error.message);
  if (data.status !== "draft") {
    throw new QuestionBankError("VERSION_NOT_DRAFT", "Only a draft version can be edited.");
  }
}

/** Changes only the text of a question of a draft version. */
export async function updateQuestionText(db: Db, questionId: string, text: string): Promise<void> {
  const clean = cleanText(text);
  const { data: question, error } = await db
    .from("questions")
    .select("version_id")
    .eq("id", questionId)
    .maybeSingle();
  if (error) fail("updateQuestionText", error.message);
  if (!question) throw new QuestionBankError("NOT_FOUND", "Question not found.");
  await requireDraft(db, question.version_id);
  const { error: updateError } = await db.from("questions").update({ text: clean }).eq("id", questionId);
  if (updateError) fail("updateQuestionText", updateError.message);
}

/** Changes only the text of an alternative of a draft version (style, weight and order are fixed). */
export async function updateAlternativeText(db: Db, alternativeId: string, text: string): Promise<void> {
  const clean = cleanText(text);
  const { data: alternative, error } = await db
    .from("alternatives")
    .select("questions(version_id)")
    .eq("id", alternativeId)
    .maybeSingle();
  if (error) fail("updateAlternativeText", error.message);
  const versionId = (alternative as { questions: { version_id: string } | null } | null)?.questions?.version_id;
  if (!versionId) throw new QuestionBankError("NOT_FOUND", "Alternative not found.");
  await requireDraft(db, versionId);
  const { error: updateError } = await db.from("alternatives").update({ text: clean }).eq("id", alternativeId);
  if (updateError) fail("updateAlternativeText", updateError.message);
}
