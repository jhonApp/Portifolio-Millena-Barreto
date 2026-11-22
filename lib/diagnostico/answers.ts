import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAttemptIdFromCookies } from "./attempt-session";
import type { Database } from "./database.types";
import type { SavedChoice } from "./questionnaire-state";

export type { SavedChoice };

type Db = SupabaseClient<Database>;
type CookieStore = { get(name: string): { value: string } | undefined };

export type AnswerErrorCode = "ATTEMPT_NOT_FOUND" | "ALTERNATIVE_MISMATCH" | "VERSION_MISMATCH" | "CHOICE_NOT_ALLOWED";
const ANSWER_ERROR_CODES: AnswerErrorCode[] = [
  "ATTEMPT_NOT_FOUND",
  "ALTERNATIVE_MISMATCH",
  "VERSION_MISMATCH",
  "CHOICE_NOT_ALLOWED",
];


export class AnswerError extends Error {
  code: AnswerErrorCode;

  constructor(code: AnswerErrorCode) {
    super(code);
    this.name = "AnswerError";
    this.code = code;
  }
}

export type AnswerProgress = {
  /** Version pinned by the first saved answer, or null when the attempt has no answers yet. */
  versionId: string | null;
  answeredCount: number;
  /** Lowest question position without an answer, or null when every question is answered. */
  firstUnansweredPosition: number | null;
};

function fail(context: string, message: string): never {
  throw new Error(`${context} failed: ${message}`);
}

/**
 * Saves (or replaces) the whole answer to one question: the first choice and, optionally, the
 * second one (null or absent clears it). Returns how many questions the attempt answered.
 */
export async function saveAnswer(
  db: Db,
  attemptId: string,
  questionId: string,
  alternativeId: string,
  secondAlternativeId?: string | null,
): Promise<number> {
  const { data, error } = await db.rpc("save_answer", {
    p_attempt: attemptId,
    p_question: questionId,
    p_alternative: alternativeId,
    ...(secondAlternativeId ? { p_second: secondAlternativeId } : {}),
  });
  if (error) {
    const code = ANSWER_ERROR_CODES.find((candidate) => error.message.includes(candidate));
    if (code) throw new AnswerError(code);
    fail("saveAnswer", error.message);
  }
  return data as number;
}

/** question id -> alternative id, for the answers already saved by the attempt. */
export async function getSavedAnswers(db: Db, attemptId: string): Promise<Record<string, string>> {
  const { data, error } = await db
    .from("answers")
    .select("question_id, alternative_id")
    .eq("attempt_id", attemptId);
  if (error) fail("getSavedAnswers", error.message);
  return Object.fromEntries((data ?? []).map((row) => [row.question_id, row.alternative_id]));
}

/** question id -> first and second choice, for the answers already saved by the attempt. */
export async function getSavedChoices(db: Db, attemptId: string): Promise<Record<string, SavedChoice>> {
  const { data, error } = await db
    .from("answers")
    .select("question_id, alternative_id, second_alternative_id")
    .eq("attempt_id", attemptId);
  if (error) fail("getSavedChoices", error.message);
  return Object.fromEntries(
    (data ?? []).map((row) => [row.question_id, { first: row.alternative_id, second: row.second_alternative_id }]),
  );
}

/** The questionnaire version of the attempt, taken from its first saved answer (null without answers). */
export async function getAttemptVersionId(db: Db, attemptId: string): Promise<string | null> {
  const { data, error } = await db
    .from("answers")
    .select("version_id")
    .eq("attempt_id", attemptId)
    .limit(1)
    .maybeSingle();
  if (error) fail("getAttemptVersionId", error.message);
  return data?.version_id ?? null;
}

export async function getAnswerProgress(db: Db, attemptId: string): Promise<AnswerProgress> {
  const pinned = await getAttemptVersionId(db, attemptId);

  let versionId = pinned;
  if (!versionId) {
    const { data, error } = await db
      .from("questionnaire_versions")
      .select("id")
      .eq("status", "published")
      .maybeSingle();
    if (error) fail("getAnswerProgress", error.message);
    versionId = data?.id ?? null;
  }

  const answers = await getSavedAnswers(db, attemptId);
  const answeredCount = Object.keys(answers).length;
  if (!versionId) return { versionId: pinned, answeredCount, firstUnansweredPosition: null };

  const { data: questions, error } = await db
    .from("questions")
    .select("id, position")
    .eq("version_id", versionId)
    .order("position");
  if (error) fail("getAnswerProgress", error.message);

  const firstUnanswered = (questions ?? []).find((question) => !answers[question.id]);
  return {
    versionId: pinned,
    answeredCount,
    firstUnansweredPosition: firstUnanswered ? firstUnanswered.position : null,
  };
}

/**
 * The attempt of the request, when the cookie is valid and the attempt exists and has not expired.
 * Anything else (no cookie, tampered cookie, deleted or expired attempt) returns null.
 */
export async function getActiveAttemptId(db: Db, store: CookieStore): Promise<string | null> {
  const attemptId = readAttemptIdFromCookies(store);
  if (!attemptId) return null;
  const { data, error } = await db
    .from("purchase_attempts")
    .select("id, expires_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) fail("getActiveAttemptId", error.message);
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.id;
}
