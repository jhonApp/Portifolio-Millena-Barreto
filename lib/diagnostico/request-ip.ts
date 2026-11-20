import "server-only";
import { createHmac } from "node:crypto";
import { getSessionEnv } from "./env";

/** Client IP: first value of x-forwarded-for (set by Vercel), then x-real-ip, then "unknown". */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** HMAC-SHA-256 (hex) of the client IP. The raw IP is never stored. */
export function clientIpHash(request: Request): string {
  return createHmac("sha256", getSessionEnv().SESSION_SECRET)
    .update(clientIp(request))
    .digest("hex");
}
