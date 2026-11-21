import "server-only";
import { getEmailEnv } from "./env";
import { EmailProviderError, type EmailMessage, type EmailProvider } from "./email-provider";

// Resend (https://resend.com/docs/api-reference/emails/send-email). The request shape follows its
// public reference and is confirmed only by the live check of RF-08 (tests/live/resend-email.live.test.ts).
const ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_TIMEOUT_MS = 10_000;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function createResendProvider(options: { fetch?: typeof fetch; timeoutMs?: number } = {}): EmailProvider {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async send(message: EmailMessage) {
      const { RESEND_API_KEY, EMAIL_FROM } = getEmailEnv();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await doFetch(ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            ...(message.attachments?.length
              ? {
                  attachments: message.attachments.map((file) => ({
                    filename: file.filename,
                    content: toBase64(file.content),
                  })),
                }
              : {}),
          }),
          signal: controller.signal,
        });
      } catch {
        // Network failure or timeout. The message never includes the request (it holds the key).
        throw new EmailProviderError("EMAIL_UNAVAILABLE");
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        throw new EmailProviderError(
          response.status >= 500 || response.status === 429 ? "EMAIL_UNAVAILABLE" : "EMAIL_REJECTED",
          `Resend answered ${response.status}`,
        );
      }
      let body: { id?: string };
      try {
        body = (await response.json()) as { id?: string };
      } catch {
        throw new EmailProviderError("EMAIL_BAD_RESPONSE");
      }
      if (!body.id) throw new EmailProviderError("EMAIL_BAD_RESPONSE");
      return { providerId: body.id };
    },
  };
}
