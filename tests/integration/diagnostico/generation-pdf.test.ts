import { beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { STYLES, type Style } from "@/lib/diagnostico/constants";
import { loadPublishedContent } from "@/lib/diagnostico/content-store";
import { composeDiagnosis } from "@/lib/diagnostico/diagnosis-composer";
import { PART_TITLES, pdfStyleImage } from "@/lib/diagnostico/diagnosis-pdf";
import { PdfRenderError, renderDiagnosisPdf } from "@/lib/diagnostico/render-diagnosis-pdf";
import type { DiagnosisContent } from "@/lib/diagnostico/schemas/diagnosis-content";
import type { ScoringResult } from "@/lib/diagnostico/scoring";
import { adminClient, readPdf, type ReadPdf } from "./helpers";

const db = adminClient();
const CUSTOMER = "Maria Souza Lima";

// Letter-spaced headings come out of the text reader with spaces between letters: compare without them.
const compact = (text: string) => text.toLowerCase().replace(/\s+/g, "");

let content: DiagnosisContent;
let pdf: Uint8Array;
let elapsed = 0;
let read: ReadPdf;

function sampleScoring(): ScoringResult {
  const points = Object.fromEntries(STYLES.map((s) => [s, 1])) as Record<Style, number>;
  points.elegante = 6;
  points.romantico = 4;
  return { points, predominant: "elegante", secondary: "romantico", tieBreaks: { predominant: "none", secondary: "none" } };
}

beforeAll(async () => {
  const published = await loadPublishedContent(db);
  content = composeDiagnosis({
    firstName: "Maria",
    deliveryPreference: "both",
    attemptId: "11111111-1111-4111-8111-111111111111",
    contentVersionId: published.versionId,
    scoring: sampleScoring(),
    content: published,
  });
  const started = Date.now();
  pdf = await renderDiagnosisPdf(content, { customerName: CUSTOMER });
  elapsed = Date.now() - started;
  read = await readPdf(pdf);
}, 60_000);

describe("the diagnosis PDF", () => {
  it("the PDF has the customer name on the cover", () => {
    expect(compact(read.pages[0])).toContain(compact(CUSTOMER));
  });

  it("the PDF has the eight parts in order", () => {
    const expected = [
      "Diagnóstico de Estilo Pessoal",
      PART_TITLES.predominant,
      PART_TITLES.secondary,
      PART_TITLES.numbers,
      PART_TITLES.pieces,
      PART_TITLES.combinations,
      PART_TITLES.guidance,
      PART_TITLES.closing,
    ];
    expect(read.pages).toHaveLength(8);
    expected.forEach((title, index) => {
      expect(compact(read.pages[index]), `part ${index + 1}`).toContain(compact(title));
    });
    // The closing page carries the signature.
    expect(compact(read.pages[7])).toContain("millenabarreto");
  });

  it("the PDF shows the content of the diagnosis", () => {
    expect(read.pages[1]).toContain(content.predominant.label);
    expect(read.pages[1]).toContain(`${content.predominant.percent}%`);
    expect(read.pages[2]).toContain(content.secondary.label);
    for (const style of STYLES) expect(read.pages[3]).toContain(`${content.percentages[style]}%`);
    const pieces = (content.blocks[1] as unknown as { items: string[] }).items;
    for (const item of pieces) expect(read.pages[4]).toContain(item.slice(0, 20));
  });

  it("the secondary page speaks of the second style, not of the predominant one", () => {
    expect(read.pages[2]).toContain(`o seu segundo estilo é o ${content.secondary.label}`);
    expect(read.pages[2]).not.toContain("predominante é o");
    expect(read.pages[1]).toContain(`o seu estilo predominante é o ${content.predominant.label}`);
  });

  it("the PDF is A4 with 6 to 8 pages", () => {
    expect(read.pages.length).toBeGreaterThanOrEqual(6);
    expect(read.pages.length).toBeLessThanOrEqual(8);
    expect(Math.round(read.width)).toBe(595);
    expect(Math.round(read.height)).toBe(842);
  });

  it("the PDF is at most 2 MB", () => {
    expect(read.bytes).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(Array.from(pdf.slice(0, 5)).map((c) => String.fromCharCode(c)).join("")).toBe("%PDF-");
  });

  it("the PDF renders in at most 10 seconds", () => {
    expect(elapsed).toBeLessThanOrEqual(10_000);
  });

  it("a render over the limit is aborted", async () => {
    const never = () => new Promise<Uint8Array>(() => {});
    await expect(renderDiagnosisPdf(content, { timeoutMs: 50, renderer: never })).rejects.toBeInstanceOf(PdfRenderError);
  });

  it("a long customer name still fits the cover", async () => {
    const bytes = await renderDiagnosisPdf(content, {
      customerName: "Maria Aparecida da Conceição Souza de Albuquerque Lima",
    });
    const long = await readPdf(bytes);
    expect(long.pages).toHaveLength(8);
    expect(compact(long.pages[0])).toContain("albuquerque");
  });

  it("the predominant and the secondary pages carry the editorial image of their style and no other page does", async () => {
    expect(pdfStyleImage(content.predominant.style)).not.toBeNull();
    expect(pdfStyleImage(content.secondary.style)).not.toBeNull();
    expect(await imagesPerPage(pdf)).toEqual([0, 1, 1, 0, 0, 0, 0, 0]);
  });

  it("every style has a light image file for the PDF", () => {
    for (const style of STYLES) expect(pdfStyleImage(style), style).not.toBeNull();
  });

  it("the PDF with its two images stays well under the 2 MB limit", () => {
    expect(read.bytes).toBeLessThanOrEqual(1024 * 1024);
  });

  it("a missing image file does not fail the render: the page keeps its text", async () => {
    // Fonts are registered by now; an empty working directory only hides the image files.
    vi.spyOn(process, "cwd").mockReturnValue(mkdtempSync(path.join(tmpdir(), "no-images-")));
    try {
      const bytes = await renderDiagnosisPdf(content, { customerName: CUSTOMER });
      const withoutImages = await readPdf(bytes);
      expect(withoutImages.pages).toHaveLength(8);
      expect(withoutImages.pages[1]).toContain(content.predominant.label);
      expect(await imagesPerPage(bytes)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

/** How many images each page of a PDF paints. */
async function imagesPerPage(bytes: Uint8Array): Promise<number[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  const doc = await loading.promise;
  const counts: number[] = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const ops = await page.getOperatorList();
    counts.push(ops.fnArray.filter((fn: number) => fn === pdfjs.OPS.paintImageXObject).length);
  }
  await loading.destroy();
  return counts;
}
