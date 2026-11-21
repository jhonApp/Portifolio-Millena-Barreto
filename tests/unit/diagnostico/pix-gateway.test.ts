import { afterEach, describe, expect, it, vi } from "vitest";
import { getPixGateway } from "@/lib/diagnostico/pix-gateway";
import { createSimulatedGateway } from "@/lib/diagnostico/pix-gateway-simulated";

afterEach(() => {
  vi.unstubAllEnvs();
});

const INPUT = {
  orderId: "5d7f0c1e-2b4a-4c8e-9a31-0f6b7e2d9a44",
  amountCents: 990,
  expiresInSeconds: 1800,
  description: "x",
};

describe("Pix gateway selection", () => {
  it("returns the simulated gateway when simulation is enabled outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "true");
    vi.stubEnv("PAYMENT_SIMULATION_FAIL", "");
    const charge = await getPixGateway().createCharge(INPUT);
    expect(charge.chargeId.startsWith("sim_")).toBe(true);
  });

  it("returns the real gateway when simulation is off", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "false");
    vi.stubEnv("ABACATEPAY_API_KEY", "");
    // The real gateway needs the key: with it missing the call fails on configuration, not with a fake charge.
    await expect(getPixGateway().createCharge(INPUT)).rejects.toMatchObject({ name: "ConfigError" });
  });

  it("never returns the simulated gateway in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "true");
    vi.stubEnv("ABACATEPAY_API_KEY", "");
    await expect(getPixGateway().createCharge(INPUT)).rejects.toMatchObject({ name: "ConfigError" });
  });

  it("the simulated gateway never reports a payment", async () => {
    vi.stubEnv("PAYMENT_SIMULATION_FAIL", "");
    vi.stubEnv("PAYMENT_SIMULATION_PAID_AFTER_SECONDS", "");
    const gateway = createSimulatedGateway();
    expect(Object.keys(gateway).sort()).toEqual(["createCharge", "getCharge"]);
    const charge = await gateway.createCharge(INPUT);
    expect(Object.keys(charge).sort()).toEqual(["chargeId", "expiresAt", "pixCode", "qrImage"]);
    expect((await gateway.getCharge(charge.chargeId)).status).toBe("PENDING");
  });

  it("PAYMENT_SIMULATION_FAIL makes the simulated gateway fail", async () => {
    vi.stubEnv("PAYMENT_SIMULATION_FAIL", "true");
    await expect(createSimulatedGateway().createCharge(INPUT)).rejects.toMatchObject({
      code: "GATEWAY_UNAVAILABLE",
    });
  });

  it("a simulated charge is PENDING before PAYMENT_SIMULATION_PAID_AFTER_SECONDS", async () => {
    vi.stubEnv("PAYMENT_SIMULATION_FAIL", "");
    vi.stubEnv("PAYMENT_SIMULATION_CHECK_FAIL", "");
    vi.stubEnv("PAYMENT_SIMULATION_PAID_AFTER_SECONDS", "3600");
    const gateway = createSimulatedGateway();
    const charge = await gateway.createCharge(INPUT);
    expect((await gateway.getCharge(charge.chargeId)).status).toBe("PENDING");
  });

  it("a simulated charge is PAID after it", async () => {
    vi.stubEnv("PAYMENT_SIMULATION_FAIL", "");
    vi.stubEnv("PAYMENT_SIMULATION_CHECK_FAIL", "");
    vi.stubEnv("PAYMENT_SIMULATION_PAID_AFTER_SECONDS", "0");
    const gateway = createSimulatedGateway();
    const charge = await gateway.createCharge(INPUT);
    expect((await gateway.getCharge(charge.chargeId)).status).toBe("PAID");
  });

  it("without the variable a simulated charge is never PAID", async () => {
    vi.stubEnv("PAYMENT_SIMULATION_FAIL", "");
    vi.stubEnv("PAYMENT_SIMULATION_CHECK_FAIL", "");
    vi.stubEnv("PAYMENT_SIMULATION_PAID_AFTER_SECONDS", "");
    const gateway = createSimulatedGateway();
    const charge = await gateway.createCharge(INPUT);
    expect((await gateway.getCharge(charge.chargeId)).status).toBe("PENDING");
  });

  it("PAYMENT_SIMULATION_CHECK_FAIL makes getCharge fail", async () => {
    vi.stubEnv("PAYMENT_SIMULATION_CHECK_FAIL", "true");
    await expect(createSimulatedGateway().getCharge("sim_1_x")).rejects.toMatchObject({
      code: "GATEWAY_UNAVAILABLE",
    });
  });
});
