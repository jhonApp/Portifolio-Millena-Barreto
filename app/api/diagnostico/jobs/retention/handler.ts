import { isAuthorizedCron } from "@/lib/diagnostico/cron-auth";
import type { DeletionDeps } from "@/lib/diagnostico/deletion";
import { ConfigError } from "@/lib/diagnostico/env";
import { apiError } from "@/lib/diagnostico/errors";
import { runRetention } from "@/lib/diagnostico/retention";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";

/**
 * The daily retention job (RF-09): pending deletions, unpaid attempts older than 7 days, paid data
 * older than 12 months. Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". The answer holds
 * counts only: never an identifier or a personal field.
 */
export async function handleRetentionJob(request: Request, deps: { deletion?: DeletionDeps; now?: Date } = {}): Promise<Response> {
  try {
    if (!isAuthorizedCron(request)) return apiError("UNAUTHORIZED", "Não autorizado.", 401);
    const report = await runRetention(getSupabaseAdmin(), { deps: deps.deletion, now: deps.now });
    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error("retention job: configuration error", error.message);
      return apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500);
    }
    console.error("retention job: unexpected error", error instanceof Error ? error.message : "unknown");
    return apiError("INTERNAL_ERROR", "Não foi possível concluir agora.", 500);
  }
}
