import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Questionnaire from "@/components/Diagnostico/Questionnaire";
import type { QuestionnaireInitialState } from "@/lib/diagnostico/questionnaire-page";
import type { SavedChoice } from "@/lib/diagnostico/questionnaire-state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }) }));

const HINT = "Se mais de uma opção combina com você, escolha uma segunda. É opcional.";

function build(maxChoices: 1 | 2, choice?: SavedChoice): QuestionnaireInitialState {
  const questions = Array.from({ length: 15 }, (_, index) => ({
    id: `q${index + 1}`,
    position: index + 1,
    text: `Pergunta ${index + 1}`,
    maxChoices,
    kind: "choice" as const,
    chapter: null,
    alternatives: [1, 2, 3, 4].map((n) => ({ id: `q${index + 1}a${n}`, text: `Alternativa ${n}` })),
  }));
  const choices = choice ? { q1: choice } : {};
  return {
    questionSet: { versionId: "v", version: 2, questions },
    answers: choice ? { q1: choice.first } : {},
    choices,
    startIndex: 0,
  };
}

const render = (initial: QuestionnaireInitialState) => renderToStaticMarkup(createElement(Questionnaire, { initial }));

describe("the questionnaire screen with two choices", () => {
  it('a saved first choice shows "1ª escolha"', () => {
    const html = render(build(2, { first: "q1a2", second: null }));
    expect(html).toContain("1ª escolha");
    expect(html).not.toContain("2ª escolha");
    expect(html.match(/1ª escolha/g)).toHaveLength(1);
  });

  it('a saved second choice shows "2ª escolha" on its own card', () => {
    const html = render(build(2, { first: "q1a2", second: "q1a4" }));
    expect(html.match(/1ª escolha/g)).toHaveLength(1);
    expect(html.match(/2ª escolha/g)).toHaveLength(1);
    // Both selected cards are marked as checked, the others are not.
    expect(html.match(/checked=""/g)).toHaveLength(2);
  });

  it("the optional hint is under the alternatives of a two-choice question", () => {
    const html = render(build(2));
    expect(html).toContain(HINT);
    expect(html).toContain('role="group"');
    expect(html).not.toContain("1ª escolha");
    // The cards stay at least 56 px tall and are labelled by their text.
    expect(html).toContain("min-h-[56px]");
  });

  it("a single-choice question is unchanged: radio group, no labels, no hint", () => {
    const html = render(build(1, { first: "q1a2", second: null }));
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('type="radio"');
    expect(html).not.toContain(HINT);
    expect(html).not.toContain("1ª escolha");
    expect(html).not.toContain("2ª escolha");
    expect(html).not.toContain('type="checkbox"');
  });

  it("never shows a style name or a point value", () => {
    const html = render(build(2, { first: "q1a1", second: "q1a2" })).toLowerCase();
    for (const word of ["elegante", "romântico", "romantico", "dramático", "criativo", "tradicional", "esportivo", "pontos"]) {
      expect(html, word).not.toContain(word);
    }
  });

  it('keeps "Próxima" disabled until the first choice is saved on the server', () => {
    const html = render(build(2));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*?data-slot="label"[^>]*>Próxima</);
  });

  it("a version 1 question set keeps the plain forward button", () => {
    const initial = build(2);
    const html = render({ ...initial, questionSet: { ...initial.questionSet, version: 1 } });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Próxima<\/button>/);
    expect(html).not.toContain("Salvando");
    expect(html).not.toContain('data-slot="saving"');
  });

  it("a version 2 question set renders the forward button with its reserved labels", () => {
    const html = render(build(2));
    expect(html).toContain('data-slot="saving"');
    for (const text of ["Próxima", "Concluir", "Salvando…"]) expect(html).toContain(text);
    expect(html).toContain('data-saving="false"');
  });
});
