import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveAttemptId, getAnswerProgress } from "./answers";
import { PIX_VALIDITY_SECONDS } from "./checkout-state";
import { PRICE_CENTS, type OrderStatus } from "./constants";
import type { Database } from "./database.types";
import { EXPIRED_PATH, INCOMPLETE_PATH } from "./paths";
import { PixGatewayError, type PixGateway } from "./pix-gateway";

type Db = SupabaseClient<Database>;
type CookieStore = { get(name: string): { value: string } | undefined };

export const CHECKOUT_DESCRIPTION = "Diagnóstico de Estilo Pessoal — Millena Barreto";

export type CheckoutAccess = { ok: true; attemptId: string } | { ok: false; redirectTo: string };

/** The completion and checkout pages need an active attempt with every question answered. */
export async function resolveCheckoutAccess(db: Db, store: CookieStore): Promise<CheckoutAccess> {
  const attemptId = await getActiveAttemptId(db, store);
  if (!attemptId) return { ok: false, redirectTo: EXPIRED_PATH };
  const progress = await getAnswerProgress(db, attemptId);
  if (progress.answeredCount === 0 || progress.firstUnansweredPosition !== null) {
    return { ok: false, redirectTo: INCOMPLETE_PATH };
  }
  return { ok: true, attemptId };
}

export type CheckoutResult =
  | {
      state: "pending";
      created: boolean;
      orderId: string;
      amountCents: number;
      expiresAt: string;
      pixCode: string;
      qrImage: string;
    }
  | { state: "expired" }
  | { state: "paid"; orderStatus: OrderStatus };

export type CheckoutErrorCode =
  | "ATTEMPT_NOT_FOUND"
  | "ANSWERS_INCOMPLETE"
  | "CHECKOUT_IN_PROGRESS"
  | "PIX_UNAVAILABLE";

export class CheckoutError extends Error {
  code: CheckoutErrorCode;

  constructor(code: CheckoutErrorCode) {
    super(code);
    this.name = "CheckoutError";
    this.code = code;
  }
}

type Decision = {
  state: "existing" | "created" | "expired" | "paid" | "in_progress";
  order_id?: string;
  order_status?: OrderStatus;
  payment?: { amount_cents: number; pix_br_code: string; pix_qr_image: string; expires_at: string };
};

const DECISION_ERRORS: CheckoutErrorCode[] = ["ATTEMPT_NOT_FOUND", "ANSWERS_INCOMPLETE"];

async function abortOrder(db: Db, orderId: string): Promise<void> {
  const { error } = await db.rpc("abort_checkout", { p_order: orderId });
  if (error) console.error("checkout: could not remove an order without a charge", orderId);
}

/**
 * Returns the Pix of the attempt: the existing valid one or, when allowed, a new order with a new
 * charge. Without `renew`, an expired Pix is reported but never replaced.
 */
export async function ensureCheckout(
  db: Db,
  gateway: PixGateway,
  attemptId: string,
  options: { renew: boolean },
): Promise<CheckoutResult> {
  const { data, error } = await db.rpc("begin_checkout", {
    p_attempt: attemptId,
    p_amount: PRICE_CENTS,
    p_renew: options.renew,
  });
  if (error) {
    const code = DECISION_ERRORS.find((candidate) => error.message.includes(candidate));
    if (code) throw new CheckoutError(code);
    throw new Error(`begin_checkout failed: ${error.message}`);
  }
  const decision = data as unknown as Decision;

  switch (decision.state) {
    case "paid":
      return { state: "paid", orderStatus: decision.order_status as OrderStatus };
    case "expired":
      return { state: "expired" };
    case "in_progress":
      throw new CheckoutError("CHECKOUT_IN_PROGRESS");
    case "existing": {
      const payment = decision.payment!;
      return {
        state: "pending",
        created: false,
        orderId: decision.order_id!,
        amountCents: payment.amount_cents,
        expiresAt: new Date(payment.expires_at).toISOString(),
        pixCode: payment.pix_br_code,
        qrImage: payment.pix_qr_image,
      };
    }
    case "created":
      return createCharge(db, gateway, decision.order_id!);
    default:
      throw new Error("begin_checkout returned an unknown state");
  }
}

async function createCharge(db: Db, gateway: PixGateway, orderId: string): Promise<CheckoutResult> {
  let charge;
  try {
    charge = await gateway.createCharge({
      orderId,
      amountCents: PRICE_CENTS,
      expiresInSeconds: PIX_VALIDITY_SECONDS,
      description: CHECKOUT_DESCRIPTION,
    });
  } catch (error) {
    await abortOrder(db, orderId);
    if (error instanceof PixGatewayError) {
      console.error("checkout: gateway failure", error.code);
      throw new CheckoutError("PIX_UNAVAILABLE");
    }
    throw error;
  }

  const expiresAt = charge.expiresAt ?? new Date(Date.now() + PIX_VALIDITY_SECONDS * 1000).toISOString();
  let attachError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await db.rpc("attach_charge", {
      p_order: orderId,
      p_charge_id: charge.chargeId,
      p_br_code: charge.pixCode,
      p_qr_image: charge.qrImage,
      p_expires_at: expiresAt,
    });
    if (!error) {
      attachError = null;
      break;
    }
    attachError = error.message;
  }
  if (attachError) {
    // The charge exists at the provider but could not be stored: keep the ids to trace it.
    console.error("checkout: charge created but not stored", { orderId, chargeId: charge.chargeId });
    await abortOrder(db, orderId);
    throw new CheckoutError("PIX_UNAVAILABLE");
  }

  return {
    state: "pending",
    created: true,
    orderId,
    amountCents: PRICE_CENTS,
    expiresAt: new Date(expiresAt).toISOString(),
    pixCode: charge.pixCode,
    qrImage: charge.qrImage,
  };
}
