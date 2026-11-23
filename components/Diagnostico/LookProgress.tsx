import { CHAPTERS, type Chapter } from "@/lib/diagnostico/chapters";
import {
  earnedChapters,
  hasChapters,
  progressPercent,
  segmentStates,
  type ChapterStep,
  type SavedIds,
} from "@/lib/diagnostico/questionnaire-state";

const SEGMENT_LABEL = { answered: "respondido", current: "atual", pending: "pendente" } as const;

/**
 * One piece of the look, drawn as an inline icon (no image file): a top, a bottom and an accessory.
 * A finished chapter draws its piece filled in the accent color; before that it is an outline.
 */
function LookPiece({ piece, complete }: { piece: Chapter["piece"]; complete: boolean }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    focusable: false,
    "data-piece": piece,
    "data-complete": complete ? "true" : "false",
    className: complete ? "text-accent" : "text-neutral-400",
    fill: complete ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };
  if (piece === "top") {
    return (
      <svg {...common}>
        <path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z" />
      </svg>
    );
  }
  if (piece === "bottom") {
    return (
      <svg {...common}>
        <path d="M7 3h10l2 18h-5l-2-10-2 10H5L7 3Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" />
      <path d="M5 8h14l1 13H4L5 8Z" />
    </svg>
  );
}

/**
 * The progress of the questionnaire. With chapters (version 2) it is 15 segments in 3 groups of 5,
 * each finished group drawing one piece of a look; without chapters (version 1) it is the original
 * single bar. Everything is derived from the question set and the saved answers.
 */
export default function LookProgress({
  steps,
  saved,
  currentIndex,
  transitionMs,
}: {
  steps: readonly ChapterStep[];
  saved: SavedIds;
  currentIndex: number;
  transitionMs: number;
}) {
  const total = steps.length;
  const current = steps[currentIndex];
  const chaptered = hasChapters(steps);

  return (
    <div>
      <p className="mb-2 flex flex-wrap items-baseline gap-x-3 text-sm font-medium text-primary">
        <span>
          Pergunta {currentIndex + 1} de {total}
        </span>
        {chaptered && current?.chapter ? (
          <span className="text-secondary">Capítulo {current.chapter} de {CHAPTERS.length}</span>
        ) : null}
      </p>
      <div
        role="progressbar"
        aria-label="Progresso do questionário"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={currentIndex + 1}
      >
        {chaptered ? null : (
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${progressPercent(currentIndex, total)}%`, transitionDuration: `${transitionMs}ms` }}
            />
          </div>
        )}
      </div>
      {chaptered ? <Groups steps={steps} saved={saved} currentIndex={currentIndex} /> : null}
    </div>
  );
}

function Groups({
  steps,
  saved,
  currentIndex,
}: {
  steps: readonly ChapterStep[];
  saved: SavedIds;
  currentIndex: number;
}) {
  const segments = segmentStates(steps, saved, currentIndex);
  const earned = earnedChapters(steps, saved);
  return (
    <div className="grid grid-cols-3 gap-3" data-testid="look-progress">
      {CHAPTERS.map((chapter) => {
        const complete = earned.includes(chapter.number);
        const own = segments.filter((segment) => segment.chapter === chapter.number);
        return (
          <div
            key={chapter.number}
            role="group"
            aria-label={`${chapter.name}, ${complete ? "completo" : "incompleto"}`}
            data-chapter={chapter.number}
            data-complete={complete ? "true" : "false"}
            className="min-w-0"
          >
            <div className="mb-1 flex items-center gap-1">
              <LookPiece piece={chapter.piece} complete={complete} />
              <span className="text-xs leading-tight text-secondary">{chapter.name}</span>
            </div>
            <ul role="list" className="flex gap-1">
              {own.map((segment) => (
                <li
                  key={segment.index}
                  aria-label={`Passo ${segment.index + 1}, ${SEGMENT_LABEL[segment.state]}`}
                  aria-current={segment.current ? "step" : undefined}
                  data-filled={segment.filled ? "true" : "false"}
                  data-current={segment.current ? "true" : "false"}
                  className={`h-2 flex-1 rounded-full ${
                    segment.filled ? (complete ? "bg-accent" : "bg-accent/60") : "bg-neutral-200"
                  } ${segment.current ? "ring-2 ring-primary ring-offset-1" : ""}`}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
