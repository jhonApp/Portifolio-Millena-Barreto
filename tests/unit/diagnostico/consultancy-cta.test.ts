import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONSULTANCY_CTA } from "@/lib/diagnostico/consultancy-cta";
import { renderDiagnosisPdf } from "@/lib/diagnostico/render-diagnosis-pdf";
import type { DiagnosisContent } from "@/lib/diagnostico/schemas/diagnosis-content";

const content = {
  contentVersionId: "v1",
  customer: { firstName: "Maria", deliveryPreference: "email" },
  predominant: { style: "tradicional", label: "Tradicional", percent: 50 },
  secondary: { style: "romantico", label: "Romântico", percent: 30 },
  percentages: { tradicional: 50, romantico: 30, esportivo_natural: 5, criativo: 5, elegante: 5, dramatico: 5 },
  blocks: [
    { id: "result", title: "Resultado", paragraphs: ["a", "b", "c"] },
    { id: "pieces", title: "Peças", intro: "intro", items: ["1", "2", "3", "4"] },
    { id: "accessories", title: "Acessórios", intro: "intro", items: ["1", "2", "3"] },
    { id: "guidance", title: "Orientação", paragraphs: ["g"] },
  ],
} as unknown as DiagnosisContent;

describe("the consultancy call to action", () => {
  it("links to the WhatsApp chat and to the Instagram profile", () => {
    expect(CONSULTANCY_CTA.whatsappUrl).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(CONSULTANCY_CTA.instagramUrl).toBe("https://www.instagram.com/millenabarreto.mb");
  });

  it("closes the PDF with the text and the two clickable links", async () => {
    const pdf = await renderDiagnosisPdf(content, { imagesDir: mkdtempSync(path.join(tmpdir(), "cta-empty-")) });
    const dir = mkdtempSync(path.join(tmpdir(), "cta-"));
    try {
      writeFileSync(path.join(dir, "out.pdf"), pdf);
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: false }).promise;
      const last = await doc.getPage(doc.numPages);
      const text = (await last.getTextContent()).items.map((item) => ("str" in item ? item.str : "")).join(" ");
      expect(text).toContain(CONSULTANCY_CTA.title);
      for (const benefit of CONSULTANCY_CTA.benefits) expect(text).toContain(benefit);
      // The buttons are set in capitals with letter spacing, so compare without spaces and case.
      const squash = (value: string) => value.replace(/\s+/g, "").toUpperCase();
      expect(squash(text)).toContain(squash(CONSULTANCY_CTA.whatsappLabel));
      expect(squash(text)).toContain(squash(CONSULTANCY_CTA.instagramLabel));
      const urls = (await last.getAnnotations()).map((a) => a.url);
      expect(urls).toContain(CONSULTANCY_CTA.whatsappUrl);
      expect(urls).toContain(CONSULTANCY_CTA.instagramUrl);
      expect(doc.numPages).toBe(8);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
