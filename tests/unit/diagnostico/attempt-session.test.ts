import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ATTEMPT_COOKIE,
  attemptCookie,
  readAttemptId,
  readAttemptIdFromCookies,
  signAttemptId,
  verifyAttemptCookieValue,
} from "@/lib/diagnostico/attempt-session";

const ID = "0f3c2f7e-5d0a-4c53-9a65-8c2f9e0a7b11";

function requestWithCookie(cookie: string) {
  return new Request("http://localhost/x", { headers: { cookie } });
}

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "unit-test-secret-with-at-least-32-characters");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("attempt cookie", () => {
  it("signature verifies for the same id", () => {
    const request = requestWithCookie(`${ATTEMPT_COOKIE}=${signAttemptId(ID)}`);
    expect(readAttemptId(request)).toBe(ID);
  });

  it("reads the cookie among others", () => {
    const request = requestWithCookie(`a=1; ${ATTEMPT_COOKIE}=${signAttemptId(ID)}; b=2`);
    expect(readAttemptId(request)).toBe(ID);
  });

  it("a tampered id fails", () => {
    const other = "11111111-5d0a-4c53-9a65-8c2f9e0a7b11";
    const signature = signAttemptId(ID).split(".")[1];
    expect(readAttemptId(requestWithCookie(`${ATTEMPT_COOKIE}=${other}.${signature}`))).toBeNull();
  });

  it("a signature made with another secret fails", () => {
    const signed = signAttemptId(ID);
    vi.stubEnv("SESSION_SECRET", "another-secret-also-with-32-characters!!");
    expect(readAttemptId(requestWithCookie(`${ATTEMPT_COOKIE}=${signed}`))).toBeNull();
  });

  it("a cookie without signature is rejected", () => {
    expect(readAttemptId(requestWithCookie(`${ATTEMPT_COOKIE}=${ID}`))).toBeNull();
    expect(readAttemptId(requestWithCookie(`${ATTEMPT_COOKIE}=${ID}.`))).toBeNull();
  });

  it("a request without cookies returns null", () => {
    expect(readAttemptId(new Request("http://localhost/x"))).toBeNull();
  });

  it("builds an HttpOnly SameSite=Lax cookie valid for 7 days", () => {
    const cookie = attemptCookie(ID);
    expect(cookie).toContain(`${ATTEMPT_COOKIE}=${ID}.`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=604800");
  });

  it("Secure is set only in production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(attemptCookie(ID)).not.toContain("Secure");
    vi.stubEnv("NODE_ENV", "production");
    expect(attemptCookie(ID)).toContain("Secure");
  });
});

describe("cookie value verification", () => {
  it("verifyAttemptCookieValue accepts a signed value and rejects a tampered one", () => {
    const signed = signAttemptId(ID);
    expect(verifyAttemptCookieValue(signed)).toBe(ID);
    expect(verifyAttemptCookieValue(`${signed}x`)).toBeNull();
    expect(verifyAttemptCookieValue(ID)).toBeNull();
    expect(verifyAttemptCookieValue("")).toBeNull();
    expect(verifyAttemptCookieValue("not-a-uuid.abc")).toBeNull();
  });

  it("readAttemptIdFromCookies reads from a cookie store", () => {
    const signed = signAttemptId(ID);
    const store = { get: (name: string) => (name === ATTEMPT_COOKIE ? { value: signed } : undefined) };
    expect(readAttemptIdFromCookies(store)).toBe(ID);
    expect(readAttemptIdFromCookies({ get: () => undefined })).toBeNull();
    expect(readAttemptIdFromCookies({ get: () => ({ value: "garbage" }) })).toBeNull();
  });
});
