import { readAttemptId } from "@/lib/diagnostico/attempt-session";
import { hitRateLimit } from "@/lib/diagnostico/attempts";
import type { OrderStatus } from "@/lib/diagnostico/constants";
import { ConfigError } from "@/lib/diagnostico/env";
import { ApiError, apiError } from "@/lib/diagnostico/errors";
import { startGeneration as defaultStartGeneration } from "@/lib/diagnostico/generation-hook";
import { PaymentCheckError, confirmCharge } from "@/lib/diagnostico/payment-confirmation";
import { getPixGateway, type PixGateway } from "@/lib/diagnostico/pix-gateway";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";

export type PaymentCheckDeps = {
  gateway?: PixGateway;
  startGeneration?: (orderId: string, token: string) => Promise<void>;
};

const PAID_STATUSES: OrderStatus[] = ["APPROVED", "PROCESSING", "DELIVERED"];
const SESSION_EXPIRED = "Sua sessão expirou.";
const CHECK_WINDOW_SECONDS = 5;

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function json(body: unknown, status = 200): Response {
  return noStore(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

/**
 * "Já paguei" and the automatic check of the checkout screen. It runs the same verification as
 * the webhook for the latest order of the cookie's attempt.
 */
export async function handlePaymentCheck(request: Request, deps: PaymentCheckDeps = {}): Promise<Response> {
  try {
    // The attempt is identified only by the signed cookie.
    const attemptId = readAttemptId(request);
    if (!attemptId) return noStore(apiError("FORBIDDEN", SESSION_EXPIRED, 403));

    const db = getSupabaseAdmin();
    const { data: order, error } = await db
      .from("orders")
      .select("id, status, failure_reason")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`payment check failed: ${error.message}`);
    if (!order) return noStore(apiError("NOT_FOUND", "Pedido não encontrado.", 404));

    const status = order.status as OrderStatus;
    if (PAID_STATUSES.includes(status)) return json({ state: "approved", orderStatus: status });
    if (status === "FAILED" && order.failure_reason === "PIX_EXPIRED") return json({ state: "expired" });
    if (status !== "PENDING") return json({ state: "pending" });

    const { data: payment, error: paymentError } = await db
      .from("payments")
      .select("provider_charge_id")
      .eq("order_id", order.id)
      .maybeSingle();
    if (paymentError) throw new Error(`payment check failed: ${paymentError.message}`);
    // The charge is still being created.
    if (!payment) return json({ state: "pending" });

    // At most one provider call per order every 5 seconds; beyond that, the last answer stands.
    const allowed = await hitRateLimit(db, `paycheck:${order.id}`, CHECK_WINDOW_SECONDS, 1);
    if (!allowed) return json({ state: "pending" });

    const outcome = await confirmCharge(
      db,
      deps.gateway ?? getPixGateway(),
      { chargeId: payment.provider_charge_id },
      deps.startGeneration ?? defaultStartGeneration,
    );
    switch (outcome.result) {
      case "approved":
        return json({ state: "approved", orderStatus: "APPROVED" });
      case "already_approved":
        return json({ state: "approved", orderStatus: outcome.orderStatus });
      case "expired":
        return json({ state: "expired" });
      default:
        return json({ state: "pending" });
    }
  } catch (error) {
    if (error instanceof ApiError) return noStore(apiError(error.code, error.message, error.status));
    if (error instanceof PaymentCheckError) {
      return noStore(
        apiError("PAYMENT_CHECK_UNAVAILABLE", "Não conseguimos verificar agora. Tente novamente.", 502),
      );
    }
    if (error instanceof ConfigError) {
      console.error("payment check route: configuration error", error.message);
      return noStore(apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500));
    }
    console.error("payment check route: unexpected error", error instanceof Error ? error.message : "unknown");
    return noStore(apiError("INTERNAL_ERROR", "Não foi possível concluir agora. Tente novamente.", 500));
  }
}
