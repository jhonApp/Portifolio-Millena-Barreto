import "server-only";
import { generateDiagnosis } from "./generation";
import { getSupabaseAdmin } from "./supabase-server";

/**
 * Called once, by the request that wins the approval of an order (RF-06). `token` is the plain
 * result access token (only its hash is stored): it exists in memory for this call, is handed to
 * the delivery hook and must never be logged. A failed run is scheduled for retry by the
 * generation itself, so this only throws for an order that is not approved or on a database error.
 */
export async function startGeneration(orderId: string, token: string): Promise<void> {
  await generateDiagnosis(getSupabaseAdmin(), orderId, { token });
}
