import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAutomationError } from "./automation-errors";
import type { Database } from "./database.types";
import { privacyPolicyUrl } from "./deletion";
import { EMAIL_ATTACHMENT_NAME, renderDiagnosisEmail } from "./diagnosis-email";
import { downloadDiagnosisPdf } from "./diagnosis-storage";
import { getEmailProvider, type EmailProvider } from "./email-provider";
import { diagnosisContentSchema, type DiagnosisContent } from "./schemas/diagnosis-content";
import { mintResultToken, resultLinkUrl } from "./result-token";

type Db = SupabaseClient<Database>;

export type DeliveryOutcome =
  | { result: "sent"; orderId: string }
  | { result: "already_sent"; orderId: string }
  | { result: "retry_scheduled"; orderId: string; nextAt: string }
  | { result: "failed"; orderId: string }
  | { result: "not_claimed"; orderId: string };

/** The collaborators of a send. Tests replace them to produce failures; production uses the defaults. */
export type DeliveryDeps = {
  provider?: EmailProvider;
  loadPdf?: (db: Db, orderId: string) => Promise<Uint8Array | null>;
};

// The e-mail carries the PDF only up to this size; above it the e-mail goes with the link only.
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const STUCK_RESULT_MS = 60_000;

/** What the e-mail needs about an order: where to send it and the stored diagnosis. */
async function loadRecipient(db: Db, orderId: string) {
  const { data: order, error } = await db.from("orders").select("attempt_id").eq("id", orderId).single();
  if (error) throw new Error(`delivery: order could not be read: ${error.message}`);
  // An order whose customer was erased (RF-09) has nobody to send to.
  if (!order.attempt_id) throw new Error("delivery: the order has no attempt");
  const { data: attempt, error: attemptError } = await db
    .from("purchase_attempts")
    .select("customer_id")
    .eq("id", order.attempt_id)
    .single();
  if (attemptError) throw new Error(`delivery: attempt could not be read: ${attemptError.message}`);
  const { data: customer, error: customerError } = await db
    .from("customers")
    .select("email")
    .eq("id", attempt.customer_id)
    .single();
  if (customerError) throw new Error(`delivery: customer could not be read: ${customerError.message}`);

  const { data: result, error: resultError } = await db.from("results").select("content").eq("order_id", orderId).single();
  if (resultError) throw new Error(`delivery: result could not be read: ${resultError.message}`);
  const content = diagnosisContentSchema.safeParse(result.content);
  if (!content.success) throw new Error("delivery: the stored diagnosis has an unexpected shape");
  return { email: customer.email, content: content.data as DiagnosisContent };
}

/**
 * Builds and sends the diagnosis e-mail of an order (the link and, when it fits, the PDF).
 * `token` is the plain access token; without one a new token is minted for the link.
 */
async function sendDiagnosisEmail(db: Db, orderId: string, token: string | null, deps: DeliveryDeps): Promise<void> {
  const { email, content } = await loadRecipient(db, orderId);
  const link = resultLinkUrl(token ?? (await mintResultToken(db, orderId)));
  const resultBlock = content.blocks[0] as unknown as { paragraphs: string[] };

  const message = renderDiagnosisEmail({
    firstName: content.customer.firstName,
    predominantLabel: content.predominant.label,
    secondaryLabel: content.secondary.label,
    resultText: resultBlock.paragraphs[0],
    link,
    privacyUrl: privacyPolicyUrl(),
  });

  let attachments: { filename: string; content: Uint8Array }[] | undefined;
  const pdf = await (deps.loadPdf ?? downloadDiagnosisPdf)(db, orderId);
  if (!pdf) {
    await recordAutomationError(db, orderId, "EMAIL_ATTACHMENT", "The PDF was not found: the e-mail goes with the link only.");
  } else if (pdf.length > MAX_ATTACHMENT_BYTES) {
    await recordAutomationError(db, orderId, "EMAIL_ATTACHMENT", "The PDF is larger than 2 MB: the e-mail goes with the link only.", {
      bytes: pdf.length,
    });
  } else {
    attachments = [{ filename: EMAIL_ATTACHMENT_NAME, content: pdf }];
  }

  await (deps.provider ?? getEmailProvider()).send({ to: email, subject: message.subject, html: message.html, text: message.text, attachments });
}

/** The technical reason of a failure: no addresses, names or tokens ever reach the records. */
function describeFailure(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? `${error.name}: ${code}` : error.message.slice(0, 300);
  }
  return "unknown error";
}

/**
 * Sends the diagnosis e-mail of an order, exactly once. Reserves the delivery for this run, sends,
 * and either completes it (the order becomes DELIVERED) or schedules the next attempt at 1, 5 and
 * 15 minutes; after the last failure the delivery is FAILED and the order FAILED (DELIVERY_FAILED).
 */
export async function deliverDiagnosis(
  db: Db,
  orderId: string,
  options: { token?: string | null; deps?: DeliveryDeps } = {},
): Promise<DeliveryOutcome> {
  const { data: claim, error: claimError } = await db.rpc("claim_delivery", { p_order: orderId });
  if (claimError) throw new Error(`claim_delivery failed: ${claimError.message}`);
  const claimed = claim as unknown as { claimed: boolean; reason?: string };
  if (!claimed.claimed) {
    return { result: claimed.reason === "already_sent" ? "already_sent" : "not_claimed", orderId };
  }

  try {
    await sendDiagnosisEmail(db, orderId, options.token ?? null, options.deps ?? {});
  } catch (caught) {
    const { data, error } = await db.rpc("fail_delivery", { p_order: orderId, p_error: describeFailure(caught) });
    if (error) throw new Error(`fail_delivery failed: ${error.message}`);
    const state = data as unknown as { state: string; next_at?: string };
    if (state.state === "retry") return { result: "retry_scheduled", orderId, nextAt: state.next_at! };
    if (state.state === "failed") {
      await recordAutomationError(db, orderId, "DELIVERY_FAILED", "The e-mail could not be delivered after all attempts.", {
        lastError: describeFailure(caught),
      });
      return { result: "failed", orderId };
    }
    return { result: "not_claimed", orderId };
  }

  const { error: completeError } = await db.rpc("complete_delivery", { p_order: orderId });
  if (completeError) throw new Error(`complete_delivery failed: ${completeError.message}`);
  return { result: "sent", orderId };
}

/**
 * Sends a new link to the customer of an order (the "pedir novo link" page). Always mints a new
 * token and never touches the delivery record of the original send.
 */
export async function sendResultLinkEmail(db: Db, orderId: string, options: { deps?: DeliveryDeps } = {}): Promise<void> {
  await sendDiagnosisEmail(db, orderId, null, options.deps ?? {});
}

/**
 * Runs the deliveries that are due: a scheduled retry, an expired lease, or a diagnosis that was
 * saved but whose first send never started. Used by the cron job; one order after the other.
 */
export async function runDueDeliveries(
  db: Db,
  options: { limit?: number; deps?: DeliveryDeps } = {},
): Promise<DeliveryOutcome[]> {
  const limit = options.limit ?? 5;
  const ids: string[] = [];

  const { data: due, error } = await db
    .from("deliveries")
    .select("order_id")
    .eq("channel", "email")
    .eq("status", "PENDING")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`runDueDeliveries failed: ${error.message}`);
  for (const row of due ?? []) ids.push(row.order_id);

  if (ids.length < limit) {
    // Results older than a minute whose order still waits for its first delivery.
    const cutoff = new Date(Date.now() - STUCK_RESULT_MS).toISOString();
    const { data: results, error: resultsError } = await db
      .from("results")
      .select("order_id")
      .lte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(200);
    if (resultsError) throw new Error(`runDueDeliveries failed: ${resultsError.message}`);
    const candidates = (results ?? []).map((row) => row.order_id);
    if (candidates.length) {
      const { data: processing } = await db.from("orders").select("id").in("id", candidates).eq("status", "PROCESSING");
      const { data: existing } = await db.from("deliveries").select("order_id").eq("channel", "email").in("order_id", candidates);
      const hasRow = new Set((existing ?? []).map((row) => row.order_id));
      for (const order of processing ?? []) {
        if (ids.length >= limit) break;
        if (!hasRow.has(order.id) && !ids.includes(order.id)) ids.push(order.id);
      }
    }
  }

  const outcomes: DeliveryOutcome[] = [];
  for (const id of ids) {
    try {
      outcomes.push(await deliverDiagnosis(db, id, { token: null, deps: options.deps }));
    } catch {
      console.error("delivery job: an order could not be processed", id);
    }
  }
  return outcomes;
}

/** Puts a failed delivery of a paid order back in line and sends once ("Reprocessar", RF-10). */
export async function retryDelivery(db: Db, orderId: string, options: { deps?: DeliveryDeps } = {}): Promise<DeliveryOutcome> {
  const { data, error } = await db.rpc("reset_delivery", { p_order: orderId });
  if (error) throw new Error(`reset_delivery failed: ${error.message}`);
  if (data !== true) return { result: "not_claimed", orderId };
  return deliverDiagnosis(db, orderId, { token: null, deps: options.deps });
}
