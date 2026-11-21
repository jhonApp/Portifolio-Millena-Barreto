import type { Style } from "./constants";

// One editorial image per style for the result screen. None has been supplied or licensed yet
// (owner decision), so the screen shows a reserved block with the style name instead.
// When the images exist, put them in public/diagnostico/estilos/ and fill the entries, for example
//   elegante: "/diagnostico/estilos/elegante.jpg"
export const STYLE_IMAGES: Record<Style, string | null> = {
  esportivo_natural: null,
  tradicional: null,
  elegante: null,
  romantico: null,
  criativo: null,
  dramatico: null,
};

export function styleImageFor(style: Style): string | null {
  return STYLE_IMAGES[style] ?? null;
}
