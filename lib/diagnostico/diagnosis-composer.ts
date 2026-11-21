import { DELIVERY_PREFERENCES, STYLES, STYLE_LABELS, type DeliveryPreference, type Style } from "./constants";
import { shuffleWithSeed } from "./seeded-shuffle";
import type { ScoringResult } from "./scoring";
import type { DiagnosisContent } from "./schemas/diagnosis-content";

// Pure composition of the diagnosis from the scores and the editable templates: no database,
// no network, no clock, no randomness other than the seeded pick.

export type ContentTemplate = {
  kind: "style_block" | "pair_paragraph" | "piece" | "accessory";
  style: string | null;
  secondary_style: string | null;
  block: string | null;
  position: number;
  body: string;
};

export type ContentSet = { versionId: string; templates: ContentTemplate[] };

/** A template is missing or unusable: needs a person (fix the template, then reprocess). */
export class ContentError extends Error {
  missing: string[];

  constructor(missing: string[]) {
    super(`MISSING_CONTENT: ${missing.join(", ")}`);
    this.name = "ContentError";
    this.missing = missing;
  }
}

export const PIECES_FROM_PREDOMINANT = 3;
export const PIECES_FROM_SECONDARY = 1;
export const ACCESSORIES_FROM_PREDOMINANT = 2;
export const ACCESSORIES_FROM_SECONDARY = 1;

/** Share of the points of each style in whole percent; the largest-remainder method makes them sum to 100. */
export function percentShares(points: Record<Style, number>): Record<Style, number> {
  const total = STYLES.reduce((sum, style) => sum + points[style], 0);
  if (total <= 0) throw new ContentError(["points: the total is zero"]);
  const exact = STYLES.map((style) => ({ style, raw: (points[style] * 100) / total }));
  const result = Object.fromEntries(exact.map((item) => [item.style, Math.floor(item.raw)])) as Record<Style, number>;
  let left = 100 - STYLES.reduce((sum, style) => sum + result[style], 0);
  const byRemainder = exact
    .map((item, index) => ({ ...item, remainder: item.raw - Math.floor(item.raw), index }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const item of byRemainder) {
    if (left <= 0) break;
    result[item.style] += 1;
    left -= 1;
  }
  return result;
}

export function missingKeys(content: ContentSet, predominant: Style, secondary: Style): string[] {
  const missing: string[] = [];
  const has = (predicate: (t: ContentTemplate) => boolean) => content.templates.some(predicate);
  for (const block of ["result", "pieces", "accessories", "guidance"]) {
    if (!has((t) => t.kind === "style_block" && t.style === predominant && t.block === block)) {
      missing.push(`style_block:${predominant}:${block}`);
    }
  }
  // The text of the secondary style is its own block: the "result" text is written for the predominant one.
  if (!has((t) => t.kind === "style_block" && t.style === secondary && t.block === "secondary")) {
    missing.push(`style_block:${secondary}:secondary`);
  }
  if (!has((t) => t.kind === "pair_paragraph" && t.style === predominant && t.secondary_style === secondary)) {
    missing.push(`pair_paragraph:${predominant}>${secondary}`);
  }
  const count = (kind: string, style: string) =>
    content.templates.filter((t) => t.kind === kind && t.style === style).length;
  if (count("piece", predominant) < PIECES_FROM_PREDOMINANT) {
    missing.push(`piece:${predominant}:need ${PIECES_FROM_PREDOMINANT}`);
  }
  if (count("piece", secondary) < PIECES_FROM_SECONDARY) {
    missing.push(`piece:${secondary}:need ${PIECES_FROM_SECONDARY}`);
  }
  if (count("accessory", predominant) < ACCESSORIES_FROM_PREDOMINANT) {
    missing.push(`accessory:${predominant}:need ${ACCESSORIES_FROM_PREDOMINANT}`);
  }
  if (count("accessory", secondary) < ACCESSORIES_FROM_SECONDARY) {
    missing.push(`accessory:${secondary}:need ${ACCESSORIES_FROM_SECONDARY}`);
  }
  return missing;
}

/** Throws ContentError naming everything missing for this pair. */
export function assertContentComplete(content: ContentSet, predominant: Style, secondary: Style): void {
  const missing = missingKeys(content, predominant, secondary);
  if (missing.length > 0) throw new ContentError(missing);
}

function fill(text: string, firstName: string): string {
  const replaced = text.replaceAll("{nome}", firstName);
  const unknown = replaced.match(/\{[^{}]*\}/);
  if (unknown) throw new ContentError([`placeholder:${unknown[0]}`]);
  return replaced;
}

/** Items of one pool in a seeded order; `skip` holds texts already chosen, so nothing repeats. */
function pick(pool: ContentTemplate[], seed: string, count: number, skip: Set<string>): string[] {
  const ordered = [...pool].sort((a, b) => a.position - b.position);
  const chosen: string[] = [];
  for (const item of shuffleWithSeed(ordered, seed)) {
    if (chosen.length === count) break;
    if (skip.has(item.body)) continue;
    chosen.push(item.body);
    skip.add(item.body);
  }
  if (chosen.length < count) throw new ContentError([`pool:${seed}:need ${count}`]);
  return chosen;
}

export function composeDiagnosis(input: {
  firstName: string;
  deliveryPreference: DeliveryPreference;
  attemptId: string;
  contentVersionId: string;
  scoring: ScoringResult;
  content: ContentSet;
}): DiagnosisContent {
  if (!DELIVERY_PREFERENCES.includes(input.deliveryPreference)) {
    throw new ContentError([`deliveryPreference:${input.deliveryPreference}`]);
  }
  const { scoring, content, firstName } = input;
  const predominant = scoring.predominant;
  const secondary = scoring.secondary;
  assertContentComplete(content, predominant, secondary);

  const percentages = percentShares(scoring.points);
  const find = (predicate: (t: ContentTemplate) => boolean) => content.templates.find(predicate)!;
  const block = (style: Style, name: string) =>
    fill(find((t) => t.kind === "style_block" && t.style === style && t.block === name).body, firstName);
  const pool = (kind: string, style: Style) => content.templates.filter((t) => t.kind === kind && t.style === style);

  const pieceSeen = new Set<string>();
  const pieces = [
    ...pick(pool("piece", predominant), `${input.attemptId}:piece:${predominant}`, PIECES_FROM_PREDOMINANT, pieceSeen),
    ...pick(pool("piece", secondary), `${input.attemptId}:piece:${secondary}`, PIECES_FROM_SECONDARY, pieceSeen),
  ].map((text) => fill(text, firstName));
  const accessorySeen = new Set<string>();
  const accessories = [
    ...pick(
      pool("accessory", predominant),
      `${input.attemptId}:accessory:${predominant}`,
      ACCESSORIES_FROM_PREDOMINANT,
      accessorySeen,
    ),
    ...pick(
      pool("accessory", secondary),
      `${input.attemptId}:accessory:${secondary}`,
      ACCESSORIES_FROM_SECONDARY,
      accessorySeen,
    ),
  ].map((text) => fill(text, firstName));

  const pair = fill(
    find((t) => t.kind === "pair_paragraph" && t.style === predominant && t.secondary_style === secondary).body,
    firstName,
  );

  return {
    contentVersionId: input.contentVersionId,
    customer: { firstName, deliveryPreference: input.deliveryPreference },
    predominant: { style: predominant, label: STYLE_LABELS[predominant], percent: percentages[predominant] },
    secondary: { style: secondary, label: STYLE_LABELS[secondary], percent: percentages[secondary] },
    percentages,
    blocks: [
      {
        id: "result",
        title: "Seu resultado",
        paragraphs: [block(predominant, "result"), block(secondary, "secondary"), pair],
      },
      { id: "pieces", title: "Peças que combinam com você", intro: block(predominant, "pieces"), items: pieces },
      {
        id: "accessories",
        title: "Acessórios e complementos",
        intro: block(predominant, "accessories"),
        items: accessories,
      },
      { id: "guidance", title: "Uma orientação especial", paragraphs: [block(predominant, "guidance")] },
    ],
  };
}
