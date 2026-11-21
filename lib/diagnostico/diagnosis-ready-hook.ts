import "server-only";

/**
 * Called after a diagnosis is saved and its PDF stored. `token` is the plain result access token
 * when the generation ran in the request that approved the order, and null when it ran from the
 * cron job or from a reprocess (the plain token is never stored, so the delivery feature must
 * issue a new one). RF-08 replaces this default, which only records that the diagnosis is ready.
 */
export async function onDiagnosisReady(orderId: string, _token: string | null): Promise<void> {
  console.info("diagnosis ready", orderId);
}
