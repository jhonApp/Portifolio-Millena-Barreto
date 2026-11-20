import { attemptCookie } from "@/lib/diagnostico/attempt-session";
import { createAttempt, findAttemptByIdempotencyKey, hitRateLimit } from "@/lib/diagnostico/attempts";
import { CONSENT_TEXT, CONSENT_VERSION } from "@/lib/diagnostico/consent";
import { ConfigError } from "@/lib/diagnostico/env";
import { ApiError, apiError } from "@/lib/diagnostico/errors";
import { clientIpHash } from "@/lib/diagnostico/request-ip";
import { customerFormSchema } from "@/lib/diagnostico/schemas/customer";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";
import { parseInput, readJson } from "@/lib/diagnostico/validation";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 10;

function attemptResponse(attemptId: string, status: 200 | 201): Response {
  return new Response(JSON.stringify({ attemptId }), {
    status,
    headers: { "Content-Type": "application/json", "Set-Cookie": attemptCookie(attemptId) },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = parseInput(customerFormSchema, await readJson(request));
    if (!parsed.ok) {
      return apiError("VALIDATION_ERROR", "Dados inválidos.", 400, (parsed as { fields: Record<string, string[]> }).fields);
    }
    const data = (parsed as { data: ReturnType<typeof customerFormSchema.parse> }).data;
    const db = getSupabaseAdmin();

    // Replay of the same submission: return the original attempt, do not count against the limit.
    const existing = await findAttemptByIdempotencyKey(db, data.idempotencyKey);
    if (existing) return attemptResponse(existing, 200);

    const ipHash = clientIpHash(request);
    const allowed = await hitRateLimit(db, `attempt:${ipHash}`, RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX);
    if (!allowed) {
      const retryAfter = RATE_LIMIT_WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % RATE_LIMIT_WINDOW_SECONDS);
      const response = apiError("RATE_LIMITED", "Muitas tentativas. Aguarde alguns minutos e tente de novo.", 429);
      response.headers.set("Retry-After", String(retryAfter));
      return response;
    }

    const { attemptId, created } = await createAttempt(db, {
      fullName: data.fullName,
      email: data.email,
      whatsapp: data.whatsapp,
      deliveryPreference: data.deliveryPreference,
      ipHash,
      idempotencyKey: data.idempotencyKey,
      consentVersion: CONSENT_VERSION,
      consentText: CONSENT_TEXT,
    });
    return attemptResponse(attemptId, created ? 201 : 200);
  } catch (error) {
    if (error instanceof ApiError) return apiError(error.code, error.message, error.status);
    if (error instanceof ConfigError) {
      console.error("attempts route: configuration error", error.message);
      return apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500);
    }
    // Never log request data: it may contain personal information.
    console.error("attempts route: unexpected error", error instanceof Error ? error.message : "unknown");
    return apiError("INTERNAL_ERROR", "Não foi possível concluir agora. Tente novamente.", 500);
  }
}
