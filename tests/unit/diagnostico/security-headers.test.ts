import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config.mjs";

const REQUIRED = [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Content-Security-Policy",
  "Referrer-Policy",
];

async function headersFor(source: string) {
  const rules = await nextConfig.headers!();
  const rule = rules.find((r) => r.source === source);
  return rule ? rule.headers.map((h) => h.key) : [];
}

describe("security headers", () => {
  it("diagnostico routes get the five security headers", async () => {
    const keys = await headersFor("/diagnostico-estilo/:path*");
    for (const header of REQUIRED) expect(keys).toContain(header);
  });

  it("api routes get the five security headers", async () => {
    const keys = await headersFor("/api/:path*");
    for (const header of REQUIRED) expect(keys).toContain(header);
  });

  it("only the diagnosis and api routes are covered", async () => {
    const rules = await nextConfig.headers!();
    expect(rules.map((r) => r.source).sort()).toEqual(["/api/:path*", "/diagnostico-estilo/:path*"]);
  });
});
