import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createAbacatePayGateway } from "@/lib/diagnostico/abacatepay";

// LIVE CHECK L1 (RF-05). Calls the real AbacatePay API once.
// - Never part of the default runs: it lives outside tests/unit and tests/integration.
// - Use a DEVELOPMENT-mode key in ABACATEPAY_API_KEY (environment or .env.local). Never a production key.
// - It runs only when RUN_LIVE_ABACATEPAY=true and only with the owner's approval for that run.
// - The key is read from the environment and is never printed.
//   npm run test:live   (with RUN_LIVE_ABACATEPAY=true)

const enabled = process.env.RUN_LIVE_ABACATEPAY === "true";

describe.skipIf(!enabled)("AbacatePay live check", () => {
  it("creates a dev-mode Pix charge of 990 cents with only an external id", async () => {
    const startedAt = Date.now();
    const charge = await createAbacatePayGateway().createCharge({
      orderId: randomUUID(),
      amountCents: 990,
      expiresInSeconds: 1800,
      description: "Diagnóstico de Estilo Pessoal — Millena Barreto",
    });

    expect(charge.chargeId).toBeTruthy();
    expect(charge.pixCode.length).toBeGreaterThan(20);
    expect(charge.qrImage.length).toBeGreaterThan(0);
    expect(charge.expiresAt).toBeTruthy();

    // About 30 minutes after the call: confirms the unit of expiresIn (seconds).
    const minutes = (new Date(charge.expiresAt!).getTime() - startedAt) / 60_000;
    expect(minutes).toBeGreaterThan(28);
    expect(minutes).toBeLessThan(32);

    // Evidence for the status report: field names and the expiry offset only, never the key.
    console.log(
      JSON.stringify({
        fields: Object.keys(charge),
        expiryMinutes: Math.round(minutes * 10) / 10,
        qrImageIsDataUrl: charge.qrImage.startsWith("data:image"),
      }),
    );
  });
});
