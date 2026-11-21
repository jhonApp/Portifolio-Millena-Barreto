import { describe, expect, it } from "vitest";
import {
  CONTROLLER_NAME,
  PRIVACY_OPERATORS,
  privacyPolicySections,
  type PolicySection,
} from "@/lib/diagnostico/privacy-policy-content";
import { RETENTION_PAID_MONTHS, RETENTION_UNPAID_DAYS } from "@/lib/diagnostico/constants";

const CONTACT = "privacidade@example.com";

function textOf(sections: PolicySection[]): string {
  return sections.map((s) => [s.title, ...(s.paragraphs ?? []), ...(s.items ?? [])].join(" ")).join(" ");
}
const section = (id: string) => privacyPolicySections(CONTACT).find((s) => s.id === id)!;

describe("privacy policy content", () => {
  it("the policy lists data collected, purposes, retention, rights and operators", () => {
    const ids = privacyPolicySections(CONTACT).map((s) => s.id);
    for (const id of ["quem-somos", "dados-coletados", "finalidades", "prazos", "direitos", "compartilhamento"]) {
      expect(ids).toContain(id);
    }
    const collected = textOf([section("dados-coletados")]);
    for (const data of ["Nome completo", "e-mail", "WhatsApp", "respostas", "diagnóstico", "pagamento"]) {
      expect(collected).toContain(data);
    }
    const operators = textOf([section("compartilhamento")]);
    for (const operator of ["Supabase", "Vercel", "AbacatePay", "Resend"]) expect(operators).toContain(operator);
    expect(PRIVACY_OPERATORS.map((o) => o.name)).toEqual(["Supabase", "Vercel", "AbacatePay", "Resend"]);
  });

  it("the controller line and the contact come from the owner decisions", () => {
    const who = textOf([section("quem-somos")]);
    expect(who).toContain(CONTROLLER_NAME);
    expect(who).toContain(CONTACT);
    expect(who).not.toMatch(/CNPJ|CPF/);
  });

  it("the retention numbers come from the constants", () => {
    const retention = textOf([section("prazos")]);
    expect(retention).toContain(`${RETENTION_UNPAID_DAYS} dias`);
    expect(retention).toContain(`${RETENTION_PAID_MONTHS} meses`);
    expect(RETENTION_UNPAID_DAYS).toBe(7);
    expect(RETENTION_PAID_MONTHS).toBe(12);
  });

  it("every section has a title and some content", () => {
    for (const s of privacyPolicySections(CONTACT)) {
      expect(s.title.length).toBeGreaterThan(2);
      expect((s.paragraphs?.length ?? 0) + (s.items?.length ?? 0)).toBeGreaterThan(0);
    }
  });
});
