import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type Db = SupabaseClient<Database>;

export const DIAGNOSIS_BUCKET = "diagnostics";

/** The stored file of an order: one PDF per order identifier. */
export function diagnosisPdfPath(orderId: string): string {
  return `${orderId}.pdf`;
}

/** Uploads (or replaces) the PDF of an order in the private bucket. Returns the stored path. */
export async function uploadDiagnosisPdf(db: Db, orderId: string, bytes: Uint8Array): Promise<string> {
  const path = diagnosisPdfPath(orderId);
  const { error } = await db.storage
    .from(DIAGNOSIS_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`uploadDiagnosisPdf failed: ${error.message}`);
  return path;
}

/** Downloads the stored PDF (used by tests and by the delivery features). */
export async function downloadDiagnosisPdf(db: Db, orderId: string): Promise<Uint8Array | null> {
  const { data, error } = await db.storage.from(DIAGNOSIS_BUCKET).download(diagnosisPdfPath(orderId));
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
