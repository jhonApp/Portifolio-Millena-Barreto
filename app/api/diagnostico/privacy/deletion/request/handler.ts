import { createHash } from "node:crypto";
import { hitRateLimit } from "@/lib/diagnostico/attempts";
import {
  DELETION_REQUESTS_PER_EMAIL_PER_HOUR,
  DELETION_REQUESTS_PER_IP_PER_HOUR,
} from "@/lib/diagnostico/constants";
import { requestDeletion, type DeletionDeps } from "@/lib/diagnostico/deletion";
import { ConfigError } from "@/lib/diagnostico/env";
import { ApiError, apiError } from "@/lib/diagnostico/errors";
import { DELETION_NEUTRAL_MESSAGE } from "@/lib/diagnostico/paths";
import { clientIpHash } from "@/lib/diagnostico/request-ip";
import { deletionRequestBodySchema } from "@/lib/diagnostico/schemas/privacy-requests";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";
import { parseInput, readJson } from "@/lib/diagnostico/validation";

const WINDOW_SECONDS = 60 * 60;

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

// The same answer for a known e-mail, an unknown one and an over-limit one: nobody can use this
// page to find out who bought a diagnosis.
function neutral(): Response {
  return noStore(
    new Response(JSON.stringify({ message: DELETION_NEUTRAL_MESSAGE }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/**
 * "Pedir exclusão dos meus dados" (RF-09): always answers the same sentence. When customers exist
 * for the e-mail, a request with a 24-hour link is stored and the confirmation e-mail is sent.
 */
export async function handleDeletionRequest(request: Request, deps: DeletionDeps = {}): Promise<Response> {
  try {
    const parsed = parseInput(deletionRequestBodySchema, await readJson(request));
    if (!parsed.ok) {
      return noStore(
        apiError("VALIDATION_ERROR", "Dados inválidos.", 400, (parsed as { fields: Record<string, string[]> }).fields),
      );
    }
    const { email } = (parsed as { data: { email: string } }).data;
    const db = getSupabaseAdmin();

    // Both limits count every request, so neither can be probed to learn about an e-mail.
    const emailKey = `deletionreq:email:${createHash("sha256").update(email).digest("hex")}`;
    const emailAllowed = await hitRateLimit(db, emailKey, WINDOW_SECONDS, DELETION_REQUESTS_PER_EMAIL_PER_HOUR);
    const ipAllowed = await hitRateLimit(
      db,
      `deletionreq:ip:${clientIpHash(request)}`,
      WINDOW_SECONDS,
      DELETION_REQUESTS_PER_IP_PER_HOUR,
    );
    if (!emailAllowed || !ipAllowed) return neutral();

    await requestDeletion(db, email, deps);
    return neutral();
  } catch (error) {
    if (error instanceof ApiError) return noStore(apiError(error.code, error.message, error.status));
    if (error instanceof ConfigError) {
      console.error("deletion request route: configuration error", error.message);
      return noStore(apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500));
    }
    // Never log the body: it holds an e-mail address.
    console.error("deletion request route: unexpected error", error instanceof Error ? error.message : "unknown");
    return noStore(apiError("INTERNAL_ERROR", "Não foi possível concluir agora. Tente novamente.", 500));
  }
}
