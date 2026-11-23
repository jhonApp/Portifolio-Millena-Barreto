import { describe, expect, it } from "vitest";
import { CHAPTERS, CHAPTER_COUNT, chapterFor } from "@/lib/diagnostico/chapters";
import { STYLES } from "@/lib/diagnostico/constants";

describe("chapters", () => {
  it("there are exactly 3 chapters with names and badges as in the PRD", () => {
    expect(CHAPTER_COUNT).toBe(3);
    expect(CHAPTERS.map((chapter) => chapter.number)).toEqual([1, 2, 3]);
    expect(CHAPTERS.map((chapter) => chapter.name)).toEqual(["Seu dia a dia", "Suas ocasiões", "Seus desejos"]);
    expect(CHAPTERS.map((chapter) => chapter.badge)).toEqual(["Selo Rotina", "Selo Ocasiões", "Selo Desejos"]);
    expect(CHAPTERS.map((chapter) => chapter.piece)).toEqual(["top", "bottom", "accessory"]);
    expect(chapterFor(2)?.badge).toBe("Selo Ocasiões");
    expect(chapterFor(4)).toBeUndefined();
  });

  it("no chapter message names a style, a percentage or a score", () => {
    for (const chapter of CHAPTERS) {
      for (const text of [chapter.message, chapter.name, chapter.badge]) {
        for (const style of STYLES) expect(text.toLowerCase()).not.toContain(style.replace("_", " "));
        expect(text).not.toMatch(/\d+\s*%|pontos?|pontua|score|resultado/i);
        // The only digit allowed is the chapter number.
        expect(text.replace(`Capítulo ${chapter.number}`, "")).not.toMatch(/\d/);
      }
    }
  });

  it("the messages are constants, the same for any input", () => {
    const first = CHAPTERS.map((chapter) => chapter.message);
    const again = [1, 2, 3].map((number) => chapterFor(number)!.message);
    expect(again).toEqual(first);
    expect(first).toEqual([
      "Capítulo 1 completo! Já estou vendo um traço do seu estilo…",
      "Capítulo 2 completo! Falta só mais um.",
      "Capítulo 3 completo! Seu diagnóstico está quase pronto.",
    ]);
  });
});
