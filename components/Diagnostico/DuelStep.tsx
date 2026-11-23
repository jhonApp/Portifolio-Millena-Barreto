"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicQuestionSet } from "@/lib/diagnostico/question-types";
import type { SavedChoice } from "@/lib/diagnostico/questionnaire-state";

type DuelQuestion = PublicQuestionSet["questions"][number];

// Draft copy for Millena's review: the visible captions come from the alternative text ("Look A",
// "Look B"); the alternative text of the image is neutral and never names a style.
const CAPTION_FALLBACK = ["Look A", "Look B"];

function letterOf(text: string, index: number): string {
  return /^Look ([A-Z])$/.exec(text)?.[1] ?? (index === 0 ? "A" : "B");
}

/**
 * The two looks of a duel (RF-03) as one radio group. The customer taps one look; the choice goes
 * through the same save as every other step (the parent owns the saving). The images come from the
 * look route by alternative id, so nothing on this screen names a style.
 */
export default function DuelStep({
  question,
  chosen,
  onChoose,
}: {
  question: DuelQuestion;
  chosen: SavedChoice | undefined;
  onChoose: (alternativeId: string) => void;
}) {
  // A look whose image fails to load shows a neutral block and stays selectable.
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const groupRef = useRef<HTMLDivElement>(null);

  // The server renders the images before React attaches onError, so a request that already failed
  // (404, network) fires no event we can see: look at every image once when the step mounts.
  useEffect(() => {
    const broken: Record<string, boolean> = {};
    groupRef.current?.querySelectorAll("img").forEach((img) => {
      const id = img.getAttribute("data-alternative");
      if (id && img.complete && img.naturalWidth === 0) broken[id] = true;
    });
    if (Object.keys(broken).length > 0) setFailed((current) => ({ ...current, ...broken }));
  }, []);

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-labelledby={`question-${question.id}`}
      className="mt-5 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2"
    >
      {question.alternatives.map((alternative, index) => {
        const isSelected = chosen?.first === alternative.id;
        const caption = alternative.text || CAPTION_FALLBACK[index] || "Look";
        const letter = letterOf(alternative.text, index);
        const image = alternative.image;
        const showImage = Boolean(image) && !failed[alternative.id];
        return (
          <label
            key={alternative.id}
            className={`relative mx-auto flex min-h-[56px] w-full max-w-[280px] cursor-pointer flex-col overflow-hidden rounded-lg border bg-white transition-colors focus-within:ring-2 focus-within:ring-accent min-[480px]:max-w-none ${
              isSelected ? "border-2 border-accent" : "border-neutral-300 hover:border-accent"
            }`}
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={alternative.id}
              checked={isSelected}
              onChange={() => onChoose(alternative.id)}
              aria-label={`Look de referência ${letter}`}
              className="sr-only"
            />
            {showImage && image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.src}
                width={image.width}
                height={image.height}
                alt={`Look de referência ${letter}`}
                data-alternative={alternative.id}
                loading="eager"
                decoding="async"
                onError={() => setFailed((current) => ({ ...current, [alternative.id]: true }))}
                className="block h-auto w-full"
                style={{ aspectRatio: `${image.width} / ${image.height}` }}
              />
            ) : (
              <div
                data-testid="look-placeholder"
                aria-hidden="true"
                className="flex w-full items-center justify-center bg-neutral-200 text-sm text-secondary"
                style={{ aspectRatio: image ? `${image.width} / ${image.height}` : "3 / 4" }}
              >
                {caption}
              </div>
            )}
            <span className="px-4 py-3 text-center text-base font-medium text-primary">{caption}</span>
            {isSelected ? (
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-lg font-bold text-white"
              >
                ✓
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
