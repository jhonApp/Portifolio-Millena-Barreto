// Chapter content of questionnaire version 2 (RF-04). Draft copy for Millena's review.
// The texts are constants: the same for every customer, and none names a style, a percentage or a score.

export type ChapterNumber = 1 | 2 | 3;

export type Chapter = {
  number: ChapterNumber;
  name: string;
  badge: string;
  message: string;
  /** The piece of the look this chapter draws: a top, a bottom and an accessory. */
  piece: "top" | "bottom" | "accessory";
};

export const CHAPTERS: readonly Chapter[] = [
  {
    number: 1,
    name: "Seu dia a dia",
    badge: "Selo Rotina",
    message: "Capítulo 1 completo! Já estou vendo um traço do seu estilo…",
    piece: "top",
  },
  {
    number: 2,
    name: "Suas ocasiões",
    badge: "Selo Ocasiões",
    message: "Capítulo 2 completo! Falta só mais um.",
    piece: "bottom",
  },
  {
    number: 3,
    name: "Seus desejos",
    badge: "Selo Desejos",
    message: "Capítulo 3 completo! Seu diagnóstico está quase pronto.",
    piece: "accessory",
  },
];

export const CHAPTER_COUNT = CHAPTERS.length;

/** The chapter with the given number (1 to 3). */
export function chapterFor(number: number): Chapter | undefined {
  return CHAPTERS.find((chapter) => chapter.number === number);
}
