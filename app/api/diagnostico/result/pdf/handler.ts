import { hitRateLimit } from "@/lib/diagnostico/attempts";
import { PDF_SIGNED_URL_SECONDS } from "@/lib/diagnostico/constants";
import { createSignedPdfUrl } from "@/lib/diagnostico/diagnosis-storage";
import { ConfigError } from "@/lib/diagnostico/env";
import { ApiError, apiError } from "@/lib/diagnostico/errors";
import { findResultToken, hashToken } from "@/lib/diagnostico/result-token";
import { tokenBodySchema } from "@/lib/diagnostico/schemas/result-requests";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";
import { parseInput, readJson } from "@/lib/diagnostico/validation";

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 20;

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * "Baixar meu diagnóstico em PDF": validates the access token and creates, at that moment, a
 * signed storage URL that works for 5 minutes. Anything wrong with the token is a plain 404.
 */
export async function handleResultPdf(request: Request): Promise<Response> {
  try {
    const parsed = parseInput(tokenBodySchema, await readJson(request));
    if (!parsed.ok) {
      return noStore(
        apiError("VALIDATION_ERROR", "Dados inválidos.", 400, (parsed as { fields: Record<string, string[]> }).fields),
      );
    }
    const { token } = (parsed as { data: { token: string } }).data;
    const db = getSupabaseAdmin();

    const allowed = await hitRateLimit(db, `pdf:${hashToken(token)}`, RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX);
    if (!allowed) {
      const retryAfter = RATE_LIMIT_WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % RATE_LIMIT_WINDOW_SECONDS);
      const response = apiError("RATE_LIMITED", "Muitas tentativas. Aguarde alguns minutos e tente de novo.", 429);
      response.headers.set("Retry-After", String(retryAfter));
      return noStore(response);
    }

    const found = await findResultToken(db, token);
    const notFound = () => noStore(apiError("NOT_FOUND", "Não encontrado.", 404));
    if (!found) return notFound();

    const { data: result, error } = await db
      .from("results")
      .select("pdf_path")
      .eq("order_id", found.orderId)
      .maybeSingle();
    if (error) throw new Error(`pdf route failed: ${error.message}`);
    if (!result?.pdf_path) return notFound();

    const url = await createSignedPdfUrl(db, found.orderId, PDF_SIGNED_URL_SECONDS);
    return noStore(
      new Response(JSON.stringify({ url, expiresInSeconds: PDF_SIGNED_URL_SECONDS }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch (error) {
    if (error instanceof ApiError) return noStore(apiError(error.code, error.message, error.status));
    if (error instanceof ConfigError) {
      console.error("result pdf route: configuration error", error.message);
      return noStore(apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500));
    }
    // Never log the request body: it holds the access token.
    console.error("result pdf route: unexpected error", error instanceof Error ? error.message : "unknown");
    return noStore(apiError("INTERNAL_ERROR", "Não foi possível concluir agora. Tente novamente.", 500));
  }
}
