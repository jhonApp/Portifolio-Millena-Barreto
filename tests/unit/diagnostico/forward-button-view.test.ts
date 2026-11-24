import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ForwardButton from "@/components/Diagnostico/ForwardButton";
import SavingIndicator from "@/components/Diagnostico/SavingIndicator";

type Props = { label?: string; saving?: boolean; disabled?: boolean; reduceMotion?: boolean };

const render = ({ label = "Próxima", saving = false, disabled = false, reduceMotion = false }: Props = {}) =>
  renderToStaticMarkup(createElement(ForwardButton, { label, saving, disabled, reduceMotion, onClick: () => {} }));

/** The markup of one slot (label, reserved or saving) with its class list. */
const slot = (html: string, name: string) => html.match(new RegExp(`<span[^>]*data-slot="${name}"[^>]*>`, "g")) ?? [];

describe("the forward button", () => {
  it('shows the spinner and "Salvando…" and is disabled while saving', () => {
    const html = render({ saving: true, disabled: true });
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain('data-saving="true"');
    expect(html).toContain("Salvando…");
    expect(html).toContain('data-variant="spinner"');
    // The saving slot is on display; the normal label is hidden and not read.
    const [saving] = slot(html, "saving");
    expect(saving).not.toContain("invisible");
    expect(saving).not.toContain("aria-hidden");
    const [label] = slot(html, "label");
    expect(label).toContain("invisible");
    expect(label).toContain('aria-hidden="true"');
  });

  it("shows the normal label, enabled, when it is not saving", () => {
    const html = render({ label: "Próxima" });
    // The class "disabled:opacity-50" is not the attribute.
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain('data-saving="false"');
    const [label] = slot(html, "label");
    expect(label).not.toContain("invisible");
    const [saving] = slot(html, "saving");
    expect(saving).toContain("invisible");
    expect(saving).toContain('aria-hidden="true"');
    expect(render({ label: "Concluir" })).toMatch(/data-slot="label"[^>]*>Concluir</);
  });

  it("shows the normal label, disabled, when not saving and not allowed", () => {
    const html = render({ disabled: true });
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain('data-saving="false"');
    const [label] = slot(html, "label");
    expect(label).not.toContain("invisible");
    expect(slot(html, "saving")[0]).toContain("invisible");
  });

  it("reserves the width of every label so the size does not change", () => {
    for (const label of ["Próxima", "Concluir"]) {
      for (const saving of [false, true]) {
        const html = render({ label, saving });
        // All three texts are always in the markup, in one grid cell.
        for (const text of ["Próxima", "Concluir", "Salvando…"]) expect(html, `${label} ${saving} ${text}`).toContain(text);
        expect(html.match(/col-start-1 row-start-1/g)).toHaveLength(3);
        // Exactly one slot is on display; the other two are invisible.
        expect(html.match(/invisible/g)).toHaveLength(2);
      }
    }
  });

  it("three static dots replace the spinner under reduced motion", () => {
    const still = render({ saving: true, reduceMotion: true });
    expect(still).toContain('data-variant="dots"');
    expect(still).not.toContain("animate-spin");
    expect(still.match(/rounded-full bg-current/g)).toHaveLength(3);
    expect(still).toContain("Salvando…");
    const moving = render({ saving: true });
    expect(moving).toContain("animate-spin");
    expect(moving).not.toContain('data-variant="dots"');
  });

  it("the indicator is hidden from assistive technology", () => {
    for (const reduceMotion of [false, true]) {
      const html = renderToStaticMarkup(createElement(SavingIndicator, { reduceMotion }));
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toMatch(/role=|aria-label/);
    }
  });
});
