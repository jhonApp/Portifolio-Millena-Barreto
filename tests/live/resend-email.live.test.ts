import { describe, expect, it } from "vitest";
import { renderDiagnosisEmail } from "@/lib/diagnostico/diagnosis-email";
import { createResendProvider } from "@/lib/diagnostico/resend";

// LIVE CHECK L1 (RF-08). Sends ONE real e-mail through Resend, with a small PDF attached.
// - Never part of the default runs: it lives outside tests/unit and tests/integration.
// - Needs a Resend account with a verified sender domain: EMAIL_FROM is the sender, RESEND_API_KEY a
//   TEST or RESTRICTED key (environment or .env.local; never a production key, never printed).
// - LIVE_EMAIL_TO is the recipient (an address the owner controls). It is never printed.
// - It runs only when RUN_LIVE_RESEND=true and only with the owner's approval for that run.
//   npm run test:live

const enabled = process.env.RUN_LIVE_RESEND === "true";

// A tiny valid PDF: enough to prove that the attachment is accepted.
const SAMPLE_PDF = new TextEncoder().encode(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

describe.skipIf(!enabled)("Resend live check L1", () => {
  it("sends one real e-mail with the PDF attached through Resend", async () => {
    const to = process.env.LIVE_EMAIL_TO;
    if (!to) throw new Error("LIVE_EMAIL_TO is not set");

    const message = renderDiagnosisEmail({
      firstName: "Teste",
      predominantLabel: "Elegante",
      secondaryLabel: "Romântico",
      resultText: "Este é um e-mail de teste do diagnóstico de estilo. Nenhuma ação é necessária.",
      link: "https://example.com/diagnostico-estilo/resultado/teste",
    });
    const result = await createResendProvider().send({
      to,
      subject: `[TESTE] ${message.subject}`,
      html: message.html,
      text: message.text,
      attachments: [{ filename: "diagnostico-de-estilo.pdf", content: SAMPLE_PDF }],
    });

    expect(result.providerId).toBeTruthy();
    // Evidence for the status report: a message id prefix only, never the key or the address.
    console.log(JSON.stringify({ messageIdPrefix: result.providerId.slice(0, 8), accepted: true }));
  });
});
