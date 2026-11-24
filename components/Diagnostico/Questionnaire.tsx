"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ChapterScreen from "@/components/Diagnostico/ChapterScreen";
import DuelStep from "@/components/Diagnostico/DuelStep";
import LookProgress from "@/components/Diagnostico/LookProgress";
import { chapterFor } from "@/lib/diagnostico/chapters";
import { COMPLETION_PATH, EXPIRED_PATH, VERSION_CHANGED_PATH } from "@/lib/diagnostico/paths";
import type { QuestionnaireInitialState } from "@/lib/diagnostico/questionnaire-page";
import {
  RETRY_DELAYS_MS,
  TRANSITION_MS,
  canAdvance,
  chapterToShow,
  nextChoices,
  sameChoices,
  type SavedChoice,
} from "@/lib/diagnostico/questionnaire-state";

type SaveStatus = "saving" | "retrying" | "failed" | "rejected";
type SendOutcome = "ok" | "expired" | "changed" | "rejected" | "failed";

const MESSAGE_RETRYING = "Não conseguimos salvar sua resposta. Tentando de novo…";
const MESSAGE_OFFLINE = "Sem conexão. Suas respostas já salvas estão seguras. Tente novamente.";
const MESSAGE_REJECTED = "Não foi possível salvar essa resposta. Escolha a alternativa de novo.";
// Draft copy for Millena's review.
const HINT_SECOND_CHOICE = "Se mais de uma opção combina com você, escolha uma segunda. É opcional.";
const LABEL_FIRST = "1ª escolha";
const LABEL_SECOND = "2ª escolha";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function Questionnaire({
  initial,
  notice,
}: {
  initial: QuestionnaireInitialState;
  notice?: string;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { questions } = initial.questionSet;
  const total = questions.length;

  const [index, setIndex] = useState(initial.startIndex);
  const [direction, setDirection] = useState<1 | -1>(1);
  // What the customer picked (shown at once) and what the server confirmed.
  const [selected, setSelected] = useState<Record<string, SavedChoice>>(initial.choices);
  const [saved, setSaved] = useState<Record<string, SavedChoice>>(initial.choices);
  const [status, setStatus] = useState<Record<string, SaveStatus | undefined>>({});
  // The chapter screen on display (RF-04) and the ones already shown in this visit: a reload starts empty.
  const [chapterOpen, setChapterOpen] = useState<number | null>(null);
  const chaptersSeen = useRef<Set<number>>(new Set());

  // One save in flight per question: a tap made meanwhile is sent after it, so an older state
  // never overwrites a newer one on the server.
  const inFlight = useRef<Record<string, boolean>>({});
  const wanted = useRef<Record<string, SavedChoice>>({});
  const confirmed = useRef<Record<string, SavedChoice>>({ ...initial.choices });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);

  const question = questions[index];
  const isLast = index === total - 1;
  const chosen = selected[question.id];
  const multiple = question.maxChoices === 2;
  const questionStatus = status[question.id];
  const pending = questionStatus !== undefined;
  const allSaved = questions.every((item) => Boolean(saved[item.id]));
  const forwardDisabled = !canAdvance(question.id, saved) || pending || (isLast && !allSaved);

  // Move the focus to the question heading after a navigation (not on the first render).
  useEffect(() => {
    if (!navigated.current) return;
    headingRef.current?.focus();
  }, [index]);

  function setQuestionStatus(questionId: string, value: SaveStatus | undefined) {
    setStatus((current) => ({ ...current, [questionId]: value }));
  }

  /** Sends the whole answer of a question, retrying network failures and 5xx responses. */
  async function send(questionId: string, choice: SavedChoice): Promise<SendOutcome> {
    // First attempt plus one retry per delay: 4 requests in total.
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await fetch("/api/diagnostico/answers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, alternativeId: choice.first, secondAlternativeId: choice.second }),
        });
        if (response.ok) return "ok";
        if (response.status === 403) return "expired";
        // A new questionnaire version was published under this open page: nothing was saved.
        if (response.status === 409) {
          const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
          if (body?.error?.code === "VERSION_CHANGED") return "changed";
        }
        // Retrying a request the server rejected cannot help.
        if (response.status >= 400 && response.status < 500) return "rejected";
      } catch {
        // A network failure is retried below.
      }
      if (attempt < RETRY_DELAYS_MS.length) {
        setQuestionStatus(questionId, "retrying");
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
    return "failed";
  }

  async function persist(questionId: string, choice: SavedChoice) {
    wanted.current[questionId] = choice;
    if (inFlight.current[questionId]) return;
    inFlight.current[questionId] = true;
    setQuestionStatus(questionId, "saving");
    try {
      // Keep sending until the server holds the latest state the customer asked for.
      for (;;) {
        const target = wanted.current[questionId];
        const outcome = await send(questionId, target);
        if (outcome === "expired") {
          router.replace(EXPIRED_PATH);
          return;
        }
        if (outcome === "changed") {
          // The server renders the new version; the screen is keyed by version and starts clean.
          router.replace(VERSION_CHANGED_PATH);
          return;
        }
        if (outcome === "rejected") {
          // Restore the last saved state of this question.
          const last = confirmed.current[questionId];
          setSelected((current) => {
            const next = { ...current };
            if (last) next[questionId] = last;
            else delete next[questionId];
            return next;
          });
          setQuestionStatus(questionId, "rejected");
          return;
        }
        if (outcome === "failed") {
          setQuestionStatus(questionId, "failed");
          return;
        }
        confirmed.current[questionId] = target;
        setSaved((current) => ({ ...current, [questionId]: target }));
        if (wanted.current[questionId] === target) {
          setQuestionStatus(questionId, undefined);
          return;
        }
        setQuestionStatus(questionId, "saving");
      }
    } finally {
      inFlight.current[questionId] = false;
    }
  }

  function choose(alternativeId: string) {
    const current = selected[question.id];
    const next = nextChoices(current, alternativeId, question.maxChoices);
    // Tapping the only selected card changes nothing and sends nothing.
    if (sameChoices(current, next) && !pending) return;
    setSelected((all) => ({ ...all, [question.id]: next }));
    void persist(question.id, next);
  }

  function go(step: 1 | -1) {
    navigated.current = true;
    setDirection(step);
    setIndex((current) => current + step);
  }

  function forward() {
    if (forwardDisabled) return;
    // The last step of a chapter shows its badge first (once per chapter and per visit).
    const due = chapterToShow(questions, saved, index, chaptersSeen.current);
    if (due !== null) {
      chaptersSeen.current.add(due);
      setChapterOpen(due);
      return;
    }
    leave();
  }

  function leave() {
    if (isLast) {
      router.push(COMPLETION_PATH);
      return;
    }
    go(1);
  }

  // Called by the chapter screen once its wait is over (no tap involved).
  function advanceFromChapter() {
    setChapterOpen(null);
    leave();
  }

  const duration = reduceMotion ? 0 : TRANSITION_MS / 1000;
  const openChapter = chapterOpen === null ? undefined : chapterFor(chapterOpen);

  // The card is marked by a border and by text ("1ª escolha"), never by color alone.
  const cardClass = (isSelected: boolean) =>
    `flex min-h-[56px] cursor-pointer items-center rounded-lg border px-4 py-3 text-base leading-snug transition-colors focus-within:ring-2 focus-within:ring-accent ${
      isSelected ? "border-2 border-accent bg-accent/10 text-primary" : "border-neutral-300 text-secondary hover:border-accent"
    }`;

  return (
    <section className="mx-auto max-w-[640px] py-4 xl:py-10">
      {notice ? (
        <p role="status" className="mb-6 rounded-lg bg-accent/10 p-3 text-sm text-primary">
          {notice}
        </p>
      ) : null}
      {openChapter ? null : (
        <>
        <h1 className="font-primary text-[36px] leading-none text-primary xl:text-[56px]">
          Vamos descobrir o seu estilo?
        </h1>
        <p className="mt-3 text-sm text-secondary">
          Responda com sinceridade. Escolha a alternativa que mais representa você, não aquela que você
          acredita que deveria escolher.
        </p>
        </>
      )}

      <div className={openChapter ? "mt-4" : "mt-8"}>
        <LookProgress steps={questions} saved={saved} currentIndex={index} transitionMs={duration * 1000} />
      </div>

      {openChapter ? (
        <ChapterScreen chapter={openChapter} reduceMotion={Boolean(reduceMotion)} onDone={advanceFromChapter} />
      ) : (
      <>
      <motion.div
        key={question.id}
        initial={{ opacity: 0, x: reduceMotion ? 0 : direction * 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration, ease: "easeOut" }}
        className="mt-8"
      >
        <h2
          id={`question-${question.id}`}
          ref={headingRef}
          tabIndex={-1}
          className="text-[22px] font-semibold leading-snug text-primary outline-none"
        >
          {question.text}
        </h2>

        {question.kind === "duel" ? (
          <DuelStep question={question} chosen={chosen} onChoose={choose} />
        ) : multiple ? (
          <div role="group" aria-labelledby={`question-${question.id}`} aria-describedby={`hint-${question.id}`} className="mt-5 flex flex-col gap-3">
            {question.alternatives.map((alternative) => {
              const rank = chosen?.first === alternative.id ? 1 : chosen?.second === alternative.id ? 2 : 0;
              return (
                <label key={alternative.id} className={cardClass(rank > 0)}>
                  <input
                    type="checkbox"
                    name={`question-${question.id}`}
                    value={alternative.id}
                    checked={rank > 0}
                    onChange={() => choose(alternative.id)}
                    className="sr-only"
                  />
                  <span className="flex-1">{alternative.text}</span>
                  {rank > 0 ? (
                    <span className="ml-3 shrink-0 text-xs font-semibold uppercase tracking-wider text-accent">
                      {rank === 1 ? LABEL_FIRST : LABEL_SECOND}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        ) : (
          <div role="radiogroup" aria-labelledby={`question-${question.id}`} className="mt-5 flex flex-col gap-3">
            {question.alternatives.map((alternative) => {
              const isSelected = chosen?.first === alternative.id;
              return (
                <label key={alternative.id} className={cardClass(isSelected)}>
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={alternative.id}
                    checked={isSelected}
                    onChange={() => choose(alternative.id)}
                    className="sr-only"
                  />
                  {alternative.text}
                </label>
              );
            })}
          </div>
        )}
        {multiple ? (
          <p id={`hint-${question.id}`} className="mt-3 text-sm text-secondary">
            {HINT_SECOND_CHOICE}
          </p>
        ) : null}
      </motion.div>

      <div className="mt-4 min-h-[48px]" aria-live="polite">
        {questionStatus === "retrying" ? (
          <p role="status" className="text-sm text-secondary">
            {MESSAGE_RETRYING}
          </p>
        ) : null}
        {questionStatus === "failed" || questionStatus === "rejected" ? (
          <div role="alert" className="flex flex-col gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <p>{questionStatus === "failed" ? MESSAGE_OFFLINE : MESSAGE_REJECTED}</p>
            {questionStatus === "failed" ? (
              <button
                type="button"
                onClick={() => void persist(question.id, selected[question.id])}
                className="btn border border-red-600 text-red-600"
              >
                Tentar novamente
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => go(-1)}
            className="btn border border-neutral-300 text-sm font-semibold uppercase tracking-wider text-primary"
          >
            Anterior
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={forward}
          disabled={forwardDisabled}
          className="btn btn-accent text-sm font-semibold uppercase tracking-wider disabled:opacity-50"
        >
          {isLast ? "Concluir" : "Próxima"}
        </button>
      </div>
      </>
      )}
    </section>
  );
}
