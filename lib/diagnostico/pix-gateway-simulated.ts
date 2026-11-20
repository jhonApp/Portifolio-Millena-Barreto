import "server-only";
import { randomUUID } from "node:crypto";
import { PixGatewayError, type PixCharge, type PixGateway } from "./pix-gateway";

// A 1x1 transparent PNG: stands in for the QR image. Never approves a payment by itself.
const PLACEHOLDER_QR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/**
 * Used only outside production when ENABLE_PAYMENT_SIMULATION=true (see getPixGateway).
 * - PAYMENT_SIMULATION_FAIL=true makes charge creation fail.
 * - PAYMENT_SIMULATION_PAID_AFTER_SECONDS=N makes a charge read as PAID N seconds after it was
 *   created (the creation time is part of the charge id, so no state is kept). Without it a
 *   simulated charge is never paid.
 * - PAYMENT_SIMULATION_CHECK_FAIL=true makes the status query fail.
 */
export function createSimulatedGateway(): PixGateway {
  return {
    async createCharge({ orderId, expiresInSeconds }): Promise<PixCharge> {
      if (process.env.PAYMENT_SIMULATION_FAIL === "true") {
        throw new PixGatewayError("GATEWAY_UNAVAILABLE", "simulated failure");
      }
      const createdAt = Math.floor(Date.now() / 1000);
      const chargeId = `sim_${createdAt}_${randomUUID()}`;
      return {
        chargeId,
        pixCode: `00020126SIMULADO${orderId.replace(/-/g, "")}${chargeId.slice(-8)}`,
        qrImage: PLACEHOLDER_QR,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      };
    },

    async getCharge(chargeId) {
      if (process.env.PAYMENT_SIMULATION_CHECK_FAIL === "true") {
        throw new PixGatewayError("GATEWAY_UNAVAILABLE", "simulated failure");
      }
      const paidAfter = Number(process.env.PAYMENT_SIMULATION_PAID_AFTER_SECONDS);
      const createdAt = Number(chargeId.split("_")[1]);
      const paid =
        process.env.PAYMENT_SIMULATION_PAID_AFTER_SECONDS !== undefined &&
        process.env.PAYMENT_SIMULATION_PAID_AFTER_SECONDS !== "" &&
        Number.isFinite(paidAfter) &&
        Number.isFinite(createdAt) &&
        Date.now() / 1000 - createdAt >= paidAfter;
      return { status: paid ? "PAID" : "PENDING", expiresAt: null };
    },
  };
}
