import "server-only";
import { randomUUID } from "node:crypto";
import { PixGatewayError, type PixCharge, type PixGateway } from "./pix-gateway";

// A 1x1 transparent PNG: stands in for the QR image. Never approves a payment.
const PLACEHOLDER_QR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** Used only outside production when ENABLE_PAYMENT_SIMULATION=true (see getPixGateway). */
export function createSimulatedGateway(): PixGateway {
  return {
    async createCharge({ orderId, expiresInSeconds }): Promise<PixCharge> {
      if (process.env.PAYMENT_SIMULATION_FAIL === "true") {
        throw new PixGatewayError("GATEWAY_UNAVAILABLE", "simulated failure");
      }
      const chargeId = `sim_${randomUUID()}`;
      return {
        chargeId,
        pixCode: `00020126SIMULADO${orderId.replace(/-/g, "")}${chargeId.slice(4, 12)}`,
        qrImage: PLACEHOLDER_QR,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      };
    },
  };
}
