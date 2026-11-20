// A payment simulation may exist only outside production and only when explicitly enabled.
// In production this always returns false, whatever the variables say.
export function paymentSimulationEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ENABLE_PAYMENT_SIMULATION === "true";
}
