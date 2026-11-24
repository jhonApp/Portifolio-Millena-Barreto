import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import LoadingLine from "@/components/Diagnostico/LoadingLine";
import QuestionTransition from "@/components/Diagnostico/QuestionTransition";
import {
  CHAPTER_ADVANCE_MS,
  QUESTION_TRANSITION_LABEL,
  QUESTION_TRANSITION_MS,
} from "@/lib/diagnostico/loading";

describe("the question transition", () => {
  it("QUESTION_TRANSITION_MS is 500", () => {
    expect(QUESTION_TRANSITION_MS).toBe(500);
  });

  it('the label is "Carregando próxima pergunta…"', () => {
    expect(QUESTION_TRANSITION_LABEL).toBe("Carregando próxima pergunta…");
  });

  it("the fixed waiting of a full attempt is at most 12 s", () => {
    const total = 12 * QUESTION_TRANSITION_MS + 3 * CHAPTER_ADVANCE_MS;
    expect(total).toBeLessThanOrEqual(12000);
  });

  it("the RF-01 to RF-03 hand-off: the transition is the real loading line with 500 ms and its text", () => {
    const element = QuestionTransition();
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(LoadingLine);
    expect(element.props).toMatchObject({
      durationMs: 500,
      label: "Carregando próxima pergunta…",
      reduceMotion: false,
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('data-testid="loading-line"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Carregando próxima pergunta…");
  });
});
