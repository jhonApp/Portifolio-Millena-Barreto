import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STYLES } from "@/lib/diagnostico/constants";
import { STYLE_IMAGES, styleImageFor } from "@/lib/diagnostico/style-images";

describe("style images", () => {
  it("every style has an entry", () => {
    expect(Object.keys(STYLE_IMAGES).sort()).toEqual([...STYLES].sort());
  });

  it("every image that is set points to a file in public", () => {
    for (const style of STYLES) {
      const src = styleImageFor(style);
      if (src === null) continue; // no image yet: the screen shows the reserved block
      expect(src.startsWith("/")).toBe(true);
      expect(existsSync(path.join(process.cwd(), "public", src)), `${style}: ${src}`).toBe(true);
    }
  });

  it("two styles never share an image", () => {
    const set = Object.values(STYLE_IMAGES).filter((src): src is string => src !== null);
    expect(new Set(set).size).toBe(set.length);
  });
});
