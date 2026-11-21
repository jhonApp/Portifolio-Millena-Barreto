import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "./constants";
import type { Database } from "./database.types";

type Db = SupabaseClient<Database>;

const PAID_STATUSES: OrderStatus[] = ["APPROVED", "PROCESSING", "DELIVERED"];

export class OrderNotApprovedError extends Error {
  orderId: string;
  status: OrderStatus | null;

  constructor(orderId: string, status: OrderStatus | null) {
    super("ORDER_NOT_APPROVED");
    this.name = "OrderNotApprovedError";
    this.orderId = orderId;
    this.status = status;
  }
}

/**
 * Hard guard: results, PDFs and e-mails may only be created for a paid order. The database
 * trigger `require_paid_order` enforces the same rule on `results` and `deliveries`.
 */
export async function assertOrderApproved(db: Db, orderId: string): Promise<void> {
  const { data, error } = await db.from("orders").select("status").eq("id", orderId).maybeSingle();
  if (error) throw new Error(`assertOrderApproved failed: ${error.message}`);
  const status = (data?.status ?? null) as OrderStatus | null;
  if (!status || !PAID_STATUSES.includes(status)) throw new OrderNotApprovedError(orderId, status);
}
