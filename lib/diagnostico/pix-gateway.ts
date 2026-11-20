import "server-only";
import { createAbacatePayGateway } from "./abacatepay";
import { paymentSimulationEnabled } from "./payment-simulation";
import { createSimulatedGateway } from "./pix-gateway-simulated";

export type PixCharge = {
  chargeId: string;
  /** Copy-and-paste ("Pix copia e cola") code. */
  pixCode: string;
  /** QR Code image as a data URL. */
  qrImage: string;
  /** ISO expiry returned by the provider, or null when it sent none. */
  expiresAt: string | null;
};

export interface PixGateway {
  createCharge(input: {
    orderId: string;
    amountCents: number;
    expiresInSeconds: number;
    description: string;
  }): Promise<PixCharge>;
}

export type PixGatewayErrorCode = "GATEWAY_UNAVAILABLE" | "GATEWAY_REJECTED" | "GATEWAY_BAD_RESPONSE";

export class PixGatewayError extends Error {
  code: PixGatewayErrorCode;

  constructor(code: PixGatewayErrorCode, message?: string) {
    super(message ?? code);
    this.name = "PixGatewayError";
    this.code = code;
  }
}

/** The simulated gateway exists only outside production and only when explicitly enabled. */
export function getPixGateway(): PixGateway {
  return paymentSimulationEnabled() ? createSimulatedGateway() : createAbacatePayGateway();
}
