import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { DeliveryPreference } from "./constants";

type Db = SupabaseClient<Database>;

export type CreateAttemptInput = {
  fullName: string;
  email: string;
  whatsapp: string;
  deliveryPreference: DeliveryPreference;
  ipHash: string;
  idempotencyKey: string;
  consentVersion: string;
  consentText: string;
};

export async function findAttemptByIdempotencyKey(db: Db, key: string): Promise<string | null> {
  const { data, error } = await db
    .from("purchase_attempts")
    .select("id")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw new Error(`findAttemptByIdempotencyKey failed: ${error.message}`);
  return data?.id ?? null;
}

/**
 * Creates customer, attempt and consent atomically through the SQL function.
 * When a concurrent request with the same idempotency key wins the race (unique violation),
 * the existing attempt is returned with `created: false`.
 */
export async function createAttempt(
  db: Db,
  input: CreateAttemptInput,
): Promise<{ attemptId: string; created: boolean }> {
  const { data, error } = await db.rpc("create_purchase_attempt", {
    p_name: input.fullName,
    p_email: input.email,
    p_whatsapp: input.whatsapp,
    p_preference: input.deliveryPreference,
    p_ip_hash: input.ipHash,
    p_idempotency_key: input.idempotencyKey,
    p_consent_version: input.consentVersion,
    p_consent_text: input.consentText,
  });
  if (!error && data) return { attemptId: data as string, created: true };

  if (error?.code === "23505") {
    const existing = await findAttemptByIdempotencyKey(db, input.idempotencyKey);
    if (existing) return { attemptId: existing, created: false };
  }
  throw new Error(`createAttempt failed: ${error?.message ?? "no id returned"}`);
}

/** Fixed-window counter. Returns false when the limit for the window is exceeded. */
export async function hitRateLimit(
  db: Db,
  key: string,
  windowSeconds: number,
  max: number,
): Promise<boolean> {
  const { data, error } = await db.rpc("hit_rate_limit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) throw new Error(`hitRateLimit failed: ${error.message}`);
  return data === true;
}
