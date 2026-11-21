import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createAbacatePayGateway } from "@/lib/diagnostico/abacatepay";

// LIVE CHECKS L1 and L2 (RF-05, RF-06). They call the real AbacatePay API (v2).
// - Never part of the default runs: they live outside tests/unit and tests/integration.
// - Use a DEVELOPMENT-mode key in ABACATEPAY_API_KEY (environment or .env.local). Never a production key.
// - They run only when RUN_LIVE_ABACATEPAY=true and only with the owner's approval for that run.
// - The key is read from the environment and is never printed.
// - L2 needs the owner to simulate the payment in the AbacatePay development dashboard:
//   set RUN_LIVE_ABACATEPAY_PAID=true and wait for the charge id printed by the test.
//   npm run test:live

const enabled = process.env.RUN_LIVE_ABACATEPAY === "true";
const paidEnabled = enabled && process.env.RUN_LIVE_ABACATEPAY_PAID === "true";

const INPUT = () => ({
  orderId: randomUUID(),
  amountCents: 990,
  expiresInSeconds: 1800,
  description: "Diagnostico de Estilo Pessoal - Millena Barreto",
});

describe.skipIf(!enabled)("AbacatePay live check L1", () => {
  it("creates a dev-mode v2 Pix charge and reads it back as PENDING", async () => {
    const gateway = createAbacatePayGateway();
    const startedAt = Date.now();
    const charge = await gateway.createCharge(INPUT());

    expect(charge.chargeId).toBeTruthy();
    expect(charge.pixCode.length).toBeGreaterThan(20);
    expect(charge.qrImage.length).toBeGreaterThan(0);
    expect(charge.expiresAt).toBeTruthy();

    // About 30 minutes after the call: confirms the unit of expiresIn (seconds).
    const minutes = (new Date(charge.expiresAt!).getTime() - startedAt) / 60_000;
    expect(minutes).toBeGreaterThan(28);
    expect(minutes).toBeLessThan(32);

    const status = await gateway.getCharge(charge.chargeId);
    expect(status.status).toBe("PENDING");

    // Evidence for the status report: field names, the status and the expiry offset only, never the key.
    console.log(
      JSON.stringify({
        fields: Object.keys(charge),
        status: status.status,
        expiryMinutes: Math.round(minutes * 10) / 10,
        qrImageIsDataUrl: charge.qrImage.startsWith("data:image"),
      }),
    );
  });
});

describe.skipIf(!paidEnabled)("AbacatePay live check L2", () => {
  it("a dev-mode charge reads PAID after the owner simulates the payment", async () => {
    const gateway = createAbacatePayGateway();
    const charge = await gateway.createCharge(INPUT());
    console.log(JSON.stringify({ chargeIdPrefix: charge.chargeId.slice(0, 12), action: "simulate the payment in the AbacatePay dev dashboard now" }));

    // Poll for up to 5 minutes while the owner simulates the payment.
    let status = "PENDING";
    const deadline = Date.now() + 5 * 60_000;
    while (Date.now() < deadline && status !== "PAID") {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      status = (await gateway.getCharge(charge.chargeId)).status;
    }
    expect(status).toBe("PAID");
  }, 6 * 60_000);
});
