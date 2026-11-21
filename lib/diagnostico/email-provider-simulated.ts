import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EmailProviderError, type EmailMessage, type EmailProvider } from "./email-provider";

/** Where the development provider writes: LOCAL_MAIL_DIR, or `.local-mail` in the project folder. */
export function localMailDir(): string {
  return process.env.LOCAL_MAIL_DIR || path.join(process.cwd(), ".local-mail");
}

function safe(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9@._-]+/g, "_").slice(0, 80);
}

/**
 * Used only outside production when ENABLE_EMAIL_SIMULATION=true (see getEmailProvider). Nothing is
 * sent: each message becomes `<time>-<recipient>.html`, `.txt` and the attachment files, so the
 * e-mail can be opened in a browser. EMAIL_SIMULATION_FAIL=true makes every send fail.
 */
export function createSimulatedEmailProvider(options: { dir?: string } = {}): EmailProvider {
  return {
    async send(message: EmailMessage) {
      if (process.env.EMAIL_SIMULATION_FAIL === "true") {
        throw new EmailProviderError("EMAIL_UNAVAILABLE", "simulated failure");
      }
      const dir = options.dir ?? localMailDir();
      mkdirSync(dir, { recursive: true });
      const base = `${Date.now()}-${safe(message.to)}`;
      writeFileSync(path.join(dir, `${base}.html`), message.html, "utf8");
      writeFileSync(path.join(dir, `${base}.txt`), `Para: ${message.to}\nAssunto: ${message.subject}\n\n${message.text}`, "utf8");
      for (const file of message.attachments ?? []) {
        writeFileSync(path.join(dir, `${base}-${safe(file.filename)}`), file.content);
      }
      return { providerId: `local-${base}` };
    },
  };
}
