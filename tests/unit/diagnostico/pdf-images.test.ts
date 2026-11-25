import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STYLES, type Style } from "@/lib/diagnostico/constants";
import { composeDiagnosis, type ContentTemplate } from "@/lib/diagnostico/diagnosis-composer";
import { pdfSlotImage, pdfStyleImage } from "@/lib/diagnostico/diagnosis-pdf";
import { PDF_IMAGE_FILES } from "@/lib/diagnostico/pdf-image-files";
import { renderDiagnosisPdf } from "@/lib/diagnostico/render-diagnosis-pdf";
import type { DiagnosisContent } from "@/lib/diagnostico/schemas/diagnosis-content";

const source = JSON.parse(readFileSync("docs/questions/RF-07-diagnosis-content-and-pdf-generation/content-source.json", "utf8"));
const REAL_DIR = path.join(process.cwd(), "assets", "pdf-images");
const ALL = STYLES as readonly Style[];

function templates(): ContentTemplate[] {
  const list: ContentTemplate[] = [];
  for (const style of ALL) {
    const s = source.styles[style];
    for (const [block, key] of [
      ["result", "result"],
      ["secondary", "secondary"],
      ["pieces", "pieces_intro"],
      ["accessories", "accessories_intro"],
      ["guidance", "guidance"],
    ] as const) {
      list.push({ kind: "style_block", style, secondary_style: null, block, position: 1, body: s[key] });
    }
    s.pieces.forEach((body: string, i: number) =>
      list.push({ kind: "piece", style, secondary_style: null, block: null, position: i + 1, body }),
    );
    s.accessories.forEach((body: string, i: number) =>
      list.push({ kind: "accessory", style, secondary_style: null, block: null, position: i + 1, body }),
    );
  }
  for (const [key, body] of Object.entries(source.pairs) as Array<[string, string]>) {
    const [style, secondary] = key.split("|");
    list.push({ kind: "pair_paragraph", style, secondary_style: secondary, block: null, position: 1, body });
  }
  return list;
}

function compose(predominant: Style, secondary: Style): DiagnosisContent {
  const points = Object.fromEntries(STYLES.map((s) => [s, 1])) as Record<Style, number>;
  points[predominant] = 6;
  points[secondary] = 4;
  return composeDiagnosis({
    firstName: "Maria",
    deliveryPreference: "both",
    attemptId: "11111111-1111-4111-8111-111111111111",
    contentVersionId: "v1",
    scoring: { points, predominant, secondary, tieBreaks: { predominant: "none", secondary: "none" } },
    content: { versionId: "v1", templates: templates() },
  });
}

/** Number of images painted on each page of the PDF. */
async function imagesPerPage(pdf: Uint8Array): Promise<number[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: false }).promise;
  const counts: number[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const ops = await (await doc.getPage(n)).getOperatorList();
    counts.push(
      ops.fnArray.filter((fn) => fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject).length,
    );
  }
  return counts;
}

const scratch = mkdtempSync(path.join(tmpdir(), "pdf-images-"));
const emptyDir = path.join(scratch, "empty");
const slotDir = path.join(scratch, "slots"); // the real copies plus slot files made from them: a layout fixture, never shipped

beforeAll(() => {
  mkdirSync(emptyDir);
  mkdirSync(slotDir);
  for (const style of ALL) {
    const real = path.join(REAL_DIR, PDF_IMAGE_FILES[style]);
    copyFileSync(real, path.join(slotDir, `${style}.jpg`));
    copyFileSync(real, path.join(slotDir, `${style}-pecas.jpg`));
    copyFileSync(real, path.join(slotDir, `${style}-acessorios.jpg`));
  }
});
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("the images of the diagnosis PDF", () => {
  it("every style has its light copy, and the slots of pieces and accessories are empty for now", () => {
    for (const style of ALL) {
      expect(pdfStyleImage(style), style).not.toBeNull();
      expect(pdfSlotImage(style, "pecas"), `${style} pecas`).toBeNull();
      expect(pdfSlotImage(style, "acessorios"), `${style} acessorios`).toBeNull();
    }
  });

  it("the cover, the two style pages and the numbers page have images; the other pages have none", async () => {
    const pdf = await renderDiagnosisPdf(compose("romantico", "dramatico"), { customerName: "Maria Souza Lima" });
    // cover: 1 (predominant), predominant page: 1, secondary page: 1, numbers: 2 thumbnails, then none.
    expect(await imagesPerPage(pdf)).toEqual([1, 1, 1, 2, 0, 0, 0, 0]);
  }, 60_000);

  it("a style whose file is missing does not fail the PDF: that place is left without an image", async () => {
    const pdf = await renderDiagnosisPdf(compose("romantico", "dramatico"), {
      customerName: "Maria Souza Lima",
      imagesDir: emptyDir,
    });
    expect(await imagesPerPage(pdf)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  }, 60_000);

  it("only the secondary image missing leaves the rest in place", async () => {
    const dir = path.join(scratch, "no-secondary");
    mkdirSync(dir);
    copyFileSync(path.join(REAL_DIR, PDF_IMAGE_FILES.romantico), path.join(dir, "romantico.jpg"));
    const pdf = await renderDiagnosisPdf(compose("romantico", "dramatico"), { customerName: "Maria Souza Lima", imagesDir: dir });
    expect(await imagesPerPage(pdf)).toEqual([1, 1, 0, 1, 0, 0, 0, 0]);
  }, 60_000);

  it("when the slot photos are supplied they appear on the pieces and accessories pages, still in 8 pages", async () => {
    const pdf = await renderDiagnosisPdf(compose("romantico", "dramatico"), {
      customerName: "Maria Souza Lima",
      imagesDir: slotDir,
    });
    expect(await imagesPerPage(pdf)).toEqual([1, 1, 1, 2, 1, 1, 0, 0]);
  }, 60_000);

  it("the worst case (the two largest images) is under 1 MB and renders in 10 s or less", async () => {
    for (const [predominant, secondary] of [
      ["romantico", "dramatico"],
      ["dramatico", "romantico"],
    ] as const) {
      const started = Date.now();
      const pdf = await renderDiagnosisPdf(compose(predominant, secondary), { customerName: "Maria Souza Lima" });
      expect(Date.now() - started, `${predominant} > ${secondary}: time`).toBeLessThanOrEqual(10_000);
      expect(pdf.length, `${predominant} > ${secondary}: size`).toBeLessThan(1024 * 1024);
    }
  }, 60_000);

  it("the worst case with all the reserved slots filled also stays under 1 MB", async () => {
    const started = Date.now();
    const pdf = await renderDiagnosisPdf(compose("romantico", "dramatico"), {
      customerName: "Maria Souza Lima",
      imagesDir: slotDir,
    });
    expect(Date.now() - started).toBeLessThanOrEqual(10_000);
    expect(pdf.length).toBeLessThan(1024 * 1024);
  }, 60_000);
});
