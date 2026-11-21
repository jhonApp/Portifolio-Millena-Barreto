import "server-only";
import { emailSimulationEnabled } from "./email-simulation";
import { createResendProvider } from "./resend";
import { createSimulatedEmailProvider } from "./email-provider-simulated";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Uint8Array }[];
};

export interface EmailProvider {
  /** Resolves when the provider accepted the message; returns the provider's message id. */
  send(message: EmailMessage): Promise<{ providerId: string }>;
}

export type EmailProviderErrorCode = "EMAIL_UNAVAILABLE" | "EMAIL_REJECTED" | "EMAIL_BAD_RESPONSE";

export class EmailProviderError extends Error {
  code: EmailProviderErrorCode;

  constructor(code: EmailProviderErrorCode, message?: string) {
    super(message ?? code);
    this.name = "EmailProviderError";
    this.code = code;
  }
}

/** The development provider exists only outside production and only when explicitly enabled. */
export function getEmailProvider(): EmailProvider {
  return emailSimulationEnabled() ? createSimulatedEmailProvider() : createResendProvider();
}
