import { existsSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { STYLES } from "@/lib/diagnostico/constants";
import { DUEL_LOOKS, duelLookImage, duelLookPath, duelLooksFolder, readDuelLook } from "@/lib/diagnostico/duel-looks";

const ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

describe("duel looks registry", () => {
  it("every style has a light copy with the size of its file", async () => {
    expect(Object.keys(DUEL_LOOKS).sort()).toEqual([...STYLES].sort());
    for (const style of STYLES) {
      const look = DUEL_LOOKS[style];
      const file = path.join(duelLooksFolder(), look.file);
      expect(existsSync(file), style).toBe(true);
      const meta = await sharp(file).metadata();
      expect([meta.width, meta.height], `${style} size`).toEqual([look.width, look.height]);
      // A duel loads at most about 340 KB of images: no light copy is heavier than 216 KB.
      expect(statSync(file).size, style).toBeLessThan(220 * 1024);
    }
  });

  it("no two styles share a file", () => {
    const files = STYLES.map((style) => DUEL_LOOKS[style].file);
    expect(new Set(files).size).toBe(STYLES.length);
  });

  it("the address of a look carries only the alternative id", () => {
    expect(duelLookPath(ID)).toBe(`/api/diagnostico/duel-look/${ID}`);
    for (const style of STYLES) {
      const image = duelLookImage(ID, style)!;
      expect(image.src).toBe(duelLookPath(ID));
      expect(image.width).toBe(DUEL_LOOKS[style].width);
      expect(image.height).toBe(DUEL_LOOKS[style].height);
      expect(JSON.stringify(image)).not.toMatch(/esportivo|tradicional|elegante|romantico|criativo|dramatico|\.jpg|\.png/i);
    }
  });

  it("reads the bytes of a light copy", async () => {
    const bytes = await readDuelLook("elegante");
    expect(bytes).not.toBeNull();
    expect(bytes!.length).toBe(statSync(path.join(duelLooksFolder(), DUEL_LOOKS.elegante.file)).size);
  });
});
