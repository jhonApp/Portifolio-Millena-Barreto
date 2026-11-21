import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { removeDiagnosisPdfs } from "./diagnosis-storage";

type Db = SupabaseClient<Database>;

export type ErasureOutcome =
  | { result: "erased"; orderIds: string[] }
  | { result: "deferred" }
  | { result: "failed"; stage: "STORAGE" | "DATABASE" };

export type ErasureDeps = { removePdfs?: (db: Db, orderIds: string[]) => Promise<void> };

/**
 * Erases one customer (RF-09). The order is: plan (SQL), remove the stored PDFs, erase (SQL, one
 * transaction). A failure in the files leaves the database untouched and a failure in the database
 * leaves only missing files, so a retry always finishes (removing a missing file is not an error).
 * Never throws and never carries a name, an e-mail or a token in its result.
 */
export async function eraseCustomer(db: Db, customerId: string, deps: ErasureDeps = {}): Promise<ErasureOutcome> {
  const { data: planned, error: planError } = await db.rpc("erasure_plan", { p_customer: customerId });
  if (planError) return { result: "failed", stage: "DATABASE" };
  const plan = planned as unknown as { in_flight: boolean; pdf_orders: string[] };
  if (plan.in_flight) return { result: "deferred" };

  try {
    await (deps.removePdfs ?? removeDiagnosisPdfs)(db, plan.pdf_orders);
  } catch {
    return { result: "failed", stage: "STORAGE" };
  }

  const { data: erased, error: eraseError } = await db.rpc("erase_customer", { p_customer: customerId });
  if (eraseError) return { result: "failed", stage: "DATABASE" };
  const outcome = (erased as unknown as { result: "erased" | "deferred" | "not_found" }).result;
  // A payment that slipped in after the plan makes the SQL function wait: try again later.
  if (outcome === "deferred") return { result: "deferred" };
  return { result: "erased", orderIds: plan.pdf_orders };
}
