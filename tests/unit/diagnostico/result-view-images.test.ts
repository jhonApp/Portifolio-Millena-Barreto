import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResultView from "@/components/Diagnostico/ResultView";
import type { DiagnosisContent } from "@/lib/diagnostico/schemas/diagnosis-content";
import { resultImagesFor, type ResultImages } from "@/lib/diagnostico/style-images";

const content: DiagnosisContent = {
  contentVersionId: "v1",
  customer: { firstName: "Maria", deliveryPreference: "both" },
  predominant: { style: "romantico", label: "Romântico", percent: 40 },
  secondary: { style: "dramatico", label: "Dramático", percent: 27 },
  percentages: { esportivo_natural: 7, tradicional: 7, elegante: 7, romantico: 40, criativo: 12, dramatico: 27 },
  blocks: [
    {
      id: "result",
      title: "Seu resultado",
      paragraphs: ["Maria, o seu estilo predominante é o Romântico.", "O seu segundo estilo é o Dramático.", "Os dois se encontram."],
    },
    { id: "pieces", title: "Peças que combinam com você", intro: "Intro das peças.", items: ["a", "b", "c", "d"] },
    { id: "accessories", title: "Acessórios e complementos", intro: "Intro dos acessórios.", items: ["e", "f", "g"] },
    { id: "guidance", title: "Uma orientação especial", paragraphs: ["Maria, uma orientação."] },
  ],
};

const render = (images: ResultImages) =>
  renderToStaticMarkup(createElement(ResultView, { token: "t", content, hasPdf: true, images }));

const imgTags = (html: string) => html.match(/<img[^>]*>/g) ?? [];
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];

describe("the images of the result screen", () => {
  it("shows the predominant and the secondary image, each with a descriptive alt", () => {
    const tags = imgTags(render(resultImagesFor("romantico", "dramatico")));
    expect(tags).toHaveLength(2);
    expect(attr(tags[0], "alt")).toBe("Look de referência do estilo Romântico, o seu estilo predominante");
    expect(attr(tags[1], "alt")).toBe("Look de referência do estilo Dramático, o seu segundo estilo");
  });

  it("every image has a non-empty alt", () => {
    for (const tag of imgTags(render(resultImagesFor("romantico", "dramatico")))) {
      expect((attr(tag, "alt") ?? "").length).toBeGreaterThan(10);
    }
  });

  it("the predominant image loads at once and the others lazily", () => {
    const [first, ...rest] = imgTags(render(resultImagesFor("romantico", "dramatico")));
    expect(first).not.toContain('loading="lazy"');
    expect(rest.length).toBeGreaterThan(0);
    for (const tag of rest) expect(tag).toContain('loading="lazy"');
  });

  it("an image is shown whole: it carries the file size for its aspect ratio and is never forced into a crop", () => {
    const images = resultImagesFor("romantico", "dramatico");
    const [first, second] = imgTags(render(images));
    expect(attr(first, "width")).toBe(String(images.predominant!.width));
    expect(attr(first, "height")).toBe(String(images.predominant!.height));
    expect(attr(second, "width")).toBe(String(images.secondary!.width));
    expect(first).not.toContain("object-cover");
    expect(second).not.toContain("object-cover");
  });

  it("without any image the screen still shows the style name in a reserved block", () => {
    const html = render({ predominant: null, secondary: null, pieces: null, accessories: null });
    expect(imgTags(html)).toHaveLength(0);
    expect(html).toContain("Seu estilo predominante");
    expect(html).toContain("Romântico");
    expect(html).toContain("O seu segundo estilo é o Dramático.");
  });

  it("a missing secondary image leaves the paragraph in place", () => {
    const html = render({ ...resultImagesFor("romantico", "dramatico"), secondary: null });
    expect(imgTags(html)).toHaveLength(1);
    expect(html).toContain("O seu segundo estilo é o Dramático.");
  });

  it("the reserved slots of pieces and accessories show an image when one is supplied", () => {
    const base = resultImagesFor("romantico", "dramatico");
    const slot = { src: "/assets/diagnostic/romantico-pecas.jpg", width: 800, height: 1000 };
    const tags = imgTags(
      render({ ...base, pieces: slot, accessories: { ...slot, src: "/assets/diagnostic/romantico-acessorios.jpg" } }),
    );
    expect(tags).toHaveLength(4);
    expect(attr(tags[2], "alt")).toBe("Peças de referência do estilo Romântico");
    expect(attr(tags[3], "alt")).toBe("Acessórios de referência do estilo Romântico");
    expect(tags[2]).toContain('loading="lazy"');
    expect(tags[3]).toContain('loading="lazy"');
  });

  it("with no slot images (today) the screen has exactly the two style images", () => {
    expect(imgTags(render(resultImagesFor("elegante", "tradicional")))).toHaveLength(2);
  });
});
