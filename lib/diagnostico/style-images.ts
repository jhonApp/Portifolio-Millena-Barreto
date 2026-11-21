import type { Style } from "./constants";

// The editorial images of the result screen, supplied by the owner and kept in public/assets/diagnostic/.
// An entry set to null means "no image yet": the screen shows a reserved block (or nothing for the
// optional slots below), so a missing image never breaks it. Width and height are the intrinsic size of
// the file: the screen reserves that aspect ratio, so the image is shown whole (never cropped) and the
// page does not jump when it loads. style-images.test.ts checks them against the files.

export type StyleImage = { src: string; width: number; height: number };

export const STYLE_IMAGES: Record<Style, StyleImage | null> = {
  esportivo_natural: { src: "/assets/diagnostic/esportivo.jpg", width: 900, height: 1600 },
  tradicional: { src: "/assets/diagnostic/tradicional.jpg", width: 500, height: 750 },
  elegante: { src: "/assets/diagnostic/elegante.jpg", width: 1200, height: 1499 },
  romantico: { src: "/assets/diagnostic/romantico.png", width: 941, height: 1672 },
  criativo: { src: "/assets/diagnostic/criativo.jpg", width: 564, height: 1002 },
  dramatico: { src: "/assets/diagnostic/dramatico.png", width: 941, height: 1672 },
};

export function styleImageFor(style: Style): StyleImage | null {
  return STYLE_IMAGES[style] ?? null;
}

// Reserved slots for photos of pieces and accessories, one pair per style. The owner has not sent them
// yet: when she does, save public/assets/diagnostic/<style>-pecas.jpg (and -acessorios.jpg), run
// scripts/generate-pdf-images.mjs for the PDF copies, and fill the entry here with the file size.
export const IMAGE_SLOTS = ["pecas", "acessorios"] as const;
export type ImageSlot = (typeof IMAGE_SLOTS)[number];

const noSlots = { pecas: null, acessorios: null };
export const SLOT_IMAGES: Record<Style, Record<ImageSlot, StyleImage | null>> = {
  esportivo_natural: { ...noSlots },
  tradicional: { ...noSlots },
  elegante: { ...noSlots },
  romantico: { ...noSlots },
  criativo: { ...noSlots },
  dramatico: { ...noSlots },
};

export function slotImageFor(style: Style, slot: ImageSlot): StyleImage | null {
  return SLOT_IMAGES[style]?.[slot] ?? null;
}

/** What the result screen receives: the images of the two styles and the optional slots of the predominant one. */
export type ResultImages = {
  predominant: StyleImage | null;
  secondary: StyleImage | null;
  pieces: StyleImage | null;
  accessories: StyleImage | null;
};

export function resultImagesFor(predominant: Style, secondary: Style): ResultImages {
  return {
    predominant: styleImageFor(predominant),
    secondary: styleImageFor(secondary),
    pieces: slotImageFor(predominant, "pecas"),
    accessories: slotImageFor(predominant, "acessorios"),
  };
}
