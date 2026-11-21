import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getWebhookEnv } from "./env";

// Compares two strings in constant time, whatever their lengths.
function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

/**
 * AbacatePay sends two proofs with every delivery: the shared secret (header, or the query
 * string as a fallback) and an HMAC-SHA256 of the raw body, in base64, made with AbacatePay's
 * public webhook key. Both must be valid. The body must be the raw text as received.
 * Throws ConfigError when the secret or the key is not configured.
 */
export function verifyWebhookRequest(input: {
  rawBody: string;
  secretHeader: string | null;
  secretQuery: string | null;
  signature: string | null;
}): boolean {
  const env = getWebhookEnv();
  const secret = input.secretHeader ?? input.secretQuery;
  const secretOk = Boolean(secret) && safeEqual(secret as string, env.ABACATEPAY_WEBHOOK_SECRET);

  const expected = createHmac("sha256", env.ABACATEPAY_WEBHOOK_PUBLIC_KEY)
    .update(input.rawBody)
    .digest("base64");
  const signatureOk = Boolean(input.signature) && safeEqual(input.signature as string, expected);

  return secretOk && signatureOk;
}
