"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import LoadingLine from "@/components/Diagnostico/LoadingLine";
import type { Chapter } from "@/lib/diagnostico/chapters";
import { CHAPTER_ADVANCE_LABEL, CHAPTER_ADVANCE_MS, scheduleAdvance } from "@/lib/diagnostico/loading";

// A badge animates in over 600 ms at most; with reduced motion it appears at once.
const BADGE_ANIMATION_S = 0.6;

/**
 * The pause at the end of a chapter (quiz v2 RF-04): the badge, a one-line message and a loading
 * line. It is a region named by the badge; its title takes the focus when it opens. The screen
 * moves on by itself after CHAPTER_ADVANCE_MS (loading feedback RF-01): there is no button and no
 * way to skip the wait. The message is the same for every customer and never names a style, a
 * percentage or a score.
 */
export default function ChapterScreen({
  chapter,
  reduceMotion,
  onDone,
}: {
  chapter: Chapter;
  reduceMotion: boolean;
  onDone: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Read through a ref so a re-render of the parent never restarts the wait.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // The cleanup cancels the wait when the screen leaves, so nothing runs on an unmounted screen.
  useEffect(() => scheduleAdvance(CHAPTER_ADVANCE_MS, () => doneRef.current()), []);

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
      <div className="mt-2 w-full max-w-[420px]">
        <LoadingLine label={CHAPTER_ADVANCE_LABEL} durationMs={CHAPTER_ADVANCE_MS} reduceMotion={reduceMotion} />
      </div>
    </section>
  );
}
