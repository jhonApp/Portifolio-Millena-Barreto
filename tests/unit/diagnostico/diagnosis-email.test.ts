import { describe, expect, it } from "vitest";
import {
  EMAIL_BUTTON,
  EMAIL_SUBJECT,
  escapeHtml,
  renderDiagnosisEmail,
  shortResultText,
} from "@/lib/diagnostico/diagnosis-email";

const INPUT = {
  firstName: "Maria",
  predominantLabel: "Elegante",
  secondaryLabel: "Romântico",
  resultText: "Você busca refinamento e sofisticação em cada detalhe. Sua imagem comunica classe e segurança.",
  link: "http://localhost:3001/diagnostico-estilo/resultado/abc123",
};

describe("diagnosis e-mail template", () => {
  it("the subject is Seu diagnóstico de estilo chegou!", () => {
    expect(renderDiagnosisEmail(INPUT).subject).toBe("Seu diagnóstico de estilo chegou!");
    expect(EMAIL_SUBJECT).toBe("Seu diagnóstico de estilo chegou!");
  });

  it("the html and the text contain the first name both styles and the link", () => {
    const { html, text } = renderDiagnosisEmail(INPUT);
    for (const part of ["Maria", "Elegante", "Romântico", INPUT.link]) {
      expect(html).toContain(part);
      expect(text).toContain(part);
    }
  });

  it("the button text is Ver meu diagnóstico completo", () => {
    expect(EMAIL_BUTTON).toBe("Ver meu diagnóstico completo");
    expect(renderDiagnosisEmail(INPUT).html).toContain("Ver meu diagnóstico completo");
    expect(renderDiagnosisEmail(INPUT).html).toContain(`href="${INPUT.link}"`);
  });

  it("the text version has no html and carries the link", () => {
    const { text } = renderDiagnosisEmail(INPUT);
    expect(text).not.toMatch(/<[a-z][^>]*>/i);
    expect(text).toContain(INPUT.link);
  });

  it("a name with special characters is escaped in the html", () => {
    const { html } = renderDiagnosisEmail({ ...INPUT, firstName: '<script>alert("x")</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(escapeHtml("a & b < c")).toBe("a &amp; b &lt; c");
  });

  it("declares utf-8 so accents show when the file is opened directly", () => {
    expect(renderDiagnosisEmail(INPUT).html).toContain('<meta charset="utf-8">');
  });

  it("uses the site colors", () => {
    const { html } = renderDiagnosisEmail(INPUT);
    for (const color of ["#10151f", "#937dad", "#ffffff"]) expect(html).toContain(color);
  });

  it("shortResultText cuts at a sentence end within the limit", () => {
    const long = `${"Primeira frase completa com bastante texto. ".repeat(4)}Esta frase final passa do limite de caracteres permitido no e-mail e deve ficar de fora.`;
    const short = shortResultText(long, 100);
    expect(short.length).toBeLessThanOrEqual(100);
    expect(short.endsWith(".")).toBe(true);
  });

  it("shortResultText keeps a short paragraph whole and cuts a long one at a word", () => {
    expect(shortResultText("Texto curto.")).toBe("Texto curto.");
    const noSentence = "palavra ".repeat(60);
    const cut = shortResultText(noSentence, 50);
    expect(cut.length).toBeLessThanOrEqual(51);
    expect(cut.endsWith("…")).toBe(true);
  });
});
