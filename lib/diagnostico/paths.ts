// Addresses of the diagnosis flow. Safe to import in the browser and on the server.

export const REGISTRATION_PATH = "/diagnostico-estilo";
export const QUESTIONNAIRE_PATH = "/diagnostico-estilo/perguntas";
export const COMPLETION_PATH = "/diagnostico-estilo/concluido";
export const CHECKOUT_PATH = "/diagnostico-estilo/checkout";
// Where an attempt with fewer than 15 answers is sent back to (RF-05).
export const INCOMPLETE_PATH = `${QUESTIONNAIRE_PATH}?aviso=incompleto`;
export const INCOMPLETE_NOTICE = "Faltam algumas respostas para concluir.";
// Where the visitor goes when the attempt cookie is missing, invalid or expired.
export const EXPIRED_PATH = `${REGISTRATION_PATH}?sessao=expirada`;
export const SESSION_EXPIRED_NOTICE = "Sua sessão expirou. Vamos recomeçar rapidinho?";

// The result screen (RF-08): one address per access token, and the page to ask for a new link.
export const RESULT_PATH = "/diagnostico-estilo/resultado";
export const resultPathFor = (token: string) => `${RESULT_PATH}/${token}`;
export const EXPIRED_LINK_NOTICE = "Este link expirou ou não é válido. Peça um novo link.";
export const RESEND_NEUTRAL_MESSAGE = "Se existir um diagnóstico para este e-mail, enviaremos um novo link.";
