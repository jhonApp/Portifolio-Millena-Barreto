import { readAttemptId } from "@/lib/diagnostico/attempt-session";
import { hitRateLimit } from "@/lib/diagnostico/attempts";
import { CheckoutError, ensureCheckout } from "@/lib/diagnostico/checkout";
import { PRICE_CENTS } from "@/lib/diagnostico/constants";
import { ConfigError } from "@/lib/diagnostico/env";
import { ApiError, apiError } from "@/lib/diagnostico/errors";
import { getPixGateway } from "@/lib/diagnostico/pix-gateway";
import { checkoutBodySchema } from "@/lib/diagnostico/schemas/checkout";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";
import { parseInput, readOptionalJson } from "@/lib/diagnostico/validation";

// Shared by POST /api/diagnostico/checkout and POST /api/diagnostico/checkout/renew.

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 30;
const SESSION_EXPIRED = "Sua sessão expirou.";
const PIX_UNAVAILABLE = "Não conseguimos gerar o Pix agora. Tente novamente em instantes.";

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function json(body: unknown, status: number): Response {
  return noStore(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

export async function handleCheckout(request: Request, renew: boolean): Promise<Response> {
  try {
    // The attempt is identified only by the signed cookie, never by the body.
    const attemptId = readAttemptId(request);
    if (!attemptId) return noStore(apiError("FORBIDDEN", SESSION_EXPIRED, 403));

    const parsed = parseInput(checkoutBodySchema, await readOptionalJson(request));
    if (!parsed.ok) {
      return noStore(
        apiError("VALIDATION_ERROR", "Dados inválidos.", 400, (parsed as { fields: Record<string, string[]> }).fields),
      );
    }
    const sentAmount = (parsed as { data: { amountCents?: number } }).data.amountCents;
    if (sentAmount !== undefined && sentAmount !== PRICE_CENTS) {
      // The amount is fixed on the server; the browser value is ignored. Nothing personal is logged.
      console.warn("checkout: ignored an amount sent by the browser");
    }

    const db = getSupabaseAdmin();
    const allowed = await hitRateLimit(db, `checkout:${attemptId}`, RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX);
    if (!allowed) {
      const retryAfter = RATE_LIMIT_WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % RATE_LIMIT_WINDOW_SECONDS);
      const response = apiError("RATE_LIMITED", "Muitas tentativas. Aguarde alguns minutos e tente de novo.", 429);
      response.headers.set("Retry-After", String(retryAfter));
      return noStore(response);
    }

    const result = await ensureCheckout(db, getPixGateway(), attemptId, { renew });
    if (result.state === "pending") {
      const { created, ...body } = result;
      return json(body, created ? 201 : 200);
    }
    return json(result, 200);
  } catch (error) {
    if (error instanceof ApiError) return noStore(apiError(error.code, error.message, error.status));
    if (error instanceof CheckoutError) {
      switch (error.code) {
        case "ATTEMPT_NOT_FOUND":
          return noStore(apiError("FORBIDDEN", SESSION_EXPIRED, 403));
        case "ANSWERS_INCOMPLETE":
          return noStore(apiError("ANSWERS_INCOMPLETE", "Faltam algumas respostas para concluir.", 409));
        case "CHECKOUT_IN_PROGRESS": {
          const response = apiError("CHECKOUT_IN_PROGRESS", "Estamos gerando seu Pix. Aguarde um instante.", 409);
          response.headers.set("Retry-After", "2");
          return noStore(response);
        }
        case "PIX_UNAVAILABLE":
          return noStore(apiError("PIX_UNAVAILABLE", PIX_UNAVAILABLE, 502));
      }
    }
    if (error instanceof ConfigError) {
      console.error("checkout route: configuration error", error.message);
      return noStore(apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500));
    }
    // Never log the request body, the cookie or the key.
    console.error("checkout route: unexpected error", error instanceof Error ? error.message : "unknown");
    return noStore(apiError("INTERNAL_ERROR", "Não foi possível concluir agora. Tente novamente.", 500));
  }
}
