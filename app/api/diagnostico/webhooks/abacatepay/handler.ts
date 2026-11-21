import { ConfigError } from "@/lib/diagnostico/env";
import { ApiError, apiError } from "@/lib/diagnostico/errors";
import { startGeneration as defaultStartGeneration } from "@/lib/diagnostico/generation-hook";
import { PaymentCheckError, confirmCharge } from "@/lib/diagnostico/payment-confirmation";
import { getPixGateway, type PixGateway } from "@/lib/diagnostico/pix-gateway";
import { webhookEventSchema } from "@/lib/diagnostico/schemas/webhook";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";
import { DEFAULT_MAX_BODY_BYTES } from "@/lib/diagnostico/validation";
import { markWebhookProcessed, recordWebhookEvent } from "@/lib/diagnostico/webhook-event";
import { verifyWebhookRequest } from "@/lib/diagnostico/webhook-auth";

export type WebhookDeps = {
  gateway?: PixGateway;
  startGeneration?: (orderId: string, token: string) => Promise<void>;
};

const PAID_EVENT = "transparent.completed";

function ok(result: string): Response {
  return new Response(JSON.stringify({ received: true, result }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * AbacatePay paid-Pix notification. The payload alone is never trusted: the charge is matched to
 * an order, asked for at the provider, checked for the amount and only then approved.
 * 2xx = done (never retried), 401 = not authentic (not retried), 5xx = try again later.
 */
export async function handleWebhook(request: Request, deps: WebhookDeps = {}): Promise<Response> {
  try {
    // The signature covers the raw body, so it is read as text before any parsing.
    const rawBody = await request.text();
    const authentic = verifyWebhookRequest({
      rawBody,
      secretHeader: request.headers.get("x-webhook-secret"),
      secretQuery: new URL(request.url).searchParams.get("webhookSecret"),
      signature: request.headers.get("x-webhook-signature"),
    });
    if (!authentic) {
      // Nothing from the request is logged: it is not authentic.
      console.warn("webhook: rejected a request without valid authentication");
      return apiError("UNAUTHORIZED", "Não autorizado.", 401);
    }

    if (new TextEncoder().encode(rawBody).length > DEFAULT_MAX_BODY_BYTES) {
      throw new ApiError("PAYLOAD_TOO_LARGE", "Corpo da requisição grande demais.", 413);
    }
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new ApiError("INVALID_JSON", "JSON inválido.", 400);
    }

    const parsed = webhookEventSchema.safeParse(json);
    if (!parsed.success) return ok("ignored");
    const event = parsed.data;
    const transparent = event.data?.transparent;
    if (event.event !== PAID_EVENT || !transparent || transparent.status !== "PAID") return ok("ignored");
    // A development-mode event never reaches a production order.
    if (event.devMode === true && process.env.NODE_ENV === "production") return ok("ignored");

    const db = getSupabaseAdmin();
    const recorded = await recordWebhookEvent(db, { id: event.id, type: event.event, payload: json });
    if (recorded === "duplicate_processed") return ok("duplicate_event");

    const outcome = await confirmCharge(
      db,
      deps.gateway ?? getPixGateway(),
      // The event amount is mandatory: a missing one counts as a mismatch.
      { chargeId: transparent.id, eventAmountCents: transparent.amount ?? -1 },
      deps.startGeneration ?? defaultStartGeneration,
    );

    // The provider told us "paid" but still reads the charge as pending: ask for a retry.
    if (outcome.result === "pending") {
      return apiError("PAYMENT_CHECK_UNAVAILABLE", "Pagamento ainda não confirmado.", 503);
    }

    await markWebhookProcessed(db, event.id);
    return ok(outcome.result === "expired" ? "ignored" : outcome.result);
  } catch (error) {
    if (error instanceof ApiError) return apiError(error.code, error.message, error.status);
    // The provider could not be asked: the event stays unprocessed and AbacatePay retries.
    if (error instanceof PaymentCheckError) {
      return apiError("PAYMENT_CHECK_UNAVAILABLE", "Não conseguimos verificar agora.", 503);
    }
    if (error instanceof ConfigError) {
      console.error("webhook route: configuration error", error.message);
      return apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500);
    }
    // Never log the body, the headers or any key.
    console.error("webhook route: unexpected error", error instanceof Error ? error.message : "unknown");
    return apiError("INTERNAL_ERROR", "Não foi possível concluir agora.", 500);
  }
}
