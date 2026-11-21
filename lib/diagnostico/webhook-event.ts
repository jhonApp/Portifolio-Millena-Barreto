import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types";

type Db = SupabaseClient<Database>;

export type EventRecord = "new" | "duplicate_processed" | "duplicate_unprocessed";

/** Stores the provider event once (unique per event id). */
export async function recordWebhookEvent(
  db: Db,
  event: { id: string; type: string; payload: unknown },
): Promise<EventRecord> {
  const { data, error } = await db.rpc("record_webhook_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_payload: event.payload as Json,
  });
  if (error) throw new Error(`recordWebhookEvent failed: ${error.message}`);
  return data as unknown as EventRecord;
}

export async function markWebhookProcessed(db: Db, eventId: string): Promise<void> {
  const { error } = await db
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", "abacatepay")
    .eq("event_id", eventId);
  if (error) throw new Error(`markWebhookProcessed failed: ${error.message}`);
}
