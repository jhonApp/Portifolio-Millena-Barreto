import { createHash, timingSafeEqual } from "node:crypto";
import { ConfigError, getCronEnv } from "@/lib/diagnostico/env";
import { apiError } from "@/lib/diagnostico/errors";
import { runDueDeliveries, type DeliveryDeps } from "@/lib/diagnostico/delivery";
import { runDueGenerations, type GenerationDeps } from "@/lib/diagnostico/generation";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";

const BATCH_SIZE = 5;

function sameSecret(received: string, expected: string): boolean {
  const left = createHash("sha256").update(received).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

/**
 * The cron job: runs the generations that are due (retries, expired leases, approvals whose first
 * run never started) and then the e-mail deliveries that are due (RF-08). Vercel Cron sends
 * "Authorization: Bearer <CRON_SECRET>".
 */
export async function handleGenerationJob(
  request: Request,
  deps: GenerationDeps & { delivery?: DeliveryDeps } = {},
): Promise<Response> {
  try {
    const { CRON_SECRET } = getCronEnv();
    const header = request.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    if (!token || !sameSecret(token, CRON_SECRET)) {
      return apiError("UNAUTHORIZED", "Não autorizado.", 401);
    }

    const { delivery: deliveryDeps, ...generationDeps } = deps;
    const db = getSupabaseAdmin();
    const outcomes = await runDueGenerations(db, { limit: BATCH_SIZE, deps: generationDeps });
    const deliveries = await runDueDeliveries(db, { limit: BATCH_SIZE, deps: deliveryDeps });
    const count = (...results: string[]) => outcomes.filter((outcome) => results.includes(outcome.result)).length;
    const sent = (...results: string[]) => deliveries.filter((outcome) => results.includes(outcome.result)).length;
    return new Response(
      JSON.stringify({
        processed: outcomes.length,
        succeeded: count("generated", "already_generated"),
        retrying: count("retry_scheduled"),
        failed: count("failed"),
        deliveries: {
          processed: deliveries.length,
          sent: sent("sent", "already_sent"),
          retrying: sent("retry_scheduled"),
          failed: sent("failed"),
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error("generation job: configuration error", error.message);
      return apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500);
    }
    console.error("generation job: unexpected error", error instanceof Error ? error.message : "unknown");
    return apiError("INTERNAL_ERROR", "Não foi possível concluir agora.", 500);
  }
}
