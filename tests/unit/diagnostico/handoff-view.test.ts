import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import CheckoutLink from "@/components/Diagnostico/CheckoutLink";
import { HandoffError, HandoffLoading } from "@/components/Diagnostico/HandoffScreen";
import LoadingLine from "@/components/Diagnostico/LoadingLine";
import { HANDOFF_CHECKOUT_LABEL, HANDOFF_COMPLETION_LABEL, HANDOFF_ERROR_MESSAGE } from "@/lib/diagnostico/loading";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }) }));

describe("the hand-off screens", () => {
  it("CheckoutLink renders a link to the checkout with the original look", () => {
    const html = renderToStaticMarkup(createElement(CheckoutLink));
    expect(html).toMatch(/<a [^>]*href="\/diagnostico-estilo\/checkout"/);
    expect(html).toContain("btn btn-accent mt-8 w-full text-center text-sm font-semibold uppercase tracking-wider");
    expect(html).toContain("RECEBER MEU DIAGNÓSTICO");
    expect(html).not.toContain("Preparando");
    expect(html).not.toContain("loading-line");
  });

  it("HandoffLoading shows the label as a status with the line", () => {
    const html = renderToStaticMarkup(createElement(HandoffLoading, { label: HANDOFF_COMPLETION_LABEL, reduceMotion: false }));
    expect(html).toContain('data-testid="loading-line"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Preparando seu diagnóstico…");
    expect(html).toContain('data-end="0.9"');
    expect(html).not.toMatch(/\d+\s*%/);
    expect(html).not.toContain("<button");
  });

  it("HandoffLoading is the static line under reduced motion", () => {
    for (const label of [HANDOFF_COMPLETION_LABEL, HANDOFF_CHECKOUT_LABEL]) {
      const html = renderToStaticMarkup(createElement(HandoffLoading, { label, reduceMotion: true }));
      expect(html).toContain('data-animated="false"');
      expect(html).not.toContain("scaleX(0)");
      expect(html).toContain(label);
    }
  });

  it("HandoffError shows the message and Tentar novamente", () => {
    const html = renderToStaticMarkup(createElement(HandoffError, { onRetry: () => {} }));
    expect(html).toContain('role="alert"');
    expect(html).toContain(HANDOFF_ERROR_MESSAGE);
    expect(html).toContain("Não conseguimos abrir a próxima etapa. Suas respostas estão salvas.");
    expect(html).toMatch(/<button[^>]*>Tentar novamente<\/button>/);
  });

  it("the RF-01 to RF-04 hand-off: the hand-off screen is the real loading line, static under reduced motion", () => {
    const screen = HandoffLoading({ label: HANDOFF_CHECKOUT_LABEL, reduceMotion: false });
    expect(isValidElement(screen)).toBe(true);
    // The screen wraps the line: the only child is the real LoadingLine element.
    const line = (screen.props as { children: { type: unknown; props: Record<string, unknown> } }).children;
    expect(line.type).toBe(LoadingLine);
    expect(line.props).toMatchObject({ durationMs: 8000, endAt: 0.9, label: "Preparando seu Pix…", reduceMotion: false });
    const still = renderToStaticMarkup(HandoffLoading({ label: HANDOFF_CHECKOUT_LABEL, reduceMotion: true }));
    expect(still).toContain('data-animated="false"');
    expect(still).toContain("Preparando seu Pix…");
  });
});
