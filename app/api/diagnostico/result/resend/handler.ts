import { createHash } from "node:crypto";
import { hitRateLimit } from "@/lib/diagnostico/attempts";
import { recordAutomationError } from "@/lib/diagnostico/automation-errors";
import type { OrderStatus } from "@/lib/diagnostico/constants";
import { sendResultLinkEmail, type DeliveryDeps } from "@/lib/diagnostico/delivery";
import { ConfigError } from "@/lib/diagnostico/env";
import { ApiError, apiError } from "@/lib/diagnostico/errors";
import { RESEND_NEUTRAL_MESSAGE } from "@/lib/diagnostico/paths";
import { clientIpHash } from "@/lib/diagnostico/request-ip";
import { emailBodySchema } from "@/lib/diagnostico/schemas/result-requests";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";
import { parseInput, readJson } from "@/lib/diagnostico/validation";

const WINDOW_SECONDS = 60 * 60;
const MAX_PER_EMAIL = 3;
const MAX_PER_IP = 10;
const PAID_STATUSES: OrderStatus[] = ["APPROVED", "PROCESSING", "DELIVERED"];

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

// The same answer for a known e-mail, an unknown one and an over-limit one: nobody can use this
// page to find out who bought a diagnosis.
function neutral(): Response {
  return noStore(
    new Response(JSON.stringify({ message: RESEND_NEUTRAL_MESSAGE }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** The latest paid order with a stored diagnosis of the customers that registered this e-mail. */
async function latestDiagnosisOrder(db: ReturnType<typeof getSupabaseAdmin>, email: string): Promise<string | null> {
  const { data: customers } = await db.from("customers").select("id").eq("email", email);
  const customerIds = (customers ?? []).map((customer) => customer.id);
  if (customerIds.length === 0) return null;
  const { data: attempts } = await db.from("purchase_attempts").select("id").in("customer_id", customerIds);
  const attemptIds = (attempts ?? []).map((attempt) => attempt.id);
  if (attemptIds.length === 0) return null;
  const { data: orders } = await db
    .from("orders")
    .select("id, status, failure_reason")
    .in("attempt_id", attemptIds)
    .order("created_at", { ascending: false });
  const ids = (orders ?? []).map((order) => order.id);
  if (ids.length === 0) return null;
  const { data: results } = await db.from("results").select("order_id").in("order_id", ids);
  const withResult = new Set((results ?? []).map((row) => row.order_id));
  const order = (orders ?? []).find(
    (item) =>
      withResult.has(item.id) &&
      (PAID_STATUSES.includes(item.status as OrderStatus) ||
        (item.status === "FAILED" && item.failure_reason === "DELIVERY_FAILED")),
  );
  return order?.id ?? null;
}

/**
 * "Pedir novo link": always answers the same sentence. When the e-mail belongs to a customer with a
 * diagnosis, a new token is minted and the e-mail (link and PDF) is sent again.
 */
export async function handleResultResend(request: Request, deps: { delivery?: DeliveryDeps } = {}): Promise<Response> {
  try {
    const parsed = parseInput(emailBodySchema, await readJson(request));
    if (!parsed.ok) {
      return noStore(
        apiError("VALIDATION_ERROR", "Dados inválidos.", 400, (parsed as { fields: Record<string, string[]> }).fields),
      );
    }
    const { email } = (parsed as { data: { email: string } }).data;
    const db = getSupabaseAdmin();

    // Both limits count every request, so neither can be probed to learn about an e-mail.
    const emailKey = `resendlink:email:${createHash("sha256").update(email).digest("hex")}`;
    const emailAllowed = await hitRateLimit(db, emailKey, WINDOW_SECONDS, MAX_PER_EMAIL);
    const ipAllowed = await hitRateLimit(db, `resendlink:ip:${clientIpHash(request)}`, WINDOW_SECONDS, MAX_PER_IP);
    if (!emailAllowed || !ipAllowed) return neutral();

    const orderId = await latestDiagnosisOrder(db, email);
    if (orderId) {
      try {
        await sendResultLinkEmail(db, orderId, { deps: deps.delivery });
      } catch (error) {
        // The customer is not told; the admin sees it. Nothing personal goes into the record.
        await recordAutomationError(db, orderId, "RESEND_LINK", "The new link could not be sent.", {
          reason: error instanceof Error ? error.name : "unknown",
        });
      }
    }
    return neutral();
  } catch (error) {
    if (error instanceof ApiError) return noStore(apiError(error.code, error.message, error.status));
    if (error instanceof ConfigError) {
      console.error("result resend route: configuration error", error.message);
      return noStore(apiError("CONFIG_ERROR", "Configuração do servidor incompleta.", 500));
    }
    // Never log the body: it holds an e-mail address.
    console.error("result resend route: unexpected error", error instanceof Error ? error.message : "unknown");
    return noStore(apiError("INTERNAL_ERROR", "Não foi possível concluir agora. Tente novamente.", 500));
  }
}
