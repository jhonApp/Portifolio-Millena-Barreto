import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PDF_SIGNED_URL_SECONDS, RESULT_TOKEN_DAYS } from "@/lib/diagnostico/constants";
import { generateResultToken, hashToken, isResultTokenFormat, resultLinkUrl } from "@/lib/diagnostico/result-token";

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.APP_URL;
  process.env.APP_URL = "http://localhost:3001";
});
afterEach(() => {
  if (saved === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = saved;
});

describe("result token helpers", () => {
  it("a token has 43 url-safe characters", () => {
    const token = generateResultToken();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(isResultTokenFormat(token)).toBe(true);
  });

  it("two tokens differ", () => {
    expect(generateResultToken()).not.toBe(generateResultToken());
  });

  it("the hash is sha256 hex", () => {
    const hash = hashToken("abc");
    expect(hash).toBe(createHash("sha256").update("abc").digest("hex"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a malformed token is rejected by the format check", () => {
    for (const value of ["", "short", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}!`, "a b".padEnd(43, "a")]) {
      expect(isResultTokenFormat(value)).toBe(false);
    }
  });

  it("resultLinkUrl joins APP_URL and the token", () => {
    const token = generateResultToken();
    expect(resultLinkUrl(token)).toBe(`http://localhost:3001/diagnostico-estilo/resultado/${token}`);
  });

  it("the token lifetime is 30 days", () => {
    expect(RESULT_TOKEN_DAYS).toBe(30);
  });

  it("the signed URL lifetime is 300 seconds", () => {
    expect(PDF_SIGNED_URL_SECONDS).toBe(300);
  });
});
