import { DELETION_LINK_HOURS } from "./constants";
import { escapeHtml } from "./diagnosis-email";

// Pure templates of the two privacy e-mails (RF-09): the confirmation link and the completion notice.
// No database, no network, no clock. Neither e-mail carries a name or any personal data.

export const DELETION_REQUEST_SUBJECT = "Confirme a exclusão dos seus dados";
export const DELETION_DONE_SUBJECT = "Sua exclusão foi concluída";
export const DELETION_REQUEST_BUTTON = "Confirmar exclusão";

type Rendered = { subject: string; html: string; text: string };

function layout(title: string, bodyHtml: string, privacyUrl: string): string {
  const policy = escapeHtml(privacyUrl);
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;color:#475467;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#10151f;padding:28px 32px;text-align:center;">
          <span style="font-size:22px;letter-spacing:6px;color:#ffffff;text-transform:uppercase;">Millena Barreto</span>
        </td></tr>
        <tr><td style="padding:32px;">
${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f4f4f6;text-align:center;font-size:12px;color:#475467;">
          <a href="${policy}" style="color:#937dad;">Política de Privacidade</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** The e-mail with the link that confirms a deletion request. `link` is the full address of the page. */
export function renderDeletionRequestEmail(input: { link: string; privacyUrl: string }): Rendered {
  const link = escapeHtml(input.link);
  const body = `          <p style="margin:0 0 16px;font-size:20px;color:#10151f;"><strong>Pedido de exclusão de dados</strong></p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Recebemos um pedido para excluir os dados ligados a este e-mail. Para continuar, confirme pelo botão abaixo. O link vale por ${DELETION_LINK_HOURS} horas.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
            <tr><td style="background:#937dad;border-radius:6px;">
              <a href="${link}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${DELETION_REQUEST_BUTTON}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;">Se o botão não abrir, copie este endereço no navegador:<br><a href="${link}" style="color:#937dad;word-break:break-all;">${link}</a></p>
          <p style="margin:16px 0 0;font-size:13px;line-height:1.5;">Se você não fez este pedido, ignore este e-mail: nada será apagado.</p>`;
  const text = [
    "Pedido de exclusão de dados",
    "",
    `Recebemos um pedido para excluir os dados ligados a este e-mail. Para continuar, confirme pelo link abaixo. O link vale por ${DELETION_LINK_HOURS} horas.`,
    "",
    `${DELETION_REQUEST_BUTTON}: ${input.link}`,
    "",
    "Se você não fez este pedido, ignore este e-mail: nada será apagado.",
    "",
    `Política de Privacidade: ${input.privacyUrl}`,
  ].join("\n");
  return {
    subject: DELETION_REQUEST_SUBJECT,
    html: layout(DELETION_REQUEST_SUBJECT, body, input.privacyUrl),
    text,
  };
}

/** The e-mail that tells the customer the deletion is finished. */
export function renderDeletionDoneEmail(input: { privacyUrl: string }): Rendered {
  const body = `          <p style="margin:0 0 16px;font-size:20px;color:#10151f;"><strong>Exclusão concluída</strong></p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Os seus dados foram excluídos da nossa plataforma, e os arquivos PDF do seu diagnóstico também. O link do seu resultado deixou de funcionar.</p>
          <p style="margin:0;font-size:13px;line-height:1.5;">Ficou guardado apenas o registro do pagamento (número do pedido, valor e data), sem ligação com você, como a lei exige para fins fiscais.</p>`;
  const text = [
    "Exclusão concluída",
    "",
    "Os seus dados foram excluídos da nossa plataforma, e os arquivos PDF do seu diagnóstico também. O link do seu resultado deixou de funcionar.",
    "",
    "Ficou guardado apenas o registro do pagamento (número do pedido, valor e data), sem ligação com você, como a lei exige para fins fiscais.",
    "",
    `Política de Privacidade: ${input.privacyUrl}`,
  ].join("\n");
  return {
    subject: DELETION_DONE_SUBJECT,
    html: layout(DELETION_DONE_SUBJECT, body, input.privacyUrl),
    text,
  };
}
