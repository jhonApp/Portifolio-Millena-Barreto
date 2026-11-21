import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAutomationError } from "./automation-errors";
import { DELETION_LINK_HOURS } from "./constants";
import type { Database } from "./database.types";
import { renderDeletionDoneEmail, renderDeletionRequestEmail } from "./deletion-email";
import { getEmailProvider, type EmailProvider } from "./email-provider";
import { eraseCustomer, type ErasureOutcome } from "./erasure";
import { getAppUrlEnv } from "./env";
import { PRIVACY_PATH, deletionConfirmPathFor } from "./paths";
import { generateResultToken, hashToken, isResultTokenFormat } from "./result-token";

type Db = SupabaseClient<Database>;

export type DeletionDeps = {
  emailProvider?: EmailProvider;
  erase?: (db: Db, customerId: string) => Promise<ErasureOutcome>;
};

export type DeletionState = "completed" | "pending" | "expired";

/** The public address of the policy (used in the footer of the privacy e-mails). */
export function privacyPolicyUrl(): string {
  return new URL(PRIVACY_PATH, getAppUrlEnv().APP_URL).toString();
}

function deletionLinkUrl(token: string): string {
  return new URL(deletionConfirmPathFor(token), getAppUrlEnv().APP_URL).toString();
}

/**
 * A deletion request for an e-mail (RF-09). When customers exist for it, a request with a 24-hour link
 * is stored (only the hash of the token) and the confirmation e-mail is sent. Nothing is returned:
 * the caller answers the same neutral sentence whatever happened here.
 */
export async function requestDeletion(db: Db, email: string, deps: DeletionDeps = {}): Promise<void> {
  const { data: customers, error } = await db.from("customers").select("id").eq("email", email).limit(1);
  if (error) throw new Error(`requestDeletion failed: ${error.message}`);
  if (!customers || customers.length === 0) return;

  const token = generateResultToken();
  const expiresAt = new Date(Date.now() + DELETION_LINK_HOURS * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await db
    .from("deletion_requests")
    .insert({ email, token_hash: hashToken(token), expires_at: expiresAt });
  if (insertError) throw new Error(`requestDeletion failed: ${insertError.message}`);

  const message = renderDeletionRequestEmail({ link: deletionLinkUrl(token), privacyUrl: privacyPolicyUrl() });
  try {
    await (deps.emailProvider ?? getEmailProvider()).send({
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch (caught) {
    // Nobody was told: the row expires by itself and the customer can ask again.
    await recordAutomationError(db, null, "DELETION_EMAIL", "The deletion confirmation e-mail could not be sent.", {
      error: caught instanceof Error ? caught.name : "unknown",
    });
  }
}

/** Whether a token can still be confirmed. Read only: nothing about the request is returned. */
export async function isDeletionTokenUsable(db: Db, token: string): Promise<boolean> {
  if (!isResultTokenFormat(token)) return false;
  const { data, error } = await db
    .from("deletion_requests")
    .select("confirmed_at, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw new Error(`isDeletionTokenUsable failed: ${error.message}`);
  if (!data) return false;
  return data.confirmed_at !== null || new Date(data.expires_at).getTime() > Date.now();
}

/**
 * Confirms a request and erases the data at once. `completed` when everything was erased, `pending`
 * when an order is in flight or a step failed (the daily job finishes it), `expired` for an expired
 * or unknown token (the same answer, so a token cannot be probed).
 */
export async function confirmDeletion(db: Db, token: string, deps: DeletionDeps = {}): Promise<{ state: DeletionState }> {
  if (!isResultTokenFormat(token)) return { state: "expired" };
  const { data, error } = await db.rpc("confirm_deletion_request", { p_token_hash: hashToken(token) });
  if (error) throw new Error(`confirmDeletion failed: ${error.message}`);
  const confirmed = data as unknown as { result: "unknown" | "expired" | "confirmed"; request_id?: string; completed?: boolean };
  if (confirmed.result !== "confirmed") return { state: "expired" };
  if (confirmed.completed) return { state: "completed" };
  return { state: await processDeletionRequest(db, confirmed.request_id!, deps) };
}

async function notePending(db: Db, requestId: string, code: string, step: string): Promise<void> {
  const { data: before } = await db.from("deletion_requests").select("last_error").eq("id", requestId).single();
  await db.from("deletion_requests").update({ last_error: code }).eq("id", requestId);
  // One record the first time a request is held back; a failing step is recorded on every run.
  if (code !== "IN_FLIGHT_ORDER" || before?.last_error !== "IN_FLIGHT_ORDER") {
    await recordAutomationError(db, null, step, `The deletion request ${requestId} is waiting (${code}).`, { requestId });
  }
}

/**
 * Erases every customer of a confirmed request's e-mail. Finishes the request when all went, or leaves
 * it pending with the reason in `last_error`. The completion e-mail is sent by whoever marks it done.
 */
export async function processDeletionRequest(
  db: Db,
  requestId: string,
  deps: DeletionDeps = {},
): Promise<"completed" | "pending"> {
  const { data: request, error } = await db
    .from("deletion_requests")
    .select("email, confirmed_at, completed_at")
    .eq("id", requestId)
    .single();
  if (error) throw new Error(`processDeletionRequest failed: ${error.message}`);
  if (request.completed_at) return "completed";
  if (!request.confirmed_at || !request.email) return "pending";

  const { data: customers, error: customersError } = await db.from("customers").select("id").eq("email", request.email);
  if (customersError) throw new Error(`processDeletionRequest failed: ${customersError.message}`);

  const erase = deps.erase ?? ((client: Db, customerId: string) => eraseCustomer(client, customerId));
  for (const customer of customers ?? []) {
    const outcome = await erase(db, customer.id);
    if (outcome.result === "deferred") {
      await notePending(db, requestId, "IN_FLIGHT_ORDER", "DELETION_PENDING");
      return "pending";
    }
    if (outcome.result === "failed") {
      await notePending(db, requestId, outcome.stage, "DELETION_FAILED");
      return "pending";
    }
  }

  const { data: won } = await db.rpc("complete_deletion_request", { p_request: requestId });
  if (won === true) await sendCompletionNotice(db, requestId, deps);
  return "completed";
}

/** Sends the completion e-mail and then clears the address. A failure keeps the address for the next run. */
export async function sendCompletionNotice(db: Db, requestId: string, deps: DeletionDeps = {}): Promise<boolean> {
  const { data: request } = await db.from("deletion_requests").select("email").eq("id", requestId).single();
  if (!request?.email) return true;
  const message = renderDeletionDoneEmail({ privacyUrl: privacyPolicyUrl() });
  try {
    await (deps.emailProvider ?? getEmailProvider()).send({
      to: request.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch (caught) {
    await recordAutomationError(db, null, "DELETION_NOTICE", "The deletion completion e-mail could not be sent.", {
      requestId,
      error: caught instanceof Error ? caught.name : "unknown",
    });
    return false;
  }
  await db.from("deletion_requests").update({ email: null }).eq("id", requestId);
  return true;
}

/** Confirmed requests that are not finished, oldest first. */
export async function pendingDeletionRequestIds(db: Db, limit: number): Promise<string[]> {
  const { data, error } = await db
    .from("deletion_requests")
    .select("id")
    .not("confirmed_at", "is", null)
    .is("completed_at", null)
    .order("confirmed_at")
    .limit(limit);
  if (error) throw new Error(`pendingDeletionRequestIds failed: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}

/** Finished requests whose completion e-mail still has to be sent. */
export async function pendingNoticeIds(db: Db, limit: number): Promise<string[]> {
  const { data, error } = await db
    .from("deletion_requests")
    .select("id")
    .not("completed_at", "is", null)
    .not("email", "is", null)
    .order("completed_at")
    .limit(limit);
  if (error) throw new Error(`pendingNoticeIds failed: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}
