import { createHash, timingSafeEqual } from "node:crypto";
import { getCronEnv } from "./env";

function sameSecret(received: string, expected: string): boolean {
  const left = createHash("sha256").update(received).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

/**
 * Whether a cron request carries "Authorization: Bearer <CRON_SECRET>". Throws ConfigError when the
 * secret is not configured, so a missing setting is never read as "no secret needed".
 */
export function isAuthorizedCron(request: Request): boolean {
  const { CRON_SECRET } = getCronEnv();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  return token.length > 0 && sameSecret(token, CRON_SECRET);
}
