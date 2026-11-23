import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_GENERATION_ATTEMPTS, type DeliveryPreference } from "./constants";
import type { Database, Json } from "./database.types";
import { loadPublishedContent } from "./content-store";
import { ContentError, composeDiagnosis } from "./diagnosis-composer";
import { onDiagnosisReady as defaultOnDiagnosisReady } from "./diagnosis-ready-hook";
import { uploadDiagnosisPdf as defaultUploadPdf } from "./diagnosis-storage";
import { getAttemptVersionId } from "./answers";
import { assertOrderApproved, OrderNotApprovedError } from "./order-guard";
import { recordAutomationError } from "./automation-errors";
import { getScoredAnswers, getScoringRules } from "./question-bank";
import type { DiagnosisContent } from "./schemas/diagnosis-content";
import { EXPECTED_ANSWERS, ScoringError, scoreAnswers } from "./scoring";

type Db = SupabaseClient<Database>;

export type GenerationOutcome =
  | { result: "generated"; orderId: string }
  | { result: "already_generated"; orderId: string }
  | { result: "retry_scheduled"; orderId: string; nextAt: string }
  | { result: "failed"; orderId: string; reason: "GENERATION_FAILED" | "INVALID_ANSWERS" | "MISSING_CONTENT" }
  | { result: "not_claimed"; orderId: string };

export type GenerationErrorCode = "INVALID_ANSWERS" | "MISSING_CONTENT" | "RENDER_PDF" | "UPLOAD_PDF" | "UNEXPECTED";

/** A failed run. Fatal errors need a person; the others are retried on the schedule. */
export class GenerationError extends Error {
  code: GenerationErrorCode;
  retryable: boolean;

  constructor(code: GenerationErrorCode, message: string) {
    super(message);
    this.name = "GenerationError";
    this.code = code;
    this.retryable = code !== "INVALID_ANSWERS" && code !== "MISSING_CONTENT";
  }
}

/** The collaborators of a run. Tests replace them to produce failures; production uses the defaults. */
export type GenerationDeps = {
  renderPdf?: (content: DiagnosisContent, options: { customerName: string }) => Promise<Uint8Array>;
  uploadPdf?: (db: Db, orderId: string, bytes: Uint8Array) => Promise<string>;
  onDiagnosisReady?: (orderId: string, token: string | null) => Promise<void>;
};

const STEP_BY_CODE: Record<GenerationErrorCode, string> = {
  INVALID_ANSWERS: "SCORE_ANSWERS",
  MISSING_CONTENT: "LOAD_CONTENT",
  RENDER_PDF: "RENDER_PDF",
  UPLOAD_PDF: "UPLOAD_PDF",
  UNEXPECTED: "GENERATE",
};

async function defaultRenderPdf(content: DiagnosisContent, options: { customerName: string }): Promise<Uint8Array> {
  // Loaded on demand: the routes that only approve payments do not pay for the PDF library.
  const { renderDiagnosisPdf } = await import("./render-diagnosis-pdf");
  return renderDiagnosisPdf(content, options);
}

async function loadCustomer(db: Db, orderId: string) {
  const { data: order, error } = await db.from("orders").select("attempt_id").eq("id", orderId).single();
  if (error) throw new GenerationError("UNEXPECTED", `order could not be read: ${error.message}`);
  // An order whose customer was erased (RF-09) has no attempt and no answers: nothing to generate.
  if (!order.attempt_id) throw new GenerationError("INVALID_ANSWERS", "the order has no attempt");
  const { data: attempt, error: attemptError } = await db
    .from("purchase_attempts")
    .select("customer_id, delivery_preference")
    .eq("id", order.attempt_id)
    .single();
  if (attemptError) throw new GenerationError("UNEXPECTED", `attempt could not be read: ${attemptError.message}`);
  const { data: customer, error: customerError } = await db
    .from("customers")
    .select("name")
    .eq("id", attempt.customer_id)
    .single();
  if (customerError) throw new GenerationError("UNEXPECTED", `customer could not be read: ${customerError.message}`);
  return {
    attemptId: order.attempt_id,
    name: customer.name,
    deliveryPreference: attempt.delivery_preference as DeliveryPreference,
  };
}

/** The work of one claimed run. Throws GenerationError on any failure. */
async function runGeneration(db: Db, orderId: string, deps: GenerationDeps): Promise<void> {
  const { attemptId, name, deliveryPreference } = await loadCustomer(db, orderId);

  // 1. Score the saved answers (the questionnaire version stored on them).
  let scoring;
  try {
    const answers = await getScoredAnswers(db, attemptId);
    // A two-choice question gives two items, so count the answered questions, not the items.
    const answered = new Set(answers.map((answer) => answer.questionPosition)).size;
    if (answered !== EXPECTED_ANSWERS) {
      throw new GenerationError("INVALID_ANSWERS", `expected ${EXPECTED_ANSWERS} answers, found ${answered}`);
    }
    scoring = scoreAnswers(answers, await getScoringRules(db, attemptId));
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if (error instanceof ScoringError) throw new GenerationError("INVALID_ANSWERS", error.message);
    throw new GenerationError("UNEXPECTED", error instanceof Error ? error.message : "scoring failed");
  }

  // 2. Compose the content from the published templates.
  let content: DiagnosisContent;
  try {
    const published = await loadPublishedContent(db);
    content = composeDiagnosis({
      firstName: name.trim().split(/\s+/)[0],
      deliveryPreference,
      attemptId,
      contentVersionId: published.versionId,
      scoring,
      content: published,
    });
  } catch (error) {
    if (error instanceof ContentError) throw new GenerationError("MISSING_CONTENT", error.missing.join(", "));
    throw new GenerationError("UNEXPECTED", error instanceof Error ? error.message : "composition failed");
  }

  // 3. Render the PDF.
  let bytes: Uint8Array;
  try {
    bytes = await (deps.renderPdf ?? defaultRenderPdf)(content, { customerName: name });
  } catch (error) {
    throw new GenerationError("RENDER_PDF", error instanceof Error ? error.message : "render failed");
  }

  // 4. Store the file first: a result is never "ready" without its PDF.
  let pdfPath: string;
  try {
    pdfPath = await (deps.uploadPdf ?? defaultUploadPdf)(db, orderId, bytes);
  } catch (error) {
    throw new GenerationError("UPLOAD_PDF", error instanceof Error ? error.message : "upload failed");
  }

  // 5. Save the result once (a second run, or a crash after the upload, changes nothing).
  const versionId = await getAttemptVersionId(db, attemptId);
  if (!versionId) throw new GenerationError("INVALID_ANSWERS", "the attempt has no questionnaire version");
  const { error: insertError } = await db.from("results").upsert(
    {
      order_id: orderId,
      version_id: versionId,
      points: scoring.points as unknown as Json,
      predominant_style: scoring.predominant,
      secondary_style: scoring.secondary,
      content: content as unknown as Json,
      pdf_path: pdfPath,
    },
    { onConflict: "order_id", ignoreDuplicates: true },
  );
  if (insertError) throw new GenerationError("UNEXPECTED", `result could not be saved: ${insertError.message}`);
}

async function clearLease(db: Db, orderId: string): Promise<void> {
  await db.from("orders").update({ generation_next_at: null }).eq("id", orderId).eq("status", "PROCESSING");
}

/**
 * Generates the diagnosis of an approved order, exactly once. Refuses an unpaid order, reserves
 * the order for this run, and on success leaves the order PROCESSING with the result saved and
 * the PDF stored (RF-08 delivers it). A failed run is scheduled for retry or ends the order.
 */
export async function generateDiagnosis(
  db: Db,
  orderId: string,
  options: { token?: string | null; deps?: GenerationDeps } = {},
): Promise<GenerationOutcome> {
  const deps = options.deps ?? {};
  await assertOrderApproved(db, orderId); // throws OrderNotApprovedError for an unpaid order

  const { data: existing, error: existingError } = await db
    .from("results")
    .select("order_id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existingError) throw new Error(`generateDiagnosis failed: ${existingError.message}`);
  if (existing) {
    await clearLease(db, orderId);
    return { result: "already_generated", orderId };
  }

  const { data: claim, error: claimError } = await db.rpc("claim_generation", { p_order: orderId });
  if (claimError) throw new Error(`claim_generation failed: ${claimError.message}`);
  if (!(claim as unknown as { claimed: boolean }).claimed) return { result: "not_claimed", orderId };

  try {
    await runGeneration(db, orderId, deps);
  } catch (caught) {
    const error =
      caught instanceof GenerationError
        ? caught
        : new GenerationError("UNEXPECTED", caught instanceof Error ? caught.message : "unknown");
    // Nothing personal goes into the record: the code and the technical message only.
    await recordAutomationError(db, orderId, STEP_BY_CODE[error.code], error.message.slice(0, 500), {
      code: error.code,
    });
    const { data, error: failError } = await db.rpc("fail_generation", {
      p_order: orderId,
      p_reason: error.code === "INVALID_ANSWERS" ? "INVALID_ANSWERS" : "MISSING_CONTENT",
      p_retry: error.retryable,
    });
    if (failError) throw new Error(`fail_generation failed: ${failError.message}`);
    const state = data as unknown as {
      state: string;
      next_at?: string;
      reason?: "GENERATION_FAILED" | "INVALID_ANSWERS" | "MISSING_CONTENT";
    };
    if (state.state === "retry") return { result: "retry_scheduled", orderId, nextAt: state.next_at! };
    if (state.state === "failed") {
      if (state.reason === "GENERATION_FAILED") {
        await recordAutomationError(db, orderId, "GENERATION_FAILED", `all ${MAX_GENERATION_ATTEMPTS} attempts failed`, {
          lastCode: error.code,
        });
      }
      return { result: "failed", orderId, reason: state.reason! };
    }
    return { result: "not_claimed", orderId };
  }

  await clearLease(db, orderId);
  try {
    await (deps.onDiagnosisReady ?? defaultOnDiagnosisReady)(orderId, options.token ?? null);
  } catch (hookError) {
    // The diagnosis stays; the delivery feature can be run again from the admin panel.
    await recordAutomationError(db, orderId, "DIAGNOSIS_READY", "The delivery hook failed.", {
      reason: hookError instanceof Error ? hookError.message.slice(0, 200) : "unknown",
    });
  }
  return { result: "generated", orderId };
}

const STUCK_APPROVAL_MS = 60_000;

/**
 * Runs the orders that are due: a scheduled retry, an expired lease, or an approved order whose
 * first run never started. Used by the cron job. Orders are handled one after the other.
 */
export async function runDueGenerations(
  db: Db,
  options: { limit?: number; deps?: GenerationDeps } = {},
): Promise<GenerationOutcome[]> {
  const limit = options.limit ?? 5;
  const now = new Date().toISOString();
  const stuckBefore = new Date(Date.now() - STUCK_APPROVAL_MS).toISOString();
  const { data, error } = await db
    .from("orders")
    .select("id")
    .or(
      `and(status.eq.PROCESSING,generation_next_at.lte.${now}),and(status.eq.APPROVED,approved_at.lte.${stuckBefore})`,
    )
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`runDueGenerations failed: ${error.message}`);

  const outcomes: GenerationOutcome[] = [];
  for (const order of data ?? []) {
    try {
      outcomes.push(await generateDiagnosis(db, order.id, { token: null, deps: options.deps }));
    } catch (error) {
      if (error instanceof OrderNotApprovedError) continue; // changed state since it was listed
      console.error("generation job: an order could not be processed", order.id);
    }
  }
  return outcomes;
}

/** Puts a paid order that failed in generation back in line and runs it once ("Reprocessar", RF-10). */
export async function reprocessOrder(
  db: Db,
  orderId: string,
  options: { deps?: GenerationDeps } = {},
): Promise<GenerationOutcome> {
  const { data, error } = await db.rpc("reset_generation", { p_order: orderId });
  if (error) throw new Error(`reset_generation failed: ${error.message}`);
  if (data !== true) return { result: "not_claimed", orderId };
  return generateDiagnosis(db, orderId, { token: null, deps: options.deps });
}
