import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { RESULT_TOKEN_DAYS } from "./constants";
import type { Database } from "./database.types";
import { getAppUrlEnv } from "./env";
import { resultPathFor } from "./paths";

type Db = SupabaseClient<Database>;

// 32 random bytes in base64url are always 43 characters.
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** Only the hash of a token is stored; the plain value exists in the link and in memory. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateResultToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isResultTokenFormat(value: string): boolean {
  return TOKEN_FORMAT.test(value);
}

/** Creates a new access token for an order (30 days) and returns the plain value. */
export async function mintResultToken(db: Db, orderId: string): Promise<string> {
  const token = generateResultToken();
  const expiresAt = new Date(Date.now() + RESULT_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await db
    .from("result_tokens")
    .insert({ order_id: orderId, token_hash: hashToken(token), expires_at: expiresAt });
  if (error) throw new Error(`mintResultToken failed: ${error.message}`);
  return token;
}

/** The order of a token, or null when the token is malformed, unknown, expired or revoked. */
export async function findResultToken(db: Db, token: string): Promise<{ orderId: string } | null> {
  if (!isResultTokenFormat(token)) return null;
  const { data, error } = await db
    .from("result_tokens")
    .select("order_id, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw new Error(`findResultToken failed: ${error.message}`);
  if (!data || data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return { orderId: data.order_id };
}

/** The secure link of the result screen, with the public address of the site. */
export function resultLinkUrl(token: string): string {
  const { APP_URL } = getAppUrlEnv();
  return new URL(resultPathFor(token), APP_URL).toString();
}
