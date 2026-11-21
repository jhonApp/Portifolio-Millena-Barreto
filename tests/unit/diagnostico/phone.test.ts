import { describe, expect, it } from "vitest";
import { maskWhatsapp, normalizeWhatsapp } from "@/lib/diagnostico/phone";

describe("whatsapp helpers", () => {
  it("maskWhatsapp formats while typing", () => {
    expect(maskWhatsapp("")).toBe("");
    expect(maskWhatsapp("1")).toBe("(1");
    expect(maskWhatsapp("11")).toBe("(11");
    expect(maskWhatsapp("119")).toBe("(11) 9");
    expect(maskWhatsapp("1191234")).toBe("(11) 91234");
    expect(maskWhatsapp("11912345678")).toBe("(11) 91234-5678");
    expect(maskWhatsapp("119123456789999")).toBe("(11) 91234-5678");
  });

  it("normalizeWhatsapp accepts +55 and 55 prefixes", () => {
    expect(normalizeWhatsapp("(11) 91234-5678")).toBe("+5511912345678");
    expect(normalizeWhatsapp("11912345678")).toBe("+5511912345678");
    expect(normalizeWhatsapp("+55 11 91234-5678")).toBe("+5511912345678");
    expect(normalizeWhatsapp("5511912345678")).toBe("+5511912345678");
  });

  it("normalizeWhatsapp rejects a landline-length number", () => {
    expect(normalizeWhatsapp("(11) 1234-5678")).toBeNull();
    expect(normalizeWhatsapp("1112345678")).toBeNull();
  });

  it("DDD below 11 is rejected", () => {
    expect(normalizeWhatsapp("(10) 91234-5678")).toBeNull();
    expect(normalizeWhatsapp("(01) 91234-5678")).toBeNull();
  });

  it("requires a mobile number starting with 9", () => {
    expect(normalizeWhatsapp("(11) 81234-5678")).toBeNull();
  });

  it("rejects too many digits and non-numeric input", () => {
    expect(normalizeWhatsapp("119123456789")).toBeNull();
    expect(normalizeWhatsapp("abc")).toBeNull();
  });
});
