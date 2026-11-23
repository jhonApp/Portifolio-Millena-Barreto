import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DuelStep from "@/components/Diagnostico/DuelStep";
import Questionnaire from "@/components/Diagnostico/Questionnaire";
import type { QuestionnaireInitialState } from "@/lib/diagnostico/questionnaire-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }) }));

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

function duel(withImages = true) {
  return {
    id: "duel-q",
    position: 5,
    text: "Qual look combina mais com você?",
    maxChoices: 1 as const,
    kind: "duel" as const,
    chapter: 1 as const,
    alternatives: [
      { id: ID_A, text: "Look A", ...(withImages ? { image: { src: `/api/diagnostico/duel-look/${ID_A}`, width: 765, height: 1360 } } : {}) },
      { id: ID_B, text: "Look B", ...(withImages ? { image: { src: `/api/diagnostico/duel-look/${ID_B}`, width: 500, height: 750 } } : {}) },
    ],
  };
}

const render = (chosen?: { first: string; second: string | null }, withImages = true) =>
  renderToStaticMarkup(createElement(DuelStep, { question: duel(withImages), chosen, onChoose: () => {} }));

describe("the duel step", () => {
  it("a duel renders a radio group with two options", () => {
    const html = render();
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-labelledby="question-duel-q"');
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("Look A");
    expect(html).toContain("Look B");
  });

  it("each look has the neutral alt text and a radio input with its name", () => {
    const html = render();
    expect(html).toContain('alt="Look de referência A"');
    expect(html).toContain('alt="Look de referência B"');
    expect(html).toContain('aria-label="Look de referência A"');
    expect(html.match(/name="question-duel-q"/g)).toHaveLength(2);
    expect(html).toContain(`src="/api/diagnostico/duel-look/${ID_A}"`);
  });

  it("the selected look shows the checkmark and the checked state", () => {
    const none = render();
    expect(none).not.toContain("✓");
    expect(none).not.toContain('checked=""');
    const html = render({ first: ID_B, second: null });
    expect(html.match(/✓/g)).toHaveLength(1);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain("border-2 border-accent");
    // The checked input is the second look.
    const inputs = html.match(/<input[^>]*>/g) ?? [];
    const checked = inputs.filter((input) => input.includes('checked=""'));
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain(`value="${ID_B}"`);
  });

  it("the markup has no style name", () => {
    const html = render({ first: ID_A, second: null }).toLowerCase();
    for (const word of ["esportivo", "natural", "tradicional", "elegante", "romantico", "romântico", "criativo", "dramatico", "dramático", ".jpg", ".png"]) {
      expect(html, word).not.toContain(word);
    }
  });

  it("the looks are stacked below 480 px and the image keeps its ratio without object-cover", () => {
    const html = render();
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("min-[480px]:grid-cols-2");
    expect(html).not.toContain("object-cover");
    expect(html).not.toContain("object-fill");
    expect(html).toContain('width="765"');
    expect(html).toContain('height="1360"');
    expect(html).toContain("aspect-ratio:765 / 1360");
    expect(html).toContain("aspect-ratio:500 / 750");
    expect(html).toContain("h-auto w-full");
    // A touch area of at least 48 px in the smaller dimension.
    expect(html).toContain("min-h-[56px]");
  });

  it("a look without an image shows the neutral block and stays selectable", () => {
    const html = render(undefined, false);
    expect(html).not.toContain("<img");
    expect(html.match(/data-testid="look-placeholder"/g)).toHaveLength(2);
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).toContain("Look A");
  });
});

describe("the questionnaire screen at a duel step", () => {
  function state(): QuestionnaireInitialState {
    const regular = Array.from({ length: 14 }, (_, index) => ({
      id: `r${index + 1}`,
      position: index + 1 >= 5 ? index + 2 : index + 1,
      text: `Pergunta ${index + 1}`,
      maxChoices: 2 as const,
      kind: "choice" as const,
      chapter: 1 as const,
      alternatives: [1, 2, 3, 4].map((n) => ({ id: `r${index + 1}a${n}`, text: `Alternativa ${n}` })),
    }));
    const questions = [...regular.slice(0, 4), duel(), ...regular.slice(4)];
    return {
      questionSet: { versionId: "v2", version: 2, questions },
      answers: {},
      choices: { "duel-q": { first: ID_A, second: null } },
      startIndex: 4,
    };
  }

  it("shows the duel with its saved look selected, and no multi-choice hint", () => {
    const html = renderToStaticMarkup(createElement(Questionnaire, { initial: state() }));
    expect(html).toContain("Pergunta 5 de 15");
    expect(html).toContain("Qual look combina mais com você?");
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/✓/g)).toHaveLength(1);
    expect(html).not.toContain("Se mais de uma opção combina");
    expect(html).not.toContain("1ª escolha");
    // The forward button is enabled: the choice is already saved on the server.
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Próxima<\/button>/);
  });

  it("keeps Próxima disabled while the duel has no saved choice", () => {
    const initial = state();
    initial.choices = {};
    const html = renderToStaticMarkup(createElement(Questionnaire, { initial }));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Próxima<\/button>/);
  });
});
