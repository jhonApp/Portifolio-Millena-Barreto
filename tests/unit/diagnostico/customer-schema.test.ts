import { describe, expect, it } from "vitest";
import { CUSTOMER_MESSAGES, customerFormSchema } from "@/lib/diagnostico/schemas/customer";
import { parseInput } from "@/lib/diagnostico/validation";

const valid = {
  fullName: "Maria Souza",
  email: "Maria@Example.com ",
  whatsapp: "(11) 91234-5678",
  deliveryPreference: "both",
  consent: true,
  idempotencyKey: "5b1c1f0e-8a38-4a3c-9d1c-3d6a1f5e2b10",
};

function fieldsOf(input: unknown): Record<string, string[]> {
  const result = parseInput(customerFormSchema, input);
  if (result.ok) throw new Error("expected validation to fail");
  return (result as { fields: Record<string, string[]> }).fields;
}

describe("customer form schema", () => {
  it("accepts valid data and normalizes it", () => {
    const result = parseInput(customerFormSchema, valid);
    expect(result).toEqual({
      ok: true,
      data: {
        fullName: "Maria Souza",
        email: "maria@example.com",
        whatsapp: "+5511912345678",
        deliveryPreference: "both",
        consent: true,
        idempotencyKey: valid.idempotencyKey,
      },
    });
  });

  it("empty input yields an error for every field", () => {
    const fields = fieldsOf({});
    expect(fields.fullName).toEqual([CUSTOMER_MESSAGES.fullName]);
    expect(fields.email).toEqual([CUSTOMER_MESSAGES.email]);
    expect(fields.whatsapp).toEqual([CUSTOMER_MESSAGES.whatsapp]);
    expect(fields.deliveryPreference).toEqual([CUSTOMER_MESSAGES.deliveryPreference]);
    expect(fields.consent).toEqual([CUSTOMER_MESSAGES.consent]);
  });

  it("empty strings yield the same messages", () => {
    const fields = fieldsOf({
      ...valid,
      fullName: "",
      email: "",
      whatsapp: "",
      deliveryPreference: "",
    });
    expect(fields.fullName?.[0]).toBe(CUSTOMER_MESSAGES.fullName);
    expect(fields.email?.[0]).toBe(CUSTOMER_MESSAGES.email);
    expect(fields.whatsapp?.[0]).toBe(CUSTOMER_MESSAGES.whatsapp);
    expect(fields.deliveryPreference?.[0]).toBe(CUSTOMER_MESSAGES.deliveryPreference);
  });

  it("a single word name is rejected with the name message", () => {
    expect(fieldsOf({ ...valid, fullName: "Maria" }).fullName).toEqual([CUSTOMER_MESSAGES.fullName]);
  });

  it("name over 120 characters is rejected", () => {
    const longName = `Maria ${"a".repeat(120)}`;
    expect(fieldsOf({ ...valid, fullName: longName }).fullName?.[0]).toBe(CUSTOMER_MESSAGES.fullName);
  });

  it("email is trimmed and lower-cased", () => {
    const result = parseInput(customerFormSchema, { ...valid, email: "  MARIA@Example.COM  " });
    expect(result.ok && result.data.email).toBe("maria@example.com");
  });

  it("an invalid email is rejected", () => {
    expect(fieldsOf({ ...valid, email: "maria@" }).email).toEqual([CUSTOMER_MESSAGES.email]);
  });

  it("whatsapp without the ninth digit is rejected", () => {
    expect(fieldsOf({ ...valid, whatsapp: "(11) 1234-5678" }).whatsapp).toEqual([
      CUSTOMER_MESSAGES.whatsapp,
    ]);
  });

  it("preference must be one of the three values", () => {
    expect(fieldsOf({ ...valid, deliveryPreference: "sms" }).deliveryPreference).toEqual([
      CUSTOMER_MESSAGES.deliveryPreference,
    ]);
    for (const preference of ["email", "whatsapp", "both"]) {
      expect(parseInput(customerFormSchema, { ...valid, deliveryPreference: preference }).ok).toBe(true);
    }
  });

  it("consent false is rejected with the consent message", () => {
    expect(fieldsOf({ ...valid, consent: false }).consent).toEqual([CUSTOMER_MESSAGES.consent]);
    expect(fieldsOf({ ...valid, consent: "true" }).consent).toEqual([CUSTOMER_MESSAGES.consent]);
  });

  it("idempotency key must be a UUID", () => {
    expect(fieldsOf({ ...valid, idempotencyKey: "abc" }).idempotencyKey).toBeDefined();
  });
});
