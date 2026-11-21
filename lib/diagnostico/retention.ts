import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAutomationError } from "./automation-errors";
import { RETENTION_BATCH, STALE_DELETION_REQUEST_DAYS } from "./constants";
import type { Database } from "./database.types";
import {
  pendingDeletionRequestIds,
  pendingNoticeIds,
  processDeletionRequest,
  sendCompletionNotice,
  type DeletionDeps,
} from "./deletion";
import { eraseCustomer } from "./erasure";

type Db = SupabaseClient<Database>;

export type RetentionReport = {
  deletions: { processed: number; completed: number; pending: number };
  notices: { sent: number; failed: number };
  unpaidAttemptsPurged: number;
  paidCustomersErased: number;
  requestsCleaned: number;
};

/**
 * The daily retention run (RF-09). In order: finish the deletion requests that are still pending,
 * send the completion e-mails still owed, delete unpaid attempts older than 7 days, erase customers
 * whose paid orders are all older than 12 months, and remove stale deletion requests. Each step has a
 * batch limit so one run stays inside the time limit. The report holds counts only.
 */
export async function runRetention(
  db: Db,
  options: { deps?: DeletionDeps; now?: Date } = {},
): Promise<RetentionReport> {
  const deps = options.deps ?? {};
  const now = options.now ?? new Date();
  const report: RetentionReport = {
    deletions: { processed: 0, completed: 0, pending: 0 },
    notices: { sent: 0, failed: 0 },
    unpaidAttemptsPurged: 0,
    paidCustomersErased: 0,
    requestsCleaned: 0,
  };

  for (const id of await pendingDeletionRequestIds(db, RETENTION_BATCH.requests)) {
    const state = await processDeletionRequest(db, id, deps);
    report.deletions.processed += 1;
    report.deletions[state] += 1;
  }

  for (const id of await pendingNoticeIds(db, RETENTION_BATCH.notices)) {
    if (await sendCompletionNotice(db, id, deps)) report.notices.sent += 1;
    else report.notices.failed += 1;
  }

  const { data: purged, error: purgeError } = await db.rpc("purge_unpaid_attempts", { p_limit: RETENTION_BATCH.attempts });
  if (purgeError) throw new Error(`purge_unpaid_attempts failed: ${purgeError.message}`);
  report.unpaidAttemptsPurged = purged ?? 0;

  const { data: due, error: dueError } = await db.rpc("paid_customers_due", { p_limit: RETENTION_BATCH.customers });
  if (dueError) throw new Error(`paid_customers_due failed: ${dueError.message}`);
  const erase = deps.erase ?? ((client: Db, customerId: string) => eraseCustomer(client, customerId));
  for (const customerId of due ?? []) {
    const outcome = await erase(db, customerId);
    if (outcome.result === "erased") report.paidCustomersErased += 1;
    else if (outcome.result === "failed") {
      await recordAutomationError(db, null, "RETENTION_FAILED", `A customer past the retention period could not be erased (${outcome.stage}).`);
    }
  }

  const cutoff = new Date(now.getTime() - STALE_DELETION_REQUEST_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cleaned, error: cleanError } = await db
    .from("deletion_requests")
    .delete()
    .is("confirmed_at", null)
    .lt("expires_at", cutoff)
    .select("id");
  if (cleanError) throw new Error(`stale deletion requests could not be removed: ${cleanError.message}`);
  report.requestsCleaned = cleaned?.length ?? 0;

  return report;
}
