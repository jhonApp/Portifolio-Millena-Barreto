import { PRIVACY_PATH } from "./consent";

// Addresses of the diagnosis flow. Safe to import in the browser and on the server.

export const REGISTRATION_PATH = "/diagnostico-estilo";
export const QUESTIONNAIRE_PATH = "/diagnostico-estilo/perguntas";
export const COMPLETION_PATH = "/diagnostico-estilo/concluido";
export const CHECKOUT_PATH = "/diagnostico-estilo/checkout";
// Where an attempt with fewer than 15 answers is sent back to (RF-05).
export const INCOMPLETE_PATH = `${QUESTIONNAIRE_PATH}?aviso=incompleto`;
export const INCOMPLETE_NOTICE = "Faltam algumas respostas para concluir.";
// Where a customer whose page is older than a new questionnaire version is sent back to (RF-02).
// Draft copy for Millena's review.
export const VERSION_CHANGED_PATH = `${QUESTIONNAIRE_PATH}?aviso=atualizado`;
export const VERSION_CHANGED_NOTICE = "Atualizamos o questionário. Vamos começar de novo?";
// Shown instead of the questionnaire while no version is published (RF-02).
export const QUESTIONNAIRE_UNAVAILABLE_NOTICE = "Estamos ajustando o questionário. Volte em alguns minutos.";
// Where the visitor goes when the attempt cookie is missing, invalid or expired.
export const EXPIRED_PATH = `${REGISTRATION_PATH}?sessao=expirada`;
export const SESSION_EXPIRED_NOTICE = "Sua sessão expirou. Vamos recomeçar rapidinho?";

// The result screen (RF-08): one address per access token, and the page to ask for a new link.
export const RESULT_PATH = "/diagnostico-estilo/resultado";
export const resultPathFor = (token: string) => `${RESULT_PATH}/${token}`;
export const EXPIRED_LINK_NOTICE = "Este link expirou ou não é válido. Peça um novo link.";
export const RESEND_NEUTRAL_MESSAGE = "Se existir um diagnóstico para este e-mail, enviaremos um novo link.";

// Privacy (RF-09): the policy (also linked by consent.ts) and the two-step deletion flow.
export { PRIVACY_PATH };
export const DELETION_PATH = `${PRIVACY_PATH}/exclusao`;
export const deletionConfirmPathFor = (token: string) => `${DELETION_PATH}/${token}`;
export const DELETION_NEUTRAL_MESSAGE = "Se existirem dados para este e-mail, enviaremos um link de confirmação.";
export const DELETION_EXPIRED_NOTICE = "Este link expirou. Faça um novo pedido de exclusão.";
