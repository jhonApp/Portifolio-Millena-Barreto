"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COMPLETION_PATH, EXPIRED_PATH } from "@/lib/diagnostico/paths";
import type { QuestionnaireInitialState } from "@/lib/diagnostico/questionnaire-page";
import {
  RETRY_DELAYS_MS,
  TRANSITION_MS,
  canAdvance,
  progressPercent,
} from "@/lib/diagnostico/questionnaire-state";

type SaveStatus = "saving" | "retrying" | "failed" | "rejected";

const MESSAGE_RETRYING = "Não conseguimos salvar sua resposta. Tentando de novo…";
const MESSAGE_OFFLINE = "Sem conexão. Suas respostas já salvas estão seguras. Tente novamente.";
const MESSAGE_REJECTED = "Não foi possível salvar essa resposta. Escolha a alternativa de novo.";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function Questionnaire({ initial }: { initial: QuestionnaireInitialState }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { questions } = initial.questionSet;
  const total = questions.length;

  const [index, setIndex] = useState(initial.startIndex);
  const [direction, setDirection] = useState<1 | -1>(1);
  // What the customer picked (shown at once) and what the server confirmed.
  const [selected, setSelected] = useState<Record<string, string>>(initial.answers);
  const [saved, setSaved] = useState<Record<string, string>>(initial.answers);
  const [status, setStatus] = useState<Record<string, SaveStatus | undefined>>({});

  // Counts saves per question, so a response to an older choice never overrides a newer one.
  const latestSave = useRef<Record<string, number>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);

  const question = questions[index];
  const isLast = index === total - 1;
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

  async function persist(questionId: string, alternativeId: string) {
    const ticket = (latestSave.current[questionId] ?? 0) + 1;
    latestSave.current[questionId] = ticket;
    const stale = () => latestSave.current[questionId] !== ticket;

    setQuestionStatus(questionId, "saving");
    // First attempt plus one retry per delay: 4 requests in total.
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await fetch("/api/diagnostico/answers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, alternativeId }),
        });
        if (stale()) return;
        if (response.ok) {
          setSaved((current) => ({ ...current, [questionId]: alternativeId }));
          setQuestionStatus(questionId, undefined);
          return;
        }
        if (response.status === 403) {
          router.replace(EXPIRED_PATH);
          return;
        }
        if (response.status >= 400 && response.status < 500) {
          // Retrying a request the server rejected cannot help.
          setQuestionStatus(questionId, "rejected");
          return;
        }
      } catch {
        if (stale()) return;
      }
      if (attempt < RETRY_DELAYS_MS.length) {
        setQuestionStatus(questionId, "retrying");
        await sleep(RETRY_DELAYS_MS[attempt]);
        if (stale()) return;
      }
    }
    setQuestionStatus(questionId, "failed");
  }

  function choose(alternativeId: string) {
    setSelected((current) => ({ ...current, [question.id]: alternativeId }));
    void persist(question.id, alternativeId);
  }

  function go(step: 1 | -1) {
    navigated.current = true;
    setDirection(step);
    setIndex((current) => current + step);
  }

  function forward() {
    if (forwardDisabled) return;
    if (isLast) {
      router.push(COMPLETION_PATH);
      return;
    }
    go(1);
  }

  const duration = reduceMotion ? 0 : TRANSITION_MS / 1000;

  return (
    <section className="mx-auto max-w-[640px] py-4 xl:py-10">
      <h1 className="font-primary text-[36px] leading-none text-primary xl:text-[56px]">
        Vamos descobrir o seu estilo?
      </h1>
      <p className="mt-3 text-sm text-secondary">
        Responda com sinceridade. Escolha a alternativa que mais representa você, não aquela que você
        acredita que deveria escolher.
      </p>

      <div className="mt-8">
        <p className="mb-2 text-sm font-medium text-primary">
          Pergunta {index + 1} de {total}
        </p>
        <div
          role="progressbar"
          aria-label="Progresso do questionário"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${progressPercent(index, total)}%`, transitionDuration: `${duration * 1000}ms` }}
          />
        </div>
      </div>

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

        <div role="radiogroup" aria-labelledby={`question-${question.id}`} className="mt-5 flex flex-col gap-3">
          {question.alternatives.map((alternative) => {
            const isSelected = selected[question.id] === alternative.id;
            return (
              <label
                key={alternative.id}
                className={`flex min-h-[56px] cursor-pointer items-center rounded-lg border px-4 py-3 text-base leading-snug transition-colors focus-within:ring-2 focus-within:ring-accent ${
                  isSelected
                    ? "border-accent bg-accent/10 text-primary"
                    : "border-neutral-300 text-secondary hover:border-accent"
                }`}
              >
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
    </section>
  );
}
