import "server-only";
import { getPaymentApiEnv } from "./env";
import { PixGatewayError, type PixCharge, type PixGateway } from "./pix-gateway";

// Request and response shapes follow the public AbacatePay reference ("Criar QRCode PIX").
// They are confirmed only by the live check of RF-05 (tests/live/abacatepay-pix.live.test.ts).
const BASE_URL = "https://api.abacatepay.com/v1";
const DEFAULT_TIMEOUT_MS = 10_000;

type ChargeResponse = {
  data?: { id?: string; brCode?: string; brCodeBase64?: string; expiresAt?: string | null } | null;
  error?: unknown;
};

export function createAbacatePayGateway(
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): PixGateway {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async createCharge({ orderId, amountCents, expiresInSeconds, description }): Promise<PixCharge> {
      const { ABACATEPAY_API_KEY } = getPaymentApiEnv();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await doFetch(`${BASE_URL}/pixQrCode/create`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ABACATEPAY_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": orderId,
          },
          // No customer block: the charge is tied to our order by the external id only.
          body: JSON.stringify({
            amount: amountCents,
            expiresIn: expiresInSeconds,
            description,
            metadata: { externalId: orderId },
          }),
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
          response.status >= 500 ? "GATEWAY_UNAVAILABLE" : "GATEWAY_REJECTED",
          `AbacatePay answered ${response.status}`,
        );
      }

      let body: ChargeResponse;
      try {
        body = (await response.json()) as ChargeResponse;
      } catch {
        throw new PixGatewayError("GATEWAY_BAD_RESPONSE");
      }
      const data = body.data;
      if (!data || !data.id || !data.brCode) throw new PixGatewayError("GATEWAY_BAD_RESPONSE");

      return {
        chargeId: data.id,
        pixCode: data.brCode,
        qrImage: data.brCodeBase64 ?? "",
        expiresAt: data.expiresAt ?? null,
      };
    },
  };
}
