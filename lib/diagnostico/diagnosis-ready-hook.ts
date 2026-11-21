import "server-only";
import { deliverDiagnosis } from "./delivery";
import { getSupabaseAdmin } from "./supabase-server";

/**
 * Called after a diagnosis is saved and its PDF stored (RF-07). `token` is the plain result access
 * token when the generation ran in the request that approved the order, and null when it ran from
 * the cron job or from a reprocess (the plain token is never stored): the delivery then mints a
 * new one for the link. A failed send is scheduled for retry by the delivery itself.
 */
export async function onDiagnosisReady(orderId: string, token: string | null): Promise<void> {
  await deliverDiagnosis(getSupabaseAdmin(), orderId, { token });
}
