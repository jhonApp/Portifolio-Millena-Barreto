import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LoadingLine from "@/components/Diagnostico/LoadingLine";

const render = (props: { endAt?: number; reduceMotion?: boolean } = {}) =>
  renderToStaticMarkup(
    createElement(LoadingLine, { label: "Preparando a próxima etapa…", durationMs: 2000, reduceMotion: false, ...props }),
  );

describe("the loading line", () => {
  it("the label is a status and shows no percentage", () => {
    const html = render();
    expect(html).toContain('role="status"');
    expect(html).toContain("Preparando a próxima etapa…");
    expect(html).not.toContain("progressbar");
    expect(html).not.toMatch(/\d+\s*%/);
    // The line itself is decoration: only the text is read.
    expect(html).toContain('aria-hidden="true"');
  });

  it("an animated line grows to the end fraction", () => {
    const html = render();
    expect(html).toContain('data-animated="true"');
    expect(html).toContain('data-end="1"');
    expect(html).toContain("scaleX(0)");
    expect(render({ endAt: 0.9 })).toContain('data-end="0.9"');
  });

  it("a static line is drawn full without animation", () => {
    const html = render({ reduceMotion: true });
    expect(html).toContain('data-animated="false"');
    // Scale 1 is the identity: the line is drawn at its full width, not collapsed to scaleX(0).
    expect(html).toContain("transform:none");
    expect(html).not.toContain("scaleX(0)");
    expect(html).toContain("Preparando a próxima etapa…");
  });

  it("endAt is clamped to 0..1", () => {
    expect(render({ endAt: 1.7 })).toContain('data-end="1"');
    expect(render({ endAt: -2 })).toContain('data-end="0"');
  });
});
