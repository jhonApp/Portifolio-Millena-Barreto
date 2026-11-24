import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STYLES, type Style } from "@/lib/diagnostico/constants";
import { composeDiagnosis, type ContentTemplate } from "@/lib/diagnostico/diagnosis-composer";

// The first name appears at most twice in the text of a diagnosis, for every pair of styles. The cover of the
// PDF and the greeting of the e-mail are outside the diagnosis text and do not count.

const source = JSON.parse(readFileSync("docs/questions/RF-07-diagnosis-content-and-pdf-generation/content-source.json", "utf8"));

function templates(): ContentTemplate[] {
  const list: ContentTemplate[] = [];
  for (const style of STYLES as readonly Style[]) {
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

// A name that never occurs in the texts by chance.
const NAME = "Zuleica";
const count = (text: string) => text.split(NAME).length - 1;

function compose(predominant: Style, secondary: Style) {
  const points = Object.fromEntries(STYLES.map((s) => [s, 1])) as Record<Style, number>;
  points[predominant] = 6;
  points[secondary] = 4;
  return composeDiagnosis({
    firstName: NAME,
    deliveryPreference: "both",
    attemptId: "11111111-1111-4111-8111-111111111111",
    contentVersionId: "v1",
    scoring: { points, predominant, secondary, tieBreaks: { predominant: "none", secondary: "none" } },
    content: { versionId: "v1", templates: templates() },
  });
}

const ALL = STYLES as readonly Style[];
const PAIRS = ALL.flatMap((a) => ALL.filter((b) => b !== a).map((b) => [a, b] as const));

describe("the first name in the diagnosis text", () => {
  it("there are 30 pairs to check", () => {
    expect(PAIRS).toHaveLength(30);
  });

  it("the name appears at most twice in the whole text, for all 30 pairs", () => {
    for (const [predominant, secondary] of PAIRS) {
      const total = count(JSON.stringify(compose(predominant, secondary).blocks));
      expect(total, `${predominant} > ${secondary}`).toBeLessThanOrEqual(2);
    }
  });

  it("the name is in the result and in the guidance, and nowhere else, for all 30 pairs", () => {
    for (const [predominant, secondary] of PAIRS) {
      const [result, pieces, accessories, guidance] = compose(predominant, secondary).blocks as unknown as [
        { paragraphs: string[] },
        { intro: string; items: string[] },
        { intro: string; items: string[] },
        { paragraphs: string[] },
      ];
      const label = `${predominant} > ${secondary}`;
      expect(count(result.paragraphs[0]), `${label}: result`).toBe(1);
      expect(count(result.paragraphs[1]), `${label}: secondary style`).toBe(0);
      expect(count(result.paragraphs[2]), `${label}: pair paragraph`).toBe(0);
      expect(count(pieces.intro + pieces.items.join(" ")), `${label}: pieces`).toBe(0);
      expect(count(accessories.intro + accessories.items.join(" ")), `${label}: accessories`).toBe(0);
      expect(count(guidance.paragraphs[0]), `${label}: guidance`).toBe(1);
    }
  });

  it("the rewritten paragraphs start with a capital letter and keep no placeholder", () => {
    for (const [key, body] of Object.entries(source.pairs) as Array<[string, string]>) {
      expect(body, key).toMatch(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/);
      expect(body, key).not.toContain("{nome}");
    }
    for (const style of ALL) {
      expect(source.styles[style].secondary, style).toMatch(/^O seu segundo estilo é o /);
    }
  });

  it("the texts keep their size: a rewritten paragraph is the old one without the name", () => {
    const applied = JSON.parse(
      readFileSync("docs/questions/RF-07-diagnosis-content-and-pdf-generation/content-source.v1-applied.json", "utf8"),
    );
    const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
    for (const key of Object.keys(source.pairs)) {
      expect(lower(source.pairs[key]), key).toBe(applied.pairs[key].replace("{nome}, ", ""));
    }
    for (const style of ALL) {
      expect(lower(source.styles[style].secondary), style).toBe(applied.styles[style].secondary.replace("{nome}, ", ""));
    }
  });
});
