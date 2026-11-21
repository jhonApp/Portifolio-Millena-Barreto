import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { PRICE_CENTS, type OrderStatus } from "./constants";
import type { Database } from "./database.types";
import { startGeneration as defaultStartGeneration } from "./generation-hook";
import { recordAutomationError } from "./automation-errors";
import { PixGatewayError, type PixGateway } from "./pix-gateway";

export { recordAutomationError };

type Db = SupabaseClient<Database>;

export type ConfirmResult =
  | { result: "approved"; orderId: string; late: boolean }
  | { result: "already_approved"; orderId: string; orderStatus: OrderStatus }
  | { result: "pending" }
  | { result: "expired" }
  | { result: "unknown_charge" }
  | { result: "amount_mismatch" }
  | { result: "duplicate_payment"; orderId: string };

/** The provider status query failed: the caller must ask the provider to try again later. */
export class PaymentCheckError extends Error {
  constructor() {
    super("PAYMENT_CHECK_UNAVAILABLE");
    this.name = "PaymentCheckError";
  }
}

const PAID_STATUSES: OrderStatus[] = ["APPROVED", "PROCESSING", "DELIVERED"];

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The verification shared by the webhook and the "Já paguei" route. It trusts nothing it was
 * told: it matches the charge to an order, asks the provider for the charge status, checks the
 * amount and only then approves, atomically and once. Only the call that wins the approval
 * creates the token and starts the generation.
 */
export async function confirmCharge(
  db: Db,
  gateway: PixGateway,
  input: { chargeId: string; eventAmountCents?: number },
  startGeneration: (orderId: string, token: string) => Promise<void> = defaultStartGeneration,
): Promise<ConfirmResult> {
  const { data: payment, error: paymentError } = await db
    .from("payments")
    .select("id, order_id, amount_cents")
    .eq("provider_charge_id", input.chargeId)
    .maybeSingle();
  if (paymentError) throw new Error(`confirmCharge failed: ${paymentError.message}`);
  if (!payment) {
    await recordAutomationError(db, null, "WEBHOOK_UNKNOWN_CHARGE", "A paid charge matches no order.", {
      chargeId: input.chargeId,
    });
    return { result: "unknown_charge" };
  }

  if (
    payment.amount_cents !== PRICE_CENTS ||
    (input.eventAmountCents !== undefined && input.eventAmountCents !== PRICE_CENTS)
  ) {
    await recordAutomationError(db, payment.order_id, "WEBHOOK_AMOUNT_MISMATCH", "The paid amount is not 990 cents.", {
      chargeId: input.chargeId,
    });
    return { result: "amount_mismatch" };
  }

  const { data: order, error: orderError } = await db
    .from("orders")
    .select("id, status")
    .eq("id", payment.order_id)
    .single();
  if (orderError) throw new Error(`confirmCharge failed: ${orderError.message}`);
  if (PAID_STATUSES.includes(order.status as OrderStatus)) {
    return { result: "already_approved", orderId: order.id, orderStatus: order.status as OrderStatus };
  }

  let charge;
  try {
    charge = await gateway.getCharge(input.chargeId);
  } catch (error) {
    if (error instanceof PixGatewayError) {
      console.error("payment check: provider failure", error.code);
      throw new PaymentCheckError();
    }
    throw error;
  }
  if (charge.status !== "PAID") {
    return { result: charge.status === "EXPIRED" || charge.status === "CANCELLED" ? "expired" : "pending" };
  }

  // Only the hash of the token is stored; the plain value goes to the generation hook.
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await db.rpc("approve_order", {
    p_charge_id: input.chargeId,
    p_token_hash: hashToken(token),
  });
  if (error) throw new Error(`approve_order failed: ${error.message}`);
  const outcome = data as unknown as {
    result: string;
    order_id?: string;
    late?: boolean;
    order_status?: OrderStatus;
  };

  switch (outcome.result) {
    case "approved": {
      const orderId = outcome.order_id!;
      if (outcome.late) {
        await recordAutomationError(db, orderId, "LATE_PAYMENT_APPROVED", "A payment arrived after the Pix expired and the order was approved.", {
          chargeId: input.chargeId,
        });
      }
      try {
        await startGeneration(orderId, token);
      } catch (hookError) {
        // The order stays APPROVED; RF-10 can reprocess it.
        await recordAutomationError(db, orderId, "START_GENERATION", "Starting the generation failed.", {
          reason: hookError instanceof Error ? hookError.message : "unknown",
        });
      }
      return { result: "approved", orderId, late: Boolean(outcome.late) };
    }
    case "already_approved":
      return { result: "already_approved", orderId: outcome.order_id!, orderStatus: outcome.order_status! };
    case "duplicate_payment":
      await recordAutomationError(db, outcome.order_id!, "DUPLICATE_PAYMENT", "A second order of the same attempt was paid.", {
        chargeId: input.chargeId,
      });
      return { result: "duplicate_payment", orderId: outcome.order_id! };
    case "unknown_charge":
      return { result: "unknown_charge" };
    default:
      await recordAutomationError(db, outcome.order_id ?? null, "NOT_APPROVABLE", "A paid charge belongs to an order that cannot be approved.", {
        chargeId: input.chargeId,
      });
      return { result: "pending" };
  }
}
