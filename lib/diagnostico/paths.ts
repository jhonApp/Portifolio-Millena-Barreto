// Addresses of the diagnosis flow. Safe to import in the browser and on the server.

export const REGISTRATION_PATH = "/diagnostico-estilo";
export const QUESTIONNAIRE_PATH = "/diagnostico-estilo/perguntas";
// Owned by RF-05; it returns the default 404 until that feature exists.
export const COMPLETION_PATH = "/diagnostico-estilo/concluido";
// Where the visitor goes when the attempt cookie is missing, invalid or expired.
export const EXPIRED_PATH = `${REGISTRATION_PATH}?sessao=expirada`;
export const SESSION_EXPIRED_NOTICE = "Sua sessão expirou. Vamos recomeçar rapidinho?";
