import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getEmailProvider } from "@/lib/diagnostico/email-provider";
import { createSimulatedEmailProvider } from "@/lib/diagnostico/email-provider-simulated";
import { emailSimulationEnabled } from "@/lib/diagnostico/email-simulation";

afterEach(() => {
  vi.unstubAllEnvs();
});

const MESSAGE = {
  to: "Maria.Souza@Example.com",
  subject: "Seu diagnóstico de estilo chegou!",
  html: "<p>oi</p>",
  text: "oi",
  attachments: [{ filename: "diagnostico-de-estilo.pdf", content: new Uint8Array([37, 80, 68, 70]) }],
};

describe("e-mail provider selection", () => {
  it("the development provider is used only when simulation is enabled outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_EMAIL_SIMULATION", "true");
    expect(emailSimulationEnabled()).toBe(true);
    const dir = mkdtempSync(path.join(tmpdir(), "mail-"));
    vi.stubEnv("LOCAL_MAIL_DIR", dir);
    try {
      const result = await getEmailProvider().send(MESSAGE);
      expect(result.providerId.startsWith("local-")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("never in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_EMAIL_SIMULATION", "true");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(emailSimulationEnabled()).toBe(false);
    // The real provider needs its key: without it the call fails on configuration, never with a fake send.
    await expect(getEmailProvider().send(MESSAGE)).rejects.toMatchObject({ name: "ConfigError" });
  });

  it("the Resend provider is used when simulation is off", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_EMAIL_SIMULATION", "false");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(emailSimulationEnabled()).toBe(false);
    await expect(getEmailProvider().send(MESSAGE)).rejects.toMatchObject({ name: "ConfigError" });
  });
});

describe("development e-mail provider", () => {
  it("the development provider writes the html text and pdf files", async () => {
    vi.stubEnv("EMAIL_SIMULATION_FAIL", "false");
    const dir = mkdtempSync(path.join(tmpdir(), "mail-"));
    try {
      await createSimulatedEmailProvider({ dir }).send(MESSAGE);
      const files = readdirSync(dir).sort();
      expect(files).toHaveLength(3);
      expect(files.some((f) => f.endsWith(".html"))).toBe(true);
      expect(files.some((f) => f.endsWith(".txt"))).toBe(true);
      expect(files.some((f) => f.endsWith(".pdf"))).toBe(true);
      expect(files.every((f) => f.includes("maria.souza@example.com"))).toBe(true);
      const html = files.find((f) => f.endsWith(".html"))!;
      expect(readFileSync(path.join(dir, html), "utf8")).toBe("<p>oi</p>");
      const pdf = files.find((f) => f.endsWith(".pdf"))!;
      expect(Array.from(readFileSync(path.join(dir, pdf)))).toEqual([37, 80, 68, 70]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("EMAIL_SIMULATION_FAIL makes it fail and writes nothing", async () => {
    vi.stubEnv("EMAIL_SIMULATION_FAIL", "true");
    const dir = mkdtempSync(path.join(tmpdir(), "mail-"));
    try {
      await expect(createSimulatedEmailProvider({ dir }).send(MESSAGE)).rejects.toMatchObject({ code: "EMAIL_UNAVAILABLE" });
      expect(readdirSync(dir)).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
