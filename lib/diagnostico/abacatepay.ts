import "server-only";
import { getPaymentApiEnv } from "./env";
import {
  PixGatewayError,
  type ChargeStatus,
  type PixCharge,
  type PixGateway,
} from "./pix-gateway";

// AbacatePay API v2 (transparent checkout). Shapes follow the public reference
// (docs.abacatepay.com) and are confirmed by the live checks of RF-05 and RF-06
// (tests/live/abacatepay-pix.live.test.ts).
const BASE_URL = "https://api.abacatepay.com/v2";
const DEFAULT_TIMEOUT_MS = 10_000;

type Envelope = {
  data?: {
    id?: string;
    status?: string;
    brCode?: string;
    brCodeBase64?: string;
    expiresAt?: string | null;
  } | null;
  error?: unknown;
  success?: boolean;
};

const KNOWN_STATUSES: ChargeStatus[] = ["PENDING", "PAID", "EXPIRED", "CANCELLED", "REFUNDED"];

export function mapChargeStatus(status: string | undefined): ChargeStatus {
  return KNOWN_STATUSES.find((known) => known === status) ?? "OTHER";
}

export function createAbacatePayGateway(
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): PixGateway {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function call(path: string, init: RequestInit): Promise<Envelope> {
    const { ABACATEPAY_API_KEY } = getPaymentApiEnv();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await doFetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${ABACATEPAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } catch {
      // Network failure or timeout. The message never includes the request (it holds the key).
      throw new PixGatewayError("GATEWAY_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new PixGatewayError(
        response.status >= 500 || response.status === 429 ? "GATEWAY_UNAVAILABLE" : "GATEWAY_REJECTED",
        `AbacatePay answered ${response.status}`,
      );
    }
    try {
      return (await response.json()) as Envelope;
    } catch {
      throw new PixGatewayError("GATEWAY_BAD_RESPONSE");
    }
  }

  return {
    async createCharge({ orderId, amountCents, expiresInSeconds, description }): Promise<PixCharge> {
      // No customer block: the charge is tied to our order by the external id only.
      // The external id is also the provider-side idempotency key.
      const body = await call("/transparents/create", {
        method: "POST",
        body: JSON.stringify({
          method: "PIX",
          data: {
            amount: amountCents,
            expiresIn: expiresInSeconds,
            description,
            externalId: orderId,
            metadata: { orderId },
          },
        }),
      });
      const data = body.data;
      if (!data || !data.id || !data.brCode) throw new PixGatewayError("GATEWAY_BAD_RESPONSE");
      return {
        chargeId: data.id,
        pixCode: data.brCode,
        qrImage: data.brCodeBase64 ?? "",
        expiresAt: data.expiresAt ?? null,
      };
    },

    async getCharge(chargeId) {
      const body = await call(`/transparents/check?id=${encodeURIComponent(chargeId)}`, { method: "GET" });
      const data = body.data;
      if (!data || !data.status) throw new PixGatewayError("GATEWAY_BAD_RESPONSE");
      return { status: mapChargeStatus(data.status), expiresAt: data.expiresAt ?? null };
    },
  };
}
