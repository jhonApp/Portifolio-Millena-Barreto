import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Style } from "./constants";

// The looks of the three duels of questionnaire version 2 (RF-03). Each look is the existing
// reference image of one style, delivered from the light copy kept for the PDF (35 KB to 216 KB)
// instead of the original (up to 3.3 MB). The files are named after the style, so the browser never
// sees them: it asks the look route for an alternative id and the server maps the id to the file.
// Width and height are the intrinsic size of the light copy; duel-looks.test.ts checks them.

export type DuelLook = { file: string; width: number; height: number };

export const DUEL_LOOKS: Record<Style, DuelLook> = {
  esportivo_natural: { file: "esportivo_natural.jpg", width: 765, height: 1360 },
  tradicional: { file: "tradicional.jpg", width: 500, height: 750 },
  elegante: { file: "elegante.jpg", width: 800, height: 999 },
  romantico: { file: "romantico.jpg", width: 765, height: 1360 },
  criativo: { file: "criativo.jpg", width: 564, height: 1002 },
  dramatico: { file: "dramatico.jpg", width: 765, height: 1360 },
};

const ROUTE_PREFIX = "/api/diagnostico/duel-look/";

/** The neutral address of a look: only the id of its alternative. */
export function duelLookPath(alternativeId: string): string {
  return `${ROUTE_PREFIX}${alternativeId}`;
}

/** What the screen needs to show a look: its neutral address and the size to reserve. */
export function duelLookImage(alternativeId: string, style: Style) {
  const look = DUEL_LOOKS[style];
  if (!look) return null;
  return { src: duelLookPath(alternativeId), width: look.width, height: look.height };
}

export function duelLooksFolder(): string {
  return path.join(process.cwd(), "assets", "pdf-images");
}

/** The bytes of the light copy of a style, or null when the file is missing. */
export async function readDuelLook(style: Style): Promise<Buffer | null> {
  const look = DUEL_LOOKS[style];
  if (!look) return null;
  try {
    return await readFile(path.join(duelLooksFolder(), look.file));
  } catch {
    return null;
  }
}
