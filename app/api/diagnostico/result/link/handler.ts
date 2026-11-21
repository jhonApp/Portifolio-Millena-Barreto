import { readAttemptId } from "@/lib/diagnostico/attempt-session";
import { hitRateLimit } from "@/lib/diagnostico/attempts";
import type { OrderStatus } from "@/lib/diagnostico/constants";
import { ConfigError } from "@/lib/diagnostico/env";
import { ApiError, apiError } from "@/lib/diagnostico/errors";
import { resultPathFor } from "@/lib/diagnostico/paths";
import { mintResultToken } from "@/lib/diagnostico/result-token";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 5;
const SESSION_EXPIRED = "Sua sessão expirou.";
const PAID_STATUSES: OrderStatus[] = ["APPROVED", "PROCESSING", "DELIVERED"];

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * The waiting screen asks for a link to the result once the diagnosis is ready. The attempt is
 * identified only by the signed cookie; a new token is minted (the plain value of the e-mail
 * token is never kept) and the path of the result screen is returned.
 */
export async function handleResultLink(request: Request): Promise<Response> {
  try {
    const attemptId = readAttemptId(request);
    if (!attemptId) return noStore(apiError("FORBIDDEN", SESSION_EXPIRED, 403));

    const db = getSupabaseAdmin();
    const allowed = await hitRateLimit(db, `resultlink:${attemptId}`, RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX);
    if (!allowed) {
      const retryAfter = RATE_LIMIT_WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % RATE_LIMIT_WINDOW_SECONDS);
      const response = apiError("RATE_LIMITED", "Muitas tentativas. Aguarde alguns minutos e tente de novo.", 429);
      response.headers.set("Retry-After", String(retryAfter));
      return noStore(response);
    }

    const { data: orders, error } = await db
      .from("orders")
      .select("id, status, failure_reason")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`result link failed: ${error.message}`);
    const ids = (orders ?? []).map((order) => order.id);
    if (ids.length === 0) return noStore(apiError("RESULT_NOT_READY", "O diagnóstico ainda não está pronto.", 409));

    const { data: results } = await db.from("results").select("order_id").in("order_id", ids);
    const withResult = new Set((results ?? []).map((row) => row.order_id));
    // The latest paid order that has a diagnosis (a paid order whose delivery failed counts too).
    const order = (orders ?? []).find(
      (item) =>
        withResult.has(item.id) &&
        (PAID_STATUSES.includes(item.status as OrderStatus) ||
          (item.status === "FAILED" && item.failure_reason === "DELIVERY_FAILED")),
    );
    if (!order) return noStore(apiError("RESULT_NOT_READY", "O diagnóstico ainda não está pronto.", 409));

    const token = await mintResultToken(db, order.id);
    return noStore(
      new Response(JSON.stringify({ path: resultPathFor(token) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch (error) {
    if (error instanceof ApiError) return noStore(apiError(error.code, error.message, error.status));
    if (error instanceof ConfigError) {
      console.error("result link route: configuration error", error.message);
      return noStore(apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500));
    }
    console.error("result link route: unexpected error", error instanceof Error ? error.message : "unknown");
    return noStore(apiError("INTERNAL_ERROR", "Não foi possível concluir agora. Tente novamente.", 500));
  }
}
