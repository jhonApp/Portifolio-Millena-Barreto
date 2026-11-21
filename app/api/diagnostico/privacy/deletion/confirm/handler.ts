import { hitRateLimit } from "@/lib/diagnostico/attempts";
import { DELETION_CONFIRMS_PER_IP_PER_HOUR } from "@/lib/diagnostico/constants";
import { confirmDeletion, type DeletionDeps } from "@/lib/diagnostico/deletion";
import { ConfigError } from "@/lib/diagnostico/env";
import { ApiError, apiError } from "@/lib/diagnostico/errors";
import { DELETION_EXPIRED_NOTICE } from "@/lib/diagnostico/paths";
import { clientIpHash } from "@/lib/diagnostico/request-ip";
import { deletionConfirmBodySchema } from "@/lib/diagnostico/schemas/privacy-requests";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";
import { parseInput, readJson } from "@/lib/diagnostico/validation";

const WINDOW_SECONDS = 60 * 60;

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Confirms a deletion request (RF-09) and erases the data: `{ state: "completed" }` when everything
 * went, `{ state: "pending" }` when an order is in flight or a step failed (the daily job finishes
 * it). An expired or unknown token gets the same 410 answer.
 */
export async function handleDeletionConfirm(request: Request, deps: DeletionDeps = {}): Promise<Response> {
  try {
    const parsed = parseInput(deletionConfirmBodySchema, await readJson(request));
    if (!parsed.ok) {
      return noStore(
        apiError("VALIDATION_ERROR", "Link inválido.", 400, (parsed as { fields: Record<string, string[]> }).fields),
      );
    }
    const { token } = (parsed as { data: { token: string } }).data;
    const db = getSupabaseAdmin();

    if (!(await hitRateLimit(db, `deletionconfirm:ip:${clientIpHash(request)}`, WINDOW_SECONDS, DELETION_CONFIRMS_PER_IP_PER_HOUR))) {
      return noStore(apiError("RATE_LIMITED", "Muitas tentativas. Tente novamente mais tarde.", 429));
    }

    const { state } = await confirmDeletion(db, token, deps);
    if (state === "expired") return noStore(apiError("LINK_EXPIRED", DELETION_EXPIRED_NOTICE, 410));
    return noStore(
      new Response(JSON.stringify({ state }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
  } catch (error) {
    if (error instanceof ApiError) return noStore(apiError(error.code, error.message, error.status));
    if (error instanceof ConfigError) {
      console.error("deletion confirm route: configuration error", error.message);
      return noStore(apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500));
    }
    // Never log the body: it holds the deletion token.
    console.error("deletion confirm route: unexpected error", error instanceof Error ? error.message : "unknown");
    return noStore(apiError("INTERNAL_ERROR", "Não foi possível concluir agora. Tente novamente.", 500));
  }
}
