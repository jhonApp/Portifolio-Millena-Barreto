import "server-only";

/**
 * Called once, by the request that wins the approval of an order. `token` is the plain result
 * access token (only its hash is stored): it exists in memory for this call and must never be
 * logged. RF-07 replaces this default, which only records that the order is ready.
 */
export async function startGeneration(orderId: string, _token: string): Promise<void> {
  console.info("generation: order approved and ready", orderId);
}
