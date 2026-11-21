"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { STYLE_LABELS, type Style } from "@/lib/diagnostico/constants";
import type { DiagnosisContent } from "@/lib/diagnostico/schemas/diagnosis-content";

type Props = {
  token: string;
  content: DiagnosisContent;
  hasPdf: boolean;
  /** The editorial image of the predominant style, or null while none has been supplied. */
  imageSrc: string | null;
};

const PDF_ERROR = "Não conseguimos gerar o PDF agora. Tente novamente.";

export default function ResultView({ token, content, hasPdf, imageSrc }: Props) {
  const reduceMotion = useReducedMotion();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const [result, pieces, accessories, guidance] = content.blocks as unknown as [
    { title: string; paragraphs: string[] },
    { title: string; intro: string; items: string[] },
    { title: string; intro: string; items: string[] },
    { title: string; paragraphs: string[] },
  ];
  const predominantName = STYLE_LABELS[content.predominant.style as Style];

  async function download() {
    setDownloading(true);
    setError("");
    try {
      const response = await fetch("/api/diagnostico/result/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error("pdf request failed");
      const { url } = await response.json();
      window.location.assign(url);
    } catch {
      setError(PDF_ERROR);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
    <motion.article
      initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4, ease: "easeOut" }}
      className="mx-auto max-w-[640px] pb-32 xl:pb-12"
    >
      <h1 className="text-center font-primary text-[34px] leading-none text-primary xl:text-[52px]">
        SEU DIAGNÓSTICO DE ESTILO
      </h1>

      {imageSrc ? (
        <div className="relative mt-8 h-[260px] w-full overflow-hidden rounded-lg bg-neutral-200">
          <Image
            src={imageSrc}
            alt={`Estilo ${predominantName}`}
            fill
            priority
            sizes="(min-width: 700px) 640px, 100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="mt-8 flex h-[200px] items-center justify-center rounded-lg bg-accent px-4 text-center font-primary text-[44px] leading-none tracking-wide text-white xl:h-[260px] xl:text-[72px]"
        >
          {predominantName}
        </div>
      )}

      <p className="mt-8 text-center text-xs font-semibold uppercase tracking-[3px] text-accent">
        Seu estilo predominante
      </p>
      <p className="mt-1 break-words text-center font-primary text-[44px] leading-none text-primary xl:text-[80px]">
        {predominantName}
      </p>
      <p className="mt-1 text-center text-sm text-secondary">{content.predominant.percent}% das suas escolhas</p>
      <p className="mt-4 text-center text-base text-primary">
        Seu segundo estilo: <strong>{STYLE_LABELS[content.secondary.style as Style]}</strong>
      </p>

      <section className="mt-10">
        <h2 className="font-primary text-[28px] text-primary">{result.title}</h2>
        {result.paragraphs.map((paragraph) => (
          <p key={paragraph} className="mt-3 text-base leading-relaxed text-secondary">
            {paragraph}
          </p>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="font-primary text-[28px] text-primary">{pieces.title}</h2>
        <p className="mt-3 text-base leading-relaxed text-secondary">{pieces.intro}</p>
        <ul className="mt-3 space-y-2">
          {pieces.items.map((item) => (
            <li key={item} className="flex gap-2 text-base text-primary">
              <span aria-hidden="true" className="text-accent">
                •
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-primary text-[28px] text-primary">{accessories.title}</h2>
        <p className="mt-3 text-base leading-relaxed text-secondary">{accessories.intro}</p>
        <ul className="mt-3 space-y-2">
          {accessories.items.map((item) => (
            <li key={item} className="flex gap-2 text-base text-primary">
              <span aria-hidden="true" className="text-accent">
                •
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-primary text-[28px] text-primary">{guidance.title}</h2>
        <p className="mt-3 text-base leading-relaxed text-secondary">{guidance.paragraphs[0]}</p>
      </section>

      <p className="mt-10 text-center text-sm text-secondary">Também enviamos uma cópia para o seu e-mail.</p>

    </motion.article>

      {/* Always visible: a fixed bar on small screens. It sits outside the animated article, because a
          transformed ancestor would turn "fixed" into "relative to the article". */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white p-4 xl:static xl:mt-6 xl:border-0 xl:p-0">
        <div className="mx-auto max-w-[640px]">
          {hasPdf ? (
            <button
              type="button"
              onClick={() => void download()}
              disabled={downloading}
              className="btn btn-accent w-full text-sm font-semibold uppercase tracking-wider disabled:opacity-50"
            >
              {downloading ? "Preparando PDF…" : "Baixar meu diagnóstico em PDF"}
            </button>
          ) : null}
          <div aria-live="polite" className="min-h-[20px] text-center text-sm text-red-600">
            {error}
          </div>
        </div>
      </div>
    </>
  );
}
