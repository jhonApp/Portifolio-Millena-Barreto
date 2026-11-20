"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  COPY_CONFIRMATION,
  COPY_CONFIRMATION_MS,
  IN_PROGRESS_MAX_RETRIES,
  IN_PROGRESS_RETRY_MS,
  formatCountdown,
  secondsLeft,
} from "@/lib/diagnostico/checkout-state";
import { EXPIRED_PATH, INCOMPLETE_PATH } from "@/lib/diagnostico/paths";

type Pix = { orderId: string; expiresAt: string; pixCode: string; qrImage: string };

type View =
  | { kind: "loading" }
  | { kind: "pending"; pix: Pix }
  | { kind: "expired" }
  | { kind: "paid" }
  | { kind: "error"; message: string };

const CHECKOUT_URL = "/api/diagnostico/checkout";
const RENEW_URL = "/api/diagnostico/checkout/renew";
const GENERIC_ERROR = "Não conseguimos gerar o Pix agora. Tente novamente em instantes.";

const STEPS = [
  "Abra o app do seu banco e escolha pagar com Pix.",
  "Escaneie o QR Code ou cole o código copiado.",
  "Confirme o pagamento e volte aqui para clicar em Já paguei.",
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function Checkout() {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [left, setLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);
  const expiring = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const firstView = useRef(true);

  const request = useCallback(
    async (url: string) => {
      setView({ kind: "loading" });
      expiring.current = false;
      for (let attempt = 0; attempt <= IN_PROGRESS_MAX_RETRIES; attempt++) {
        let response: Response;
        try {
          response = await fetch(url, { method: "POST" });
        } catch {
          setView({ kind: "error", message: GENERIC_ERROR });
          return;
        }
        if (response.status === 403) {
          router.replace(EXPIRED_PATH);
          return;
        }
        const body = await response.json().catch(() => null);
        const code: string | undefined = body?.error?.code;
        if (response.status === 409 && code === "ANSWERS_INCOMPLETE") {
          router.replace(INCOMPLETE_PATH);
          return;
        }
        if (response.status === 409 && code === "CHECKOUT_IN_PROGRESS") {
          await sleep(IN_PROGRESS_RETRY_MS);
          continue;
        }
        if (!response.ok) {
          setView({ kind: "error", message: body?.error?.message ?? GENERIC_ERROR });
          return;
        }
        if (body.state === "pending") {
          setLeft(secondsLeft(body.expiresAt, Date.now()));
          setView({
            kind: "pending",
            pix: { orderId: body.orderId, expiresAt: body.expiresAt, pixCode: body.pixCode, qrImage: body.qrImage },
          });
        } else if (body.state === "expired") {
          setView({ kind: "expired" });
        } else {
          setView({ kind: "paid" });
        }
        return;
      }
      setView({ kind: "error", message: GENERIC_ERROR });
    },
    [router],
  );

  // The page has no side effect of its own: the Pix is requested once, on mount.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void request(CHECKOUT_URL);
  }, [request]);

  // Countdown from the expiry time; at zero the server is asked once, which expires the order.
  const expiresAt = view.kind === "pending" ? view.pix.expiresAt : null;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => {
      const remaining = secondsLeft(expiresAt, Date.now());
      setLeft(remaining);
      if (remaining === 0 && !expiring.current) {
        expiring.current = true;
        clearInterval(timer);
        void request(CHECKOUT_URL);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, request]);

  // Move the focus to the state heading when the state changes (not on the first render).
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [view.kind]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard API unavailable: select the code so it can be copied by hand.
      codeRef.current?.focus();
      codeRef.current?.select();
      try {
        document.execCommand("copy");
      } catch {
        return;
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_CONFIRMATION_MS);
  }

  if (view.kind === "loading") {
    return (
      <p role="status" className="py-8 text-center text-secondary">
        Gerando seu Pix…
      </p>
    );
  }

  if (view.kind === "error") {
    return (
      <div role="alert" className="flex flex-col gap-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">
        <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-none">
          Algo deu errado
        </h2>
        <p>{view.message}</p>
        <button
          type="button"
          onClick={() => void request(CHECKOUT_URL)}
          className="btn border border-red-600 text-red-600"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (view.kind === "expired") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 ref={headingRef} tabIndex={-1} className="text-[22px] font-semibold text-primary outline-none">
          Seu Pix expirou
        </h2>
        <p className="text-sm text-secondary">
          Sem problema: suas respostas continuam salvas. Gere um novo Pix para pagar.
        </p>
        <button type="button" onClick={() => void request(RENEW_URL)} className="btn btn-accent w-full text-sm font-semibold uppercase tracking-wider">
          Gerar novo Pix
        </button>
      </div>
    );
  }

  if (view.kind === "paid") {
    return (
      <div className="text-center">
        <h2 ref={headingRef} tabIndex={-1} className="text-[22px] font-semibold text-primary outline-none">
          Seu pagamento já foi identificado.
        </h2>
      </div>
    );
  }

  const { pix } = view;
  return (
    <div className="flex flex-col items-center gap-4">
      <h2 ref={headingRef} tabIndex={-1} className="text-[22px] font-semibold text-primary outline-none">
        Pague com Pix
      </h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pix.qrImage}
        alt="QR Code do Pix"
        width={220}
        height={220}
        className="h-[220px] w-[220px] rounded-lg border border-neutral-300 bg-white object-contain"
      />
      <button
        type="button"
        onClick={() => void copyCode(pix.pixCode)}
        className="btn btn-accent w-full text-sm font-semibold uppercase tracking-wider"
      >
        Copiar código Pix
      </button>
      <p role="status" className="min-h-[20px] text-sm text-primary">
        {copied ? COPY_CONFIRMATION : ""}
      </p>
      <label className="w-full text-xs text-secondary">
        <span className="sr-only">Código Pix copia e cola</span>
        <textarea ref={codeRef} readOnly rows={3} value={pix.pixCode} className="input w-full resize-none break-all text-xs" />
      </label>

      <p className="text-sm font-medium text-primary">
        Seu Pix expira em <span>{formatCountdown(left)}</span>
      </p>
      <span className="sr-only" aria-live="polite">
        {`Seu Pix expira em ${Math.max(1, Math.ceil(left / 60))} minutos`}
      </span>

      <ol className="w-full list-decimal space-y-1 pl-5 text-sm text-secondary">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      {/* The behavior of this button belongs to RF-06; it stays disabled until then. */}
      <button type="button" disabled className="btn border border-neutral-300 w-full text-sm font-semibold uppercase tracking-wider text-primary disabled:opacity-50">
        Já paguei
      </button>
    </div>
  );
}
