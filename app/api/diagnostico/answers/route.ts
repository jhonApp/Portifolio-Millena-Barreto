import { AnswerError, saveAnswer } from "@/lib/diagnostico/answers";
import { readAttemptId } from "@/lib/diagnostico/attempt-session";
import { ConfigError } from "@/lib/diagnostico/env";
import { ApiError, apiError } from "@/lib/diagnostico/errors";
import { QUESTIONNAIRE_UNAVAILABLE_NOTICE } from "@/lib/diagnostico/paths";
import { ANSWER_MESSAGES, answerBodySchema } from "@/lib/diagnostico/schemas/answer";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";
import { parseInput, readJson } from "@/lib/diagnostico/validation";

export const dynamic = "force-dynamic";

const SESSION_EXPIRED = "Sua sessão expirou.";

export async function PUT(request: Request): Promise<Response> {
  try {
    // The attempt is identified only by the signed cookie, never by the body.
    const attemptId = readAttemptId(request);
    if (!attemptId) return apiError("FORBIDDEN", SESSION_EXPIRED, 403);

    const parsed = parseInput(answerBodySchema, await readJson(request));
    if (!parsed.ok) {
      return apiError("VALIDATION_ERROR", "Dados inválidos.", 400, (parsed as { fields: Record<string, string[]> }).fields);
    }
    const { questionId, alternativeId, secondAlternativeId } = (
      parsed as { data: { questionId: string; alternativeId: string; secondAlternativeId?: string | null } }
    ).data;

    try {
      const answeredCount = await saveAnswer(
        getSupabaseAdmin(),
        attemptId,
        questionId,
        alternativeId,
        secondAlternativeId,
      );
      return new Response(JSON.stringify({ answeredCount }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      if (error instanceof AnswerError) {
        if (error.code === "ATTEMPT_NOT_FOUND") return apiError("FORBIDDEN", SESSION_EXPIRED, 403);
        // The customer's page is older than the published questionnaire: nothing was saved.
        if (error.code === "VERSION_CHANGED") return apiError("VERSION_CHANGED", "O questionário foi atualizado.", 409);
        if (error.code === "UNAVAILABLE") {
          console.error("answers route: no questionnaire version is published");
          return apiError("UNAVAILABLE", QUESTIONNAIRE_UNAVAILABLE_NOTICE, 503);
        }
        if (error.code === "CHOICE_NOT_ALLOWED") {
          return apiError("VALIDATION_ERROR", "Dados inválidos.", 400, {
            secondAlternativeId: [ANSWER_MESSAGES.secondAlternativeId],
          });
        }
        return apiError("VALIDATION_ERROR", "Dados inválidos.", 400, {
          alternativeId: [ANSWER_MESSAGES.alternativeId],
        });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof ApiError) return apiError(error.code, error.message, error.status);
    if (error instanceof ConfigError) {
      console.error("answers route: configuration error", error.message);
      return apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500);
    }
    // Never log the request body or the cookie.
    console.error("answers route: unexpected error", error instanceof Error ? error.message : "unknown");
    return apiError("INTERNAL_ERROR", "Não foi possível concluir agora. Tente novamente.", 500);
  }
}
