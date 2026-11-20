import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigError, getDatabaseEnv, getPaymentEnv } from "@/lib/diagnostico/env";

const KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ABACATEPAY_API_KEY",
  "ABACATEPAY_WEBHOOK_SECRET",
];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("environment configuration", () => {
  it("throws ConfigError naming every missing variable of the database group", () => {
    let error: unknown;
    try {
      getDatabaseEnv();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const message = (error as ConfigError).message;
    expect(message).toContain("SUPABASE_URL");
    expect(message).toContain("SUPABASE_ANON_KEY");
    expect(message).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect((error as ConfigError).group).toBe("database");
  });

  it("does not require payment variables to read the database group", () => {
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_ANON_KEY = "anon-placeholder";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-placeholder";
    expect(() => getDatabaseEnv()).not.toThrow();
    expect(() => getPaymentEnv()).toThrow(ConfigError);
  });

  it("never includes variable values in the message", () => {
    process.env.SUPABASE_URL = "not-a-url-secret-value";
    process.env.SUPABASE_ANON_KEY = "anon-secret-value";
    let message = "";
    try {
      getDatabaseEnv();
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("SUPABASE_URL");
    expect(message).not.toContain("not-a-url-secret-value");
    expect(message).not.toContain("anon-secret-value");
  });

  it("reads a complete database group", () => {
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_ANON_KEY = "anon-placeholder";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-placeholder";
    expect(getDatabaseEnv()).toEqual({
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: "anon-placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "service-placeholder",
    });
  });
});
