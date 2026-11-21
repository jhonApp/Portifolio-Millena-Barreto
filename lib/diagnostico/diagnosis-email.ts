// Pure template of the diagnosis e-mail: no database, no network, no clock.
// Colors are the site's tokens (primary #10151f, accent #937dad, white).

export const EMAIL_SUBJECT = "Seu diagnóstico de estilo chegou!";
export const EMAIL_BUTTON = "Ver meu diagnóstico completo";
export const EMAIL_ATTACHMENT_NAME = "diagnostico-de-estilo.pdf";
const MAX_RESULT_TEXT = 280;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** The paragraph cut at a sentence end within the limit (or at a word, with an ellipsis). */
export function shortResultText(paragraph: string, maxChars: number = MAX_RESULT_TEXT): string {
  const text = paragraph.trim().replace(/\s+/g, " ");
  if (text.length <= maxChars) return text;
  const window = text.slice(0, maxChars);
  const sentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  if (sentenceEnd > maxChars * 0.4) return window.slice(0, sentenceEnd + 1);
  const wordEnd = window.lastIndexOf(" ");
  return `${window.slice(0, wordEnd > 0 ? wordEnd : maxChars).replace(/[,;:]$/, "")}…`;
}

export type DiagnosisEmailInput = {
  firstName: string;
  predominantLabel: string;
  secondaryLabel: string;
  resultText: string;
  link: string;
};

export function renderDiagnosisEmail(input: DiagnosisEmailInput): { subject: string; html: string; text: string } {
  const name = escapeHtml(input.firstName);
  const predominant = escapeHtml(input.predominantLabel);
  const secondary = escapeHtml(input.secondaryLabel);
  const result = escapeHtml(shortResultText(input.resultText));
  const link = escapeHtml(input.link);

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(EMAIL_SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;color:#475467;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#10151f;padding:28px 32px;text-align:center;">
          <span style="font-size:22px;letter-spacing:6px;color:#ffffff;text-transform:uppercase;">Millena Barreto</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:20px;color:#10151f;"><strong>Olá, ${name}!</strong></p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">O seu diagnóstico de estilo ficou pronto.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
            <tr><td style="padding:16px;border:1px solid #e4e0ea;border-radius:8px;">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:#937dad;text-transform:uppercase;">Seu estilo predominante</p>
              <p style="margin:4px 0 12px;font-size:26px;color:#10151f;"><strong>${predominant}</strong></p>
              <p style="margin:0;font-size:14px;">Seu segundo estilo: <strong style="color:#10151f;">${secondary}</strong></p>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${result}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
            <tr><td style="background:#937dad;border-radius:6px;">
              <a href="${link}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${EMAIL_BUTTON}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;">Se o botão não abrir, copie este endereço no navegador:<br><a href="${link}" style="color:#937dad;word-break:break-all;">${link}</a></p>
          <p style="margin:16px 0 0;font-size:13px;line-height:1.5;">O seu diagnóstico em PDF segue em anexo. O link é pessoal e vale por 30 dias.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f4f4f6;text-align:center;font-size:12px;color:#475467;">
          Com carinho, Millena Barreto
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Olá, ${input.firstName}!`,
    "",
    "O seu diagnóstico de estilo ficou pronto.",
    "",
    `Seu estilo predominante: ${input.predominantLabel}`,
    `Seu segundo estilo: ${input.secondaryLabel}`,
    "",
    shortResultText(input.resultText),
    "",
    `${EMAIL_BUTTON}: ${input.link}`,
    "",
    "O seu diagnóstico em PDF segue em anexo. O link é pessoal e vale por 30 dias.",
    "",
    "Com carinho,",
    "Millena Barreto",
  ].join("\n");

  return { subject: EMAIL_SUBJECT, html, text };
}
