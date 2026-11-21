import { describe, expect, it } from "vitest";
import { deletionConfirmBodySchema, deletionRequestBodySchema } from "@/lib/diagnostico/schemas/privacy-requests";

describe("privacy request bodies", () => {
  it("the e-mail is trimmed and lower-cased", () => {
    const parsed = deletionRequestBodySchema.safeParse({ email: "  Maria@Example.COM " });
    expect(parsed.success && parsed.data.email).toBe("maria@example.com");
  });

  it("an invalid or too long e-mail is refused", () => {
    expect(deletionRequestBodySchema.safeParse({ email: "sem-arroba" }).success).toBe(false);
    expect(deletionRequestBodySchema.safeParse({ email: `${"a".repeat(250)}@example.com` }).success).toBe(false);
    expect(deletionRequestBodySchema.safeParse({}).success).toBe(false);
  });

  it("a token must have 43 characters", () => {
    expect(deletionConfirmBodySchema.safeParse({ token: "a".repeat(43) }).success).toBe(true);
    expect(deletionConfirmBodySchema.safeParse({ token: "a".repeat(42) }).success).toBe(false);
    expect(deletionConfirmBodySchema.safeParse({ token: `${"a".repeat(42)}!` }).success).toBe(false);
  });
});
