import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSessionEnv } from "./env";

// The attempt is identified by a signed, HTTP-only cookie: "<attemptId>.<signature>".
// The attempt id alone, without a valid signature, never grants access.

export const ATTEMPT_COOKIE = "ds_attempt";
export const ATTEMPT_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, same as purchase_attempts.expires_at

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signature(attemptId: string): string {
  return createHmac("sha256", getSessionEnv().SESSION_SECRET).update(attemptId).digest("base64url");
}

export function signAttemptId(attemptId: string): string {
  return `${attemptId}.${signature(attemptId)}`;
}

/** Full Set-Cookie header value for the attempt cookie. */
export function attemptCookie(attemptId: string): string {
  const parts = [
    `${ATTEMPT_COOKIE}=${signAttemptId(attemptId)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${ATTEMPT_COOKIE_MAX_AGE}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** Returns the attempt id from a request, or null when missing, malformed or not signed by us. */
export function readAttemptId(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const entry = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ATTEMPT_COOKIE}=`));
  if (!entry) return null;
  const value = entry.slice(ATTEMPT_COOKIE.length + 1);
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const attemptId = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  if (!UUID_PATTERN.test(attemptId)) return null;
  const expected = Buffer.from(signature(attemptId));
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? attemptId : null;
}
