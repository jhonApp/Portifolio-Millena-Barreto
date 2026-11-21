import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailProviderError } from "@/lib/diagnostico/email-provider";
import { createResendProvider } from "@/lib/diagnostico/resend";

const KEY = "re_test_key_not_a_real_secret";
const FROM = "Millena Barreto <diagnostico@example.com>";
const MESSAGE = {
  to: "maria@example.com",
  subject: "Seu diagnóstico de estilo chegou!",
  html: "<p>oi</p>",
  text: "oi",
  attachments: [{ filename: "diagnostico-de-estilo.pdf", content: new Uint8Array([37, 80, 68, 70]) }],
};

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  process.env.RESEND_API_KEY = KEY;
  process.env.EMAIL_FROM = FROM;
});
afterEach(() => {
  for (const [name, value] of [["RESEND_API_KEY", saved.key], ["EMAIL_FROM", saved.from]] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const providerWith = (fetchMock: unknown, timeoutMs?: number) =>
  createResendProvider({ fetch: fetchMock as typeof fetch, timeoutMs });

describe("Resend provider", () => {
  it("sends from to subject html text and the attachment in base64", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: "msg_123" }));
    const result = await providerWith(fetchMock).send(MESSAGE);
    expect(result).toEqual({ providerId: "msg_123" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      from: FROM,
      to: ["maria@example.com"],
      subject: MESSAGE.subject,
      html: "<p>oi</p>",
      text: "oi",
      attachments: [{ filename: "diagnostico-de-estilo.pdf", content: Buffer.from([37, 80, 68, 70]).toString("base64") }],
    });
  });

  it("sends no attachments field when there is none", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: "msg_1" }));
    await providerWith(fetchMock).send({ ...MESSAGE, attachments: undefined });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("attachments");
  });

  it("sends the bearer key and never puts it in an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ message: "bad" }, 422));
    let error: unknown;
    try {
      await providerWith(fetchMock).send(MESSAGE);
    } catch (e) {
      error = e;
    }
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(error).toBeInstanceOf(EmailProviderError);
    expect((error as Error).message).not.toContain(KEY);
  });

  it("a 4xx answer becomes EMAIL_REJECTED", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}, 403));
    await expect(providerWith(fetchMock).send(MESSAGE)).rejects.toMatchObject({ code: "EMAIL_REJECTED" });
  });

  it("a 5xx or a network failure becomes EMAIL_UNAVAILABLE", async () => {
    await expect(providerWith(vi.fn().mockResolvedValue(json({}, 503))).send(MESSAGE)).rejects.toMatchObject({
      code: "EMAIL_UNAVAILABLE",
    });
    await expect(providerWith(vi.fn().mockResolvedValue(json({}, 429))).send(MESSAGE)).rejects.toMatchObject({
      code: "EMAIL_UNAVAILABLE",
    });
    await expect(providerWith(vi.fn().mockRejectedValue(new TypeError("fetch failed"))).send(MESSAGE)).rejects.toMatchObject({
      code: "EMAIL_UNAVAILABLE",
    });
  });

  it("an answer without an id becomes EMAIL_BAD_RESPONSE", async () => {
    await expect(providerWith(vi.fn().mockResolvedValue(json({}))).send(MESSAGE)).rejects.toMatchObject({
      code: "EMAIL_BAD_RESPONSE",
    });
  });

  it("a slow answer is aborted at the timeout", async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    await expect(providerWith(fetchMock, 20).send(MESSAGE)).rejects.toMatchObject({ code: "EMAIL_UNAVAILABLE" });
  });

  it("a missing key fails on configuration", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(providerWith(vi.fn()).send(MESSAGE)).rejects.toMatchObject({ name: "ConfigError" });
  });
});
