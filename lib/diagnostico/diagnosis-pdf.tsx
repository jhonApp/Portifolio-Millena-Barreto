import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { STYLES, STYLE_LABELS } from "./constants";
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
  cover: { backgroundColor: PDF_COLORS.primary, padding: 56, justifyContent: "space-between", color: PDF_COLORS.white },
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

/** The eight parts, in order. `customerName` is the full name shown on the cover. */
export function DiagnosisDocument({ content, customerName }: { content: DiagnosisContent; customerName: string }) {
  const [result, pieces, accessories, guidance] = content.blocks as unknown as [
    BlockWithParagraphs,
    BlockWithItems,
    BlockWithItems,
    BlockWithParagraphs,
  ];
  const ordered = [...STYLES].sort((a, b) => content.percentages[b] - content.percentages[a]);

  return (
    <Document title="Diagnóstico de Estilo Pessoal — Millena Barreto" author="Millena Barreto" language="pt-BR">
      {/* 1. Cover with the customer's name */}
      <Page size="A4" style={styles.cover}>
        <Text style={styles.kicker}>Millena Barreto · Consultoria de imagem</Text>
        <View>
          <Text style={styles.coverTitle}>Diagnóstico de Estilo Pessoal</Text>
          <Text style={styles.coverName}>{customerName}</Text>
        </View>
        <Text style={styles.coverNote}>Um retrato do seu estilo, feito a partir das suas escolhas.</Text>
      </Page>

      {/* 2. Predominant style */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>{PART_TITLES.predominant}</Text>
        <Text style={styles.styleName}>{content.predominant.label}</Text>
        <Text style={styles.percent}>{content.predominant.percent}% das suas escolhas</Text>
        <View style={styles.rule} />
        <Text style={styles.paragraph}>{result.paragraphs[0]}</Text>
      </Page>

      {/* 3. Secondary style */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>{PART_TITLES.secondary}</Text>
        <Text style={styles.styleName}>{content.secondary.label}</Text>
        <Text style={styles.percent}>{content.secondary.percent}% das suas escolhas</Text>
        <View style={styles.rule} />
        <Text style={styles.paragraph}>{result.paragraphs[1]}</Text>
      </Page>

      {/* 4. The styles in numbers */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>{PART_TITLES.numbers}</Text>
        <View style={styles.rule} />
        <Text style={styles.paragraph}>
          Veja como as suas escolhas se distribuíram entre os seis estilos. O {content.predominant.label} lidera, com{" "}
          {content.predominant.percent}%, seguido do {content.secondary.label}, com {content.secondary.percent}%.
        </Text>
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
        <List items={pieces.items} />
      </Page>

      {/* 6. Outfit combinations (and the accessories) */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>{PART_TITLES.combinations}</Text>
        <View style={styles.rule} />
        <Text style={styles.paragraph}>{result.paragraphs[2]}</Text>
        <Text style={styles.subheading}>Acessórios e complementos</Text>
        <Text style={styles.paragraph}>{accessories.intro}</Text>
        <List items={accessories.items} />
      </Page>

      {/* 7. Practical guidance */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>{PART_TITLES.guidance}</Text>
        <View style={styles.rule} />
        <Text style={styles.paragraph}>{guidance.paragraphs[0]}</Text>
      </Page>

      {/* 8. Closing page with the visual signature */}
      <Page size="A4" style={styles.closing}>
        <Text style={styles.kicker}>{PART_TITLES.closing}</Text>
        <Text style={styles.wordmark}>Millena Barreto</Text>
        <Text style={styles.closingNote}>Consultoria de imagem e estilo pessoal</Text>
      </Page>
    </Document>
  );
}
