import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChapterScreen from "@/components/Diagnostico/ChapterScreen";
import { CHAPTERS } from "@/lib/diagnostico/chapters";
import { STYLES } from "@/lib/diagnostico/constants";

const render = (number: 1 | 2 | 3, reduceMotion = false) =>
  renderToStaticMarkup(createElement(ChapterScreen, { chapter: CHAPTERS[number - 1], reduceMotion, onDone: () => {} }));

describe("the chapter screen", () => {
  it("shows the badge, the message and the loading line, with no button", () => {
    const html = render(1);
    expect(html).toContain("Selo Rotina");
    expect(html).toContain("Capítulo 1 completo! Já estou vendo um traço do seu estilo…");
    expect(html).toContain('data-testid="loading-line"');
    expect(html).toContain("Preparando a próxima etapa…");
    expect(html).not.toContain("Continuar");
    expect(html).not.toContain("<button");
    expect(render(2)).toContain("Selo Ocasiões");
    expect(render(3)).toContain("Selo Desejos");
  });

  it("is a region named by the badge, with a title that can take the focus and no Anterior", () => {
    const html = render(2);
    expect(html).toContain('aria-labelledby="chapter-2-title"');
    expect(html).toContain('id="chapter-2-title"');
    expect(html).toContain('tabindex="-1"');
    expect(html).not.toContain("Anterior");
  });

  it("has no interactive element besides the focusable title", () => {
    for (const number of [1, 2, 3] as const) {
      const html = render(number);
      expect(html).not.toMatch(/<(button|a|input|select|textarea)[\s>]/);
      expect(html).not.toMatch(/onclick|href=/i);
      // The only focusable thing is the title (tabindex -1).
      expect(html.match(/tabindex="/g)).toHaveLength(1);
    }
  });

  it("has no style name, percentage or score", () => {
    for (const number of [1, 2, 3] as const) {
      const text = render(number).replace(/<[^>]*>/g, " ").toLowerCase();
      for (const style of STYLES) expect(text).not.toContain(style.replace("_", " "));
      expect(text).not.toMatch(/\d+\s*%|pontos|score/);
    }
  });

  it("no animation is applied when reduced motion is set", () => {
    const still = render(1, true);
    expect(still).toContain('data-animated="false"');
    expect(still).not.toMatch(/opacity:\s*0/);
    expect(still).not.toContain("scale(");
    const animated = render(1, false);
    expect(animated).toContain('data-animated="true"');
    expect(animated).toMatch(/opacity:\s*0/);
  });

  it("the loading line is static under reduced motion", () => {
    const still = render(1, true);
    // Both the badge and the line are drawn without animation.
    expect(still.match(/data-animated="false"/g)).toHaveLength(2);
    expect(still).not.toContain('data-animated="true"');
    expect(still).not.toContain("scaleX(0)");
    expect(still).toContain("Preparando a próxima etapa…");
    const animated = render(1, false);
    expect(animated.match(/data-animated="true"/g)).toHaveLength(2);
    expect(animated).toContain("scaleX(0)");
  });
});
