import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigError } from "@/lib/diagnostico/env";
import { verifyWebhookRequest } from "@/lib/diagnostico/webhook-auth";

const SECRET = "s".repeat(40);
const PUBLIC_KEY = "test-public-key-not-real";
const BODY = JSON.stringify({ id: "log_1", event: "transparent.completed" });
const sign = (body: string, key = PUBLIC_KEY) => createHmac("sha256", key).update(body).digest("base64");

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {
    secret: process.env.ABACATEPAY_WEBHOOK_SECRET,
    key: process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY,
  };
  process.env.ABACATEPAY_WEBHOOK_SECRET = SECRET;
  process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY = PUBLIC_KEY;
});
afterEach(() => {
  for (const [name, value] of [
    ["ABACATEPAY_WEBHOOK_SECRET", saved.secret],
    ["ABACATEPAY_WEBHOOK_PUBLIC_KEY", saved.key],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("webhook authentication", () => {
  it("accepts a valid secret and signature", () => {
    expect(
      verifyWebhookRequest({ rawBody: BODY, secretHeader: SECRET, secretQuery: null, signature: sign(BODY) }),
    ).toBe(true);
  });

  it("accepts the secret from the query string when the header is absent", () => {
    expect(
      verifyWebhookRequest({ rawBody: BODY, secretHeader: null, secretQuery: SECRET, signature: sign(BODY) }),
    ).toBe(true);
  });

  it("rejects when either proof is missing or wrong", () => {
    const base = { rawBody: BODY, secretHeader: SECRET, secretQuery: null, signature: sign(BODY) };
    expect(verifyWebhookRequest({ ...base, secretHeader: null })).toBe(false);
    expect(verifyWebhookRequest({ ...base, secretHeader: "wrong".repeat(10) })).toBe(false);
    expect(verifyWebhookRequest({ ...base, signature: null })).toBe(false);
    expect(verifyWebhookRequest({ ...base, signature: "bm9wZQ==" })).toBe(false);
    expect(verifyWebhookRequest({ ...base, secretHeader: "" })).toBe(false);
  });

  it("uses the raw body for the signature", () => {
    const reformatted = JSON.stringify(JSON.parse(BODY), null, 2);
    expect(
      verifyWebhookRequest({ rawBody: reformatted, secretHeader: SECRET, secretQuery: null, signature: sign(BODY) }),
    ).toBe(false);
  });

  it("rejects a signature made with another key", () => {
    expect(
      verifyWebhookRequest({
        rawBody: BODY,
        secretHeader: SECRET,
        secretQuery: null,
        signature: sign(BODY, "another-key"),
      }),
    ).toBe(false);
  });

  it("fails with ConfigError when the secret or the key is not configured", () => {
    delete process.env.ABACATEPAY_WEBHOOK_SECRET;
    expect(() =>
      verifyWebhookRequest({ rawBody: BODY, secretHeader: SECRET, secretQuery: null, signature: sign(BODY) }),
    ).toThrow(ConfigError);
  });
});
