import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "./constants";
import type { Database } from "./database.types";
import { findResultToken } from "./result-token";
import { diagnosisContentSchema, type DiagnosisContent } from "./schemas/diagnosis-content";

type Db = SupabaseClient<Database>;

export type ResultPageState =
  | { state: "invalid" }
  | { state: "unpaid" }
  | { state: "preparing"; orderId: string }
  | { state: "ready"; orderId: string; content: DiagnosisContent; hasPdf: boolean };

const PAID_STATUSES: OrderStatus[] = ["APPROVED", "PROCESSING", "DELIVERED"];

/**
 * What the result screen shows for an access token. An unknown, expired or revoked token reveals
 * nothing about any order. The result is shown only for a paid order whose diagnosis exists, even
 * when its e-mail delivery failed (the customer can always read the result on screen).
 */
export async function loadResultByToken(db: Db, token: string): Promise<ResultPageState> {
  const found = await findResultToken(db, token);
  if (!found) return { state: "invalid" };

  const { data: order, error } = await db
    .from("orders")
    .select("status, failure_reason")
    .eq("id", found.orderId)
    .maybeSingle();
  if (error) throw new Error(`loadResultByToken failed: ${error.message}`);
  if (!order) return { state: "invalid" };

  let paid = PAID_STATUSES.includes(order.status as OrderStatus);
  if (!paid && order.status === "FAILED") {
    // A paid order may have failed afterwards (delivery or generation): the payment tells.
    const { count } = await db
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("order_id", found.orderId)
      .eq("status", "PAID");
    paid = (count ?? 0) > 0;
  }
  if (!paid) return { state: "unpaid" };

  const { data: result, error: resultError } = await db
    .from("results")
    .select("content, pdf_path")
    .eq("order_id", found.orderId)
    .maybeSingle();
  if (resultError) throw new Error(`loadResultByToken failed: ${resultError.message}`);
  if (!result) return { state: "preparing", orderId: found.orderId };

  const content = diagnosisContentSchema.safeParse(result.content);
  if (!content.success) return { state: "preparing", orderId: found.orderId };
  return { state: "ready", orderId: found.orderId, content: content.data, hasPdf: Boolean(result.pdf_path) };
}
