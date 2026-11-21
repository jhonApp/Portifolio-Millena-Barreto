import type { Style } from "./constants";

// One editorial image per style for the result screen, supplied by the owner and kept in
// public/assets/diagnostic/. A style without an image (null) shows a reserved block with the
// style name instead, so the screen never breaks.
export const STYLE_IMAGES: Record<Style, string | null> = {
  esportivo_natural: "/assets/diagnostic/esportivo.jpg",
  tradicional: "/assets/diagnostic/tradicional.jpg",
  elegante: "/assets/diagnostic/elegante.jpg",
  romantico: "/assets/diagnostic/romantico.png",
  criativo: "/assets/diagnostic/criativo.jpg",
  dramatico: "/assets/diagnostic/dramatico.png",
};

export function styleImageFor(style: Style): string | null {
  return STYLE_IMAGES[style] ?? null;
}
