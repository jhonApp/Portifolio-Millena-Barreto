import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { CONSULTANCY_CTA } from "./consultancy-cta";
import { STYLES, STYLE_LABELS, type Style } from "./constants";
import type { DiagnosisContent } from "./schemas/diagnosis-content";

// The PDF of the diagnosis: A4, eight parts in the order of the PRD (RF-07), with the colors and
// fonts of the site (tokens #10151f, #475467, #937dad; Bebas Neue for headings, Inter for text).

export const PDF_COLORS = { primary: "#10151f", secondary: "#475467", accent: "#937dad", white: "#ffffff" } as const;

// Titles of the parts. The tests look for them in this order.
export const PART_TITLES = {
  predominant: "Seu estilo predominante",
  secondary: "Seu estilo secundário",
  numbers: "Seus estilos em números",
  pieces: "Peças que combinam com você",
  combinations: "Combinações para o seu dia a dia",
  guidance: "Uma orientação especial",
  closing: "Com carinho,",
} as const;

/**
 * The light editorial copy of a style image (assets/pdf-images/<style>.jpg, built by
 * scripts/generate-pdf-images.mjs from the owner's images). A style whose file is missing has no image:
 * the PDF still renders, so a missing file never fails a paid diagnosis.
 */
export function pdfStyleImage(style: Style, dir: string = defaultImagesDir()): string | null {
  const file = path.join(dir, `${style}.jpg`);
  return existsSync(file) ? file : null;
}

/** The optional photo of pieces or accessories of a style (<style>-pecas.jpg, <style>-acessorios.jpg); null until the owner sends it. */
export function pdfSlotImage(style: Style, slot: "pecas" | "acessorios", dir: string = defaultImagesDir()): string | null {
  const file = path.join(dir, `${style}-${slot}.jpg`);
  return existsSync(file) ? file : null;
}

function defaultImagesDir(): string {
  return path.join(process.cwd(), "assets", "pdf-images");
}

/** The bytes are passed, not the path: a Windows path is read as a URL by the image loader. */
function imageSource(file: string) {
  return { data: readFileSync(file), format: "jpg" as const };
}

let fontsRegistered = false;

export function registerPdfFonts(): void {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "assets", "pdf-fonts");
  Font.register({ family: "Bebas Neue", src: path.join(dir, "BebasNeue-Regular.ttf") });
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "Inter-400.woff"), fontWeight: 400 },
      { src: path.join(dir, "Inter-600.woff"), fontWeight: 600 },
    ],
  });
  // No automatic hyphenation: Portuguese words stay whole.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: { backgroundColor: PDF_COLORS.white, padding: 56, fontFamily: "Inter", fontSize: 13.5, color: PDF_COLORS.secondary, lineHeight: 1.7 },
  coverPage: { backgroundColor: PDF_COLORS.primary, color: PDF_COLORS.white },
  // The padding sits on an inner view, so the full-page photo is measured against the whole page.
  cover: { height: 841, padding: 56, justifyContent: "space-between" },
  kicker: { fontFamily: "Inter", fontWeight: 600, fontSize: 10, letterSpacing: 3, color: PDF_COLORS.accent, textTransform: "uppercase" },
  coverTitle: { fontFamily: "Bebas Neue", fontSize: 54, lineHeight: 1.05, color: PDF_COLORS.white },
  // The name is set in Inter: the heading font maps some capitals wrongly in the text layer (search and copy).
  coverName: { fontFamily: "Inter", fontWeight: 600, fontSize: 24, letterSpacing: 1, color: PDF_COLORS.accent, marginTop: 14 },
  coverNote: { fontSize: 11, color: PDF_COLORS.white },
  heading: { fontFamily: "Bebas Neue", fontSize: 38, lineHeight: 1.05, color: PDF_COLORS.primary, marginBottom: 6 },
  styleName: { fontFamily: "Bebas Neue", fontSize: 64, lineHeight: 1, color: PDF_COLORS.accent },
  percent: { fontFamily: "Bebas Neue", fontSize: 28, color: PDF_COLORS.primary, marginBottom: 18 },
  rule: { height: 2, width: 48, backgroundColor: PDF_COLORS.accent, marginVertical: 14 },
  paragraph: { marginBottom: 12 },
  styleRow: { flexDirection: "row", alignItems: "flex-start" },
  coverLayer: { position: "absolute", top: 0, left: 0, width: 595.28, height: 841 },
  coverImage: { width: 595.28, height: 841, objectFit: "cover" },
  coverShade: { position: "absolute", top: 0, left: 0, width: 595.28, height: 841, backgroundColor: PDF_COLORS.primary, opacity: 0.78 },
  thumbRow: { flexDirection: "row", marginTop: 20, marginBottom: 6 },
  thumb: { width: 130, marginRight: 24 },
  thumbImage: { width: 130, height: 200, objectFit: "cover", borderRadius: 4 },
  thumbCaption: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: PDF_COLORS.accent, fontWeight: 600, marginTop: 6 },
  thumbName: { fontFamily: "Bebas Neue", fontSize: 22, color: PDF_COLORS.primary, lineHeight: 1.1 },
  slotRow: { flexDirection: "row", alignItems: "flex-start" },
  slotImage: { width: 140, height: 210, objectFit: "cover", borderRadius: 4, marginLeft: 20 },
  styleImage: { width: 190, height: 330, objectFit: "cover", borderRadius: 4, marginRight: 22 },
  styleText: { flex: 1 },
  strong: { fontWeight: 600, color: PDF_COLORS.primary },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  barLabel: { width: 135, fontWeight: 600, color: PDF_COLORS.primary },
  barTrack: { flex: 1, height: 12, backgroundColor: "#e5e7eb", borderRadius: 6 },
  barValue: { width: 40, textAlign: "right", fontWeight: 600, color: PDF_COLORS.primary },
  item: { flexDirection: "row", marginBottom: 12 },
  bullet: { width: 18, color: PDF_COLORS.accent, fontWeight: 600 },
  itemText: { flex: 1 },
  subheading: { fontFamily: "Bebas Neue", fontSize: 24, color: PDF_COLORS.primary, marginTop: 14, marginBottom: 4 },
  closing: { backgroundColor: PDF_COLORS.primary, padding: 56, justifyContent: "center", alignItems: "center", color: PDF_COLORS.white },
  wordmark: { fontFamily: "Bebas Neue", fontSize: 44, letterSpacing: 8, color: PDF_COLORS.white, marginTop: 10 },
  cta: { alignSelf: "stretch", borderWidth: 1.5, borderColor: PDF_COLORS.accent, borderRadius: 8, padding: 28, marginBottom: 56 },
  ctaTitle: { fontFamily: "Bebas Neue", fontSize: 34, lineHeight: 1.1, color: PDF_COLORS.white },
  ctaIntro: { fontSize: 12, color: PDF_COLORS.white, marginTop: 8, marginBottom: 12 },
  ctaItem: { flexDirection: "row", marginBottom: 6 },
  ctaItemText: { flex: 1, fontSize: 12.5, color: PDF_COLORS.white },
  ctaButton: { backgroundColor: PDF_COLORS.accent, borderRadius: 6, paddingVertical: 11, paddingHorizontal: 16, marginTop: 16, textAlign: "center", textDecoration: "none" },
  ctaButtonOutline: { borderWidth: 1, borderColor: PDF_COLORS.white, borderRadius: 6, paddingVertical: 11, paddingHorizontal: 16, marginTop: 10, textAlign: "center", textDecoration: "none" },
  ctaButtonText: { fontFamily: "Inter", fontWeight: 600, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: PDF_COLORS.white, textAlign: "center" },
  closingNote: { fontSize: 11, color: PDF_COLORS.accent, marginTop: 24, textAlign: "center" },
});

type BlockWithParagraphs = { paragraphs: string[] };
type BlockWithItems = { intro: string; items: string[] };

function List({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((text) => (
        <View key={text} style={styles.item} wrap={false}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.itemText}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

/** The text of a style page, with the editorial image of the style beside it when the file exists. */
function StyleBody({ style, text, dir }: { style: Style; text: string; dir: string }) {
  const image = pdfStyleImage(style, dir);
  if (!image) return <Text style={styles.paragraph}>{text}</Text>;
  return (
    <View style={styles.styleRow}>
      <Image src={imageSource(image)} style={styles.styleImage} />
      <View style={styles.styleText}>
        <Text style={styles.paragraph}>{text}</Text>
      </View>
    </View>
  );
}

/** A list with the photo of a slot beside it when the file exists. */
function ListWithSlot({ items, image }: { items: string[]; image: string | null }) {
  if (!image) return <List items={items} />;
  return (
    <View style={styles.slotRow}>
      <View style={styles.styleText}>
        <List items={items} />
      </View>
      <Image src={imageSource(image)} style={styles.slotImage} />
    </View>
  );
}

/** One of the two small portraits of the "styles in numbers" page. */
function Thumb({ style, caption, label, dir }: { style: Style; caption: string; label: string; dir: string }) {
  const image = pdfStyleImage(style, dir);
  if (!image) return null;
  return (
    <View style={styles.thumb} wrap={false}>
      <Image src={imageSource(image)} style={styles.thumbImage} />
      <Text style={styles.thumbCaption}>{caption}</Text>
      <Text style={styles.thumbName}>{label}</Text>
    </View>
  );
}

/**
 * The eight parts, in order. `customerName` is the full name shown on the cover. `imagesDir` is where the
 * light image copies are read from (tests point it at a folder of their own).
 */
export function DiagnosisDocument({
  content,
  customerName,
  imagesDir = defaultImagesDir(),
}: {
  content: DiagnosisContent;
  customerName: string;
  imagesDir?: string;
}) {
  const [result, pieces, accessories, guidance] = content.blocks as unknown as [
    BlockWithParagraphs,
    BlockWithItems,
    BlockWithItems,
    BlockWithParagraphs,
  ];
  const coverImage = pdfStyleImage(content.predominant.style, imagesDir);
  const ordered = [...STYLES].sort((a, b) => content.percentages[b] - content.percentages[a]);

  return (
    <Document title="Diagnóstico de Estilo Pessoal — Millena Barreto" author="Millena Barreto" language="pt-BR">
      {/* 1. Cover with the customer's name */}
      <Page size="A4" style={styles.coverPage}>
        {coverImage ? (
          <View style={styles.coverLayer}>
            <Image src={imageSource(coverImage)} style={styles.coverImage} />
            {/* The dark layer keeps the white and lilac text legible over the photo. */}
            <View style={styles.coverShade} />
          </View>
        ) : null}
        <View style={styles.cover}>
          <Text style={styles.kicker}>Millena Barreto · Consultoria de imagem</Text>
          <View>
            <Text style={styles.coverTitle}>Diagnóstico de Estilo Pessoal</Text>
            <Text style={styles.coverName}>{customerName}</Text>
          </View>
          <Text style={styles.coverNote}>Um retrato do seu estilo, feito a partir das suas escolhas.</Text>
        </View>
      </Page>

      {/* 2. Predominant style */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>{PART_TITLES.predominant}</Text>
        <Text style={styles.styleName}>{content.predominant.label}</Text>
        <Text style={styles.percent}>{content.predominant.percent}% das suas escolhas</Text>
        <View style={styles.rule} />
        <StyleBody style={content.predominant.style} text={result.paragraphs[0]} dir={imagesDir} />
      </Page>

      {/* 3. Secondary style */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>{PART_TITLES.secondary}</Text>
        <Text style={styles.styleName}>{content.secondary.label}</Text>
        <Text style={styles.percent}>{content.secondary.percent}% das suas escolhas</Text>
        <View style={styles.rule} />
        <StyleBody style={content.secondary.style} text={result.paragraphs[1]} dir={imagesDir} />
      </Page>

      {/* 4. The styles in numbers */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>{PART_TITLES.numbers}</Text>
        <View style={styles.rule} />
        <Text style={styles.paragraph}>
          Veja como as suas escolhas se distribuíram entre os seis estilos. O {content.predominant.label} lidera, com{" "}
          {content.predominant.percent}%, seguido do {content.secondary.label}, com {content.secondary.percent}%.
        </Text>
        <View style={styles.thumbRow}>
          <Thumb style={content.predominant.style} caption="Predominante" label={content.predominant.label} dir={imagesDir} />
          <Thumb style={content.secondary.style} caption="Secundário" label={content.secondary.label} dir={imagesDir} />
        </View>
        <View style={{ marginTop: 14 }}>
          {ordered.map((style) => (
            <View key={style} style={styles.barRow} wrap={false}>
              <Text style={styles.barLabel}>{STYLE_LABELS[style]}</Text>
              <View style={styles.barTrack}>
                <View
                  style={{
                    height: 12,
                    borderRadius: 6,
                    width: `${content.percentages[style]}%`,
                    backgroundColor: style === content.predominant.style ? PDF_COLORS.accent : PDF_COLORS.secondary,
                  }}
                />
              </View>
              <Text style={styles.barValue}>{content.percentages[style]}%</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* 5. Piece suggestions */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>{PART_TITLES.pieces}</Text>
        <View style={styles.rule} />
        <Text style={styles.paragraph}>{pieces.intro}</Text>
        <ListWithSlot items={pieces.items} image={pdfSlotImage(content.predominant.style, "pecas", imagesDir)} />
      </Page>

      {/* 6. Outfit combinations (and the accessories) */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>{PART_TITLES.combinations}</Text>
        <View style={styles.rule} />
        <Text style={styles.paragraph}>{result.paragraphs[2]}</Text>
        <Text style={styles.subheading}>Acessórios e complementos</Text>
        <Text style={styles.paragraph}>{accessories.intro}</Text>
        <ListWithSlot items={accessories.items} image={pdfSlotImage(content.predominant.style, "acessorios", imagesDir)} />
      </Page>

      {/* 7. Practical guidance */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>{PART_TITLES.guidance}</Text>
        <View style={styles.rule} />
        <Text style={styles.paragraph}>{guidance.paragraphs[0]}</Text>
      </Page>

      {/* 8. Closing page with the visual signature */}
      <Page size="A4" style={styles.closing}>
        <View style={styles.cta}>
          <Text style={styles.ctaTitle}>{CONSULTANCY_CTA.title}</Text>
          <Text style={styles.ctaIntro}>{CONSULTANCY_CTA.intro}</Text>
          {CONSULTANCY_CTA.benefits.map((benefit) => (
            <View key={benefit} style={styles.ctaItem} wrap={false}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.ctaItemText}>{benefit}</Text>
            </View>
          ))}
          <Link src={CONSULTANCY_CTA.whatsappUrl} style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>{CONSULTANCY_CTA.whatsappLabel}</Text>
          </Link>
          <Link src={CONSULTANCY_CTA.instagramUrl} style={styles.ctaButtonOutline}>
            <Text style={styles.ctaButtonText}>
              {CONSULTANCY_CTA.instagramLabel} · {CONSULTANCY_CTA.instagramHandle}
            </Text>
          </Link>
        </View>
        <Text style={styles.kicker}>{PART_TITLES.closing}</Text>
        <Text style={styles.wordmark}>Millena Barreto</Text>
        <Text style={styles.closingNote}>Consultoria de imagem e estilo pessoal</Text>
      </Page>
    </Document>
  );
}
