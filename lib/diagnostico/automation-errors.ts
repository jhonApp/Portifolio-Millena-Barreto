import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types";

type Db = SupabaseClient<Database>;

/** Records a case that needs a person to look at it (shown in the admin panel by RF-10). */
export async function recordAutomationError(
  db: Db,
  orderId: string | null,
  step: string,
  message: string,
  context?: Record<string, Json>,
): Promise<void> {
  const { error } = await db
    .from("automation_errors")
    .insert({ order_id: orderId, step, message, context: context ?? null });
  // Never throw from the flagging itself; never log personal data.
  if (error) console.error("automation error could not be recorded", step);
}
