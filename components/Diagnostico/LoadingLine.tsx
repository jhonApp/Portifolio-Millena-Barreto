"use client";

import { motion } from "framer-motion";

/**
 * A thin line that fills from left to right, with a status text under it. The same line is used on
 * every wait of the questionnaire (loading feedback PRD). It carries no percentage: the text is the
 * state, the line is a visual aid. With reduced motion the line is drawn still and full.
 */
export default function LoadingLine({
  label,
  durationMs,
  endAt = 1,
  reduceMotion,
}: {
  label: string;
  durationMs: number;
  /** The fraction (0 to 1) where the fill stops. */
  endAt?: number;
  reduceMotion: boolean;
}) {
  const end = Math.min(1, Math.max(0, endAt));
  return (
    <div data-testid="loading-line" className="w-full">
      <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
        <motion.div
          data-animated={reduceMotion ? "false" : "true"}
          data-end={end}
          className="h-full w-full origin-left rounded-full bg-accent"
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: reduceMotion ? 1 : end }}
          transition={{ duration: reduceMotion ? 0 : durationMs / 1000, ease: "linear" }}
        />
      </div>
      <p role="status" className="mt-3 text-sm text-secondary">
        {label}
      </p>
    </div>
  );
}
