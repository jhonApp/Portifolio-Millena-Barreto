import { afterEach, describe, expect, it, vi } from "vitest";
import { paymentSimulationEnabled } from "@/lib/diagnostico/payment-simulation";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("payment simulation guard", () => {
  it("is disabled in production even when the flag is true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "true");
    expect(paymentSimulationEnabled()).toBe(false);
  });

  it("is disabled by default in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "");
    expect(paymentSimulationEnabled()).toBe(false);
  });

  it("is enabled only outside production with the flag true", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_PAYMENT_SIMULATION", "true");
    expect(paymentSimulationEnabled()).toBe(true);
  });
});
