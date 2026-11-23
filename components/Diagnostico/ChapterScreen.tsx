"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { Chapter } from "@/lib/diagnostico/chapters";

// A badge animates in over 600 ms at most; with reduced motion it appears at once.
const BADGE_ANIMATION_S = 0.6;

/**
 * The pause at the end of a chapter (RF-04): the badge, a one-line message and "Continuar". It is a
 * region named by the badge; its title takes the focus when it opens. The message is the same for
 * every customer and never names a style, a percentage or a score.
 */
export default function ChapterScreen({
  chapter,
  reduceMotion,
  onContinue,
}: {
  chapter: Chapter;
  reduceMotion: boolean;
  onContinue: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const titleId = `chapter-${chapter.number}-title`;
  return (
    <section
      aria-labelledby={titleId}
      data-testid="chapter-screen"
      data-chapter={chapter.number}
      className="mt-6 flex min-h-[280px] flex-col items-center justify-center gap-4 text-center"
    >
      <motion.div
        data-animated={reduceMotion ? "false" : "true"}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : BADGE_ANIMATION_S, ease: "easeOut" }}
        className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-accent bg-accent/10"
      >
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-accent"
        >
          <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />
        </svg>
      </motion.div>
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className="text-[22px] font-semibold text-primary outline-none">
        {chapter.badge}
      </h2>
      <p className="max-w-[420px] text-base text-secondary">{chapter.message}</p>
      <button type="button" onClick={onContinue} className="btn btn-accent mt-2 text-sm font-semibold uppercase tracking-wider">
        Continuar
      </button>
    </section>
  );
}
