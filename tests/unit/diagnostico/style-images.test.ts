import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { STYLES } from "@/lib/diagnostico/constants";
import {
  IMAGE_SLOTS,
  SLOT_IMAGES,
  STYLE_IMAGES,
  resultImagesFor,
  slotImageFor,
  styleImageFor,
  type StyleImage,
} from "@/lib/diagnostico/style-images";

const allImages: Array<[string, StyleImage]> = [
  ...STYLES.flatMap((style) => {
    const image = styleImageFor(style);
    return image ? ([[style, image]] as Array<[string, StyleImage]>) : [];
  }),
  ...STYLES.flatMap((style) =>
    IMAGE_SLOTS.flatMap((slot) => {
      const image = slotImageFor(style, slot);
      return image ? ([[`${style}/${slot}`, image]] as Array<[string, StyleImage]>) : [];
    }),
  ),
];

describe("style images", () => {
  it("every style has an entry", () => {
    expect(Object.keys(STYLE_IMAGES).sort()).toEqual([...STYLES].sort());
    expect(Object.keys(SLOT_IMAGES).sort()).toEqual([...STYLES].sort());
    for (const style of STYLES) expect(Object.keys(SLOT_IMAGES[style]).sort()).toEqual([...IMAGE_SLOTS].sort());
  });

  it("every image that is set points to a file in public with the declared size", async () => {
    for (const [name, image] of allImages) {
      expect(image.src.startsWith("/"), name).toBe(true);
      const file = path.join(process.cwd(), "public", image.src);
      expect(existsSync(file), `${name}: ${image.src}`).toBe(true);
      const meta = await sharp(file).metadata();
      expect([meta.width, meta.height], `${name} size`).toEqual([image.width, image.height]);
    }
  });

  it("all six styles have their image", () => {
    for (const style of STYLES) expect(styleImageFor(style), style).not.toBeNull();
  });

  it("two entries never share an image", () => {
    const sources = allImages.map(([, image]) => image.src);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("the result screen gets both styles and the slots of the predominant style", () => {
    const images = resultImagesFor("elegante", "romantico");
    expect(images.predominant).toEqual(STYLE_IMAGES.elegante);
    expect(images.secondary).toEqual(STYLE_IMAGES.romantico);
    expect(images.pieces).toBe(slotImageFor("elegante", "pecas"));
    expect(images.accessories).toBe(slotImageFor("elegante", "acessorios"));
  });

  it("a slot with no image yet is null, so the screen shows nothing for it", () => {
    for (const style of STYLES) {
      for (const slot of IMAGE_SLOTS) {
        const image = slotImageFor(style, slot);
        if (image === null) expect(resultImagesFor(style, "tradicional")[slot === "pecas" ? "pieces" : "accessories"]).toBeNull();
      }
    }
  });
});
