import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STYLES, STYLE_LABELS, type Style } from "@/lib/diagnostico/constants";
import {
  ContentError,
  composeDiagnosis,
  percentShares,
  type ContentSet,
  type ContentTemplate,
} from "@/lib/diagnostico/diagnosis-composer";
import { diagnosisContentSchema } from "@/lib/diagnostico/schemas/diagnosis-content";
import type { ScoringResult } from "@/lib/diagnostico/scoring";

// The templates come from the same source file the seed migration is generated from.
const source = JSON.parse(
  readFileSync("docs/questions/RF-07-diagnosis-content-and-pdf-generation/content-source.json", "utf8"),
) as {
  styles: Record<Style, { result: string; secondary: string; pieces_intro: string; accessories_intro: string; guidance: string; pieces: string[]; accessories: string[] }>;
  pairs: Record<string, string>;
};

function buildContent(): ContentSet {
  const templates: ContentTemplate[] = [];
  for (const style of STYLES) {
    const s = source.styles[style];
    for (const [block, body] of [
      ["result", s.result],
      ["secondary", s.secondary],
      ["pieces", s.pieces_intro],
      ["accessories", s.accessories_intro],
      ["guidance", s.guidance],
    ] as const) {
      templates.push({ kind: "style_block", style, secondary_style: null, block, position: 1, body });
    }
    s.pieces.forEach((body, i) => templates.push({ kind: "piece", style, secondary_style: null, block: null, position: i + 1, body }));
    s.accessories.forEach((body, i) =>
      templates.push({ kind: "accessory", style, secondary_style: null, block: null, position: i + 1, body }),
    );
  }
  for (const [key, body] of Object.entries(source.pairs)) {
    const [style, secondary] = key.split("|");
    templates.push({ kind: "pair_paragraph", style, secondary_style: secondary, block: null, position: 1, body });
  }
  return { versionId: "version-1", templates };
}

function scoring(points: Partial<Record<Style, number>>, predominant: Style, secondary: Style): ScoringResult {
  const full = Object.fromEntries(STYLES.map((s) => [s, points[s] ?? 0])) as Record<Style, number>;
  return { points: full, predominant, secondary, tieBreaks: { predominant: "none", secondary: "none" } };
}

const base = (attemptId: string, result: ScoringResult) => ({
  firstName: "Maria",
  deliveryPreference: "both" as const,
  attemptId,
  contentVersionId: "version-1",
  scoring: result,
  content: buildContent(),
});

const ELEGANTE_ROMANTICO = scoring({ elegante: 6, romantico: 4, tradicional: 2, esportivo_natural: 1, criativo: 1, dramatico: 1 }, "elegante", "romantico");

describe("percentShares", () => {
  it("percentShares uses the largest remainder", () => {
    // 6/15=40, 4/15=26.67, 2/15=13.33, 1/15=6.67 (x3): the leftover units go to the largest remainders.
    const shares = percentShares({ elegante: 6, romantico: 4, tradicional: 2, esportivo_natural: 1, criativo: 1, dramatico: 1 });
    expect(shares.elegante).toBe(40);
    expect(shares.romantico).toBe(27);
    expect(shares.tradicional).toBe(13);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("percentShares of equal points sums to 100", () => {
    const shares = percentShares(Object.fromEntries(STYLES.map((s) => [s, 5])) as Record<Style, number>);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(100);
    expect(Math.max(...Object.values(shares)) - Math.min(...Object.values(shares))).toBeLessThanOrEqual(1);
  });

  it("percentages always sum to 100", () => {
    for (let seed = 1; seed <= 200; seed++) {
      // A simple deterministic spread of 15 points over six styles.
      const points = Object.fromEntries(STYLES.map((s) => [s, 0])) as Record<Style, number>;
      let x = seed;
      for (let i = 0; i < 15; i++) {
        x = (x * 1103515245 + 12345) % 2147483648;
        points[STYLES[x % 6]] += 1;
      }
      expect(Object.values(percentShares(points)).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it("percentShares rejects a total of zero", () => {
    expect(() => percentShares(Object.fromEntries(STYLES.map((s) => [s, 0])) as Record<Style, number>)).toThrow(ContentError);
  });
});

describe("composeDiagnosis", () => {
  it("two answer sets with the same pair give different percentages", () => {
    const other = scoring({ elegante: 5, romantico: 5, tradicional: 2, esportivo_natural: 1, criativo: 1, dramatico: 1 }, "elegante", "romantico");
    const a = composeDiagnosis(base("attempt-a", ELEGANTE_ROMANTICO));
    const b = composeDiagnosis(base("attempt-b", other));
    expect(a.percentages).not.toEqual(b.percentages);
  });

  it("two attempts with the same pair do not always get the same picks", () => {
    const signatures = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const result = composeDiagnosis(base(`attempt-${i}`, ELEGANTE_ROMANTICO));
      signatures.add(JSON.stringify([result.blocks[1], result.blocks[2]]));
    }
    expect(signatures.size).toBeGreaterThan(1);
  });

  it("the same attempt always gets the same picks", () => {
    const first = composeDiagnosis(base("attempt-x", ELEGANTE_ROMANTICO));
    const second = composeDiagnosis(base("attempt-x", ELEGANTE_ROMANTICO));
    expect(second).toEqual(first);
  });

  it("composition does not use randomness or the clock", () => {
    const realRandom = Math.random;
    const realNow = Date.now;
    Math.random = () => {
      throw new Error("Math.random used");
    };
    Date.now = () => {
      throw new Error("Date.now used");
    };
    try {
      expect(() => composeDiagnosis(base("attempt-y", ELEGANTE_ROMANTICO))).not.toThrow();
    } finally {
      Math.random = realRandom;
      Date.now = realNow;
    }
  });

  it("the four blocks come in the order of the layout", () => {
    const result = composeDiagnosis(base("attempt-z", ELEGANTE_ROMANTICO));
    expect((result.blocks as { title: string }[]).map((b) => b.title)).toEqual([
      "Seu resultado",
      "Peças que combinam com você",
      "Acessórios e complementos",
      "Uma orientação especial",
    ]);
    expect(diagnosisContentSchema.safeParse(result).success).toBe(true);
  });

  it("the predominant text comes first then the secondary text then the pair paragraph", () => {
    const result = composeDiagnosis(base("attempt-1", ELEGANTE_ROMANTICO));
    const [first, second, third] = (result.blocks[0] as { paragraphs: string[] }).paragraphs;
    expect(first).toContain("estilo predominante é o Elegante");
    // The text of the secondary style opens with "O seu segundo estilo", not with the name: the name is kept
    // for the result and the guidance (see name-repeats.test.ts).
    expect(second).toContain("seu segundo estilo é o Romântico");
    expect(second).not.toContain("predominante");
    expect(third).toBe(source.pairs["elegante|romantico"].replaceAll("{nome}", "Maria"));
  });

  it("the text of the secondary style never calls it the predominant one, for every style", () => {
    for (const secondary of STYLES) {
      const predominant = STYLES.find((style) => style !== secondary)!;
      const result = composeDiagnosis(base("attempt-1", scoring({ [predominant]: 6, [secondary]: 4 }, predominant, secondary)));
      const second = (result.blocks[0] as { paragraphs: string[] }).paragraphs[1];
      expect(second, secondary).toContain(`seu segundo estilo é o ${STYLE_LABELS[secondary]}`);
      expect(second, secondary).not.toMatch(/predominante/);
      // Changed: this used to expect the first name here. Only the result and the guidance carry it now.
      expect(second, secondary).not.toContain("Maria");
      expect(second, secondary).not.toContain("{nome}");
    }
  });

  it("a content set without the secondary text of the second style is reported as missing", () => {
    const input = base("attempt-1", ELEGANTE_ROMANTICO);
    const without = input.content.templates.filter(
      (t) => !(t.kind === "style_block" && t.style === "romantico" && t.block === "secondary"),
    );
    expect(() => composeDiagnosis({ ...input, content: { ...input.content, templates: without } })).toThrowError(
      /style_block:romantico:secondary/,
    );
  });

  it("three pieces and two accessories come from the predominant pool and one and one from the secondary", () => {
    const result = composeDiagnosis(base("attempt-2", ELEGANTE_ROMANTICO));
    const pieces = (result.blocks[1] as { items: string[] }).items;
    const accessories = (result.blocks[2] as { items: string[] }).items;
    const strip = (items: string[]) => items.map((item) => item.replaceAll("Maria", "{nome}"));
    expect(strip(pieces.slice(0, 3)).every((p) => source.styles.elegante.pieces.includes(p))).toBe(true);
    expect(source.styles.romantico.pieces).toContain(pieces[3]);
    expect(strip(accessories.slice(0, 2)).every((p) => source.styles.elegante.accessories.includes(p))).toBe(true);
    expect(source.styles.romantico.accessories).toContain(accessories[2]);
  });

  it("no item repeats", () => {
    for (let i = 0; i < 30; i++) {
      const result = composeDiagnosis(base(`attempt-r-${i}`, ELEGANTE_ROMANTICO));
      for (const block of [result.blocks[1], result.blocks[2]]) {
        const items = (block as { items: string[] }).items;
        expect(new Set(items).size).toBe(items.length);
      }
    }
  });

  it("{nome} is replaced by the first name", () => {
    const result = composeDiagnosis(base("attempt-3", ELEGANTE_ROMANTICO));
    expect(JSON.stringify(result)).not.toContain("{nome}");
    expect(JSON.stringify(result)).toContain("Maria");
  });

  it("an unknown placeholder is rejected", () => {
    const input = base("attempt-4", ELEGANTE_ROMANTICO);
    const target = input.content.templates.find((t) => t.kind === "style_block" && t.style === "elegante" && t.block === "guidance")!;
    target.body = `${target.body} {sobrenome}`;
    expect(() => composeDiagnosis(input)).toThrow(ContentError);
  });

  it("composition names what is missing", () => {
    const input = base("attempt-5", ELEGANTE_ROMANTICO);
    input.content.templates = input.content.templates.filter(
      (t) => !(t.kind === "pair_paragraph" && t.style === "elegante" && t.secondary_style === "romantico"),
    );
    try {
      composeDiagnosis(input);
      throw new Error("expected a ContentError");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError);
      expect((error as ContentError).missing).toEqual(["pair_paragraph:elegante>romantico"]);
    }
  });

  it("every ordered pair of styles composes", () => {
    for (const first of STYLES) {
      for (const second of STYLES) {
        if (first === second) continue;
        const points = Object.fromEntries(STYLES.map((s) => [s, 1])) as Record<Style, number>;
        points[first] = 6;
        points[second] = 4;
        const result = composeDiagnosis(base(`pair-${first}-${second}`, scoring(points, first, second)));
        expect(diagnosisContentSchema.safeParse(result).success).toBe(true);
      }
    }
  });
});
