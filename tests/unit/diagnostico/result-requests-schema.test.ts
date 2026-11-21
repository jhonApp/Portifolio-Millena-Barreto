import { describe, expect, it } from "vitest";
import { emailBodySchema, tokenBodySchema } from "@/lib/diagnostico/schemas/result-requests";

describe("result request schemas", () => {
  it("the token body accepts 43 url-safe characters and rejects the rest", () => {
    expect(tokenBodySchema.safeParse({ token: "a".repeat(43) }).success).toBe(true);
    expect(tokenBodySchema.safeParse({ token: `${"A1_-".repeat(10)}abc` }).success).toBe(true);
    for (const token of ["", "short", "a".repeat(44), `${"a".repeat(42)}/`, 123]) {
      expect(tokenBodySchema.safeParse({ token }).success).toBe(false);
    }
    expect(tokenBodySchema.safeParse({}).success).toBe(false);
  });

  it("the e-mail body lower-cases and trims", () => {
    const result = emailBodySchema.safeParse({ email: "  Maria.Souza@Example.COM " });
    expect(result.success && result.data.email).toBe("maria.souza@example.com");
  });

  it("the e-mail body rejects invalid addresses", () => {
    for (const email of ["", "maria", "maria@", "@example.com", `${"a".repeat(250)}@example.com`]) {
      expect(emailBodySchema.safeParse({ email }).success).toBe(false);
    }
    expect(emailBodySchema.safeParse({}).success).toBe(false);
  });
});
