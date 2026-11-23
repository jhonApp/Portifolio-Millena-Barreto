import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LookProgress from "@/components/Diagnostico/LookProgress";

const steps = Array.from({ length: 15 }, (_, i) => ({ id: `q${i + 1}`, chapter: Math.floor(i / 5) + 1 }));
const savedUpTo = (count: number) => Object.fromEntries(steps.slice(0, count).map((step) => [step.id, { first: "a", second: null }]));
const render = (saved: Record<string, unknown>, currentIndex: number, list: readonly { id: string; chapter: number | null }[] = steps) =>
  renderToStaticMarkup(createElement(LookProgress, { steps: list, saved, currentIndex, transitionMs: 300 }));

describe("look progress", () => {
  it("7 saved steps give 7 filled segments, the first group complete and its piece drawn", () => {
    const html = render(savedUpTo(7), 7);
    expect(html.match(/data-filled="true"/g)).toHaveLength(7);
    expect(html.match(/<li /g)).toHaveLength(15);
    expect(html).toContain('data-chapter="1" data-complete="true"');
    expect(html).toContain('data-chapter="2" data-complete="false"');
    expect(html).toContain('data-piece="top" data-complete="true"');
    expect(html).toContain('data-piece="bottom" data-complete="false"');
    expect(html).toContain('data-piece="accessory" data-complete="false"');
  });

  it("shows Capítulo N de 3 as text next to Pergunta N de 15", () => {
    const html = render(savedUpTo(5), 5);
    expect(html).toContain("Pergunta 6 de 15");
    expect(html).toContain("Capítulo 2 de 3");
    expect(render({}, 0)).toContain("Capítulo 1 de 3");
  });

  it("the segments have accessible names and the groups carry the chapter name", () => {
    const html = render(savedUpTo(5), 5);
    expect(html).toContain('aria-label="Passo 3, respondido"');
    expect(html).toContain('aria-label="Passo 6, atual"');
    expect(html).toContain('aria-label="Passo 9, pendente"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('aria-label="Seu dia a dia, completo"');
    expect(html).toContain('aria-label="Suas ocasiões, incompleto"');
    expect(html).toContain('aria-label="Seus desejos, incompleto"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="6"');
    expect(html).toContain('aria-valuemax="15"');
  });

  it("going back keeps the pieces and the segments of what is saved", () => {
    const html = render(savedUpTo(10), 2);
    expect(html.match(/data-filled="true"/g)).toHaveLength(10);
    expect(html).toContain('data-piece="top" data-complete="true"');
    expect(html).toContain('data-piece="bottom" data-complete="true"');
    expect(html).toContain('data-piece="accessory" data-complete="false"');
  });

  it("a question set without chapters renders the original single bar", () => {
    const plain = steps.map((step) => ({ ...step, chapter: null }));
    const html = render(savedUpTo(7), 7, plain);
    expect(html).toContain("Pergunta 8 de 15");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("width:53.33%");
    expect(html).not.toContain("Capítulo");
    expect(html).not.toContain("data-piece");
    expect(html).not.toContain("<li");
    expect(html).not.toContain("look-progress");
  });
});
