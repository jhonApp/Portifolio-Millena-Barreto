import { describe, expect, it } from "vitest";
import { diagnosisContentSchema } from "@/lib/diagnostico/schemas/diagnosis-content";

const valid = {
  contentVersionId: "v1",
  customer: { firstName: "Maria", deliveryPreference: "both" },
  predominant: { style: "elegante", label: "Elegante", percent: 40 },
  secondary: { style: "romantico", label: "Romântico", percent: 27 },
  percentages: { elegante: 40, romantico: 27, tradicional: 13, esportivo_natural: 7, criativo: 7, dramatico: 6 },
  blocks: [
    { id: "result", title: "Seu resultado", paragraphs: ["a", "b", "c"] },
    { id: "pieces", title: "Peças que combinam com você", intro: "x", items: ["1", "2", "3", "4"] },
    { id: "accessories", title: "Acessórios e complementos", intro: "x", items: ["1", "2", "3"] },
    { id: "guidance", title: "Uma orientação especial", paragraphs: ["g"] },
  ],
};

describe("diagnosis content schema", () => {
  it("accepts the documented content", () => {
    expect(diagnosisContentSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects percentages that do not sum to 100", () => {
    const broken = { ...valid, percentages: { ...valid.percentages, elegante: 41 } };
    expect(diagnosisContentSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects fewer than 4 pieces or 3 accessories", () => {
    const fewPieces = structuredClone(valid);
    (fewPieces.blocks[1] as { items: string[] }).items = ["1", "2", "3"];
    expect(diagnosisContentSchema.safeParse(fewPieces).success).toBe(false);
    const fewAccessories = structuredClone(valid);
    (fewAccessories.blocks[2] as { items: string[] }).items = ["1", "2"];
    expect(diagnosisContentSchema.safeParse(fewAccessories).success).toBe(false);
  });

  it("rejects an unknown style or delivery preference", () => {
    expect(diagnosisContentSchema.safeParse({ ...valid, predominant: { ...valid.predominant, style: "sexy" } }).success).toBe(false);
    expect(diagnosisContentSchema.safeParse({ ...valid, customer: { firstName: "Maria", deliveryPreference: "sms" } }).success).toBe(false);
  });
});
