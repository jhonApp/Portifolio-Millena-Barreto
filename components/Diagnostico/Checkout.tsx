"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONFIRMED_DELAY_MS,
  COPY_CONFIRMATION,
  COPY_CONFIRMATION_MS,
  IN_PROGRESS_MAX_RETRIES,
  IN_PROGRESS_RETRY_MS,
  MESSAGE_CHECK_FAILED,
  MESSAGE_NOT_PAID,
  PAYMENT_CHECK_INTERVAL_MS,
  TITLE_CONFIRMED,
  TITLE_PREPARING,
  formatCountdown,
  secondsLeft,
  shouldOpenResult,
  viewAfterCheck,
} from "@/lib/diagnostico/checkout-state";
import { EXPIRED_PATH, INCOMPLETE_PATH } from "@/lib/diagnostico/paths";

type Pix = { orderId: string; expiresAt: string; pixCode: string; qrImage: string };

type View =
  | { kind: "loading" }
  | { kind: "pending"; pix: Pix }
  | { kind: "expired" }
  | { kind: "confirmed" }
  | { kind: "preparing" }
  | { kind: "error"; message: string };

const CHECKOUT_URL = "/api/diagnostico/checkout";
const RENEW_URL = "/api/diagnostico/checkout/renew";
const CHECK_URL = "/api/diagnostico/payment/check";
const LINK_URL = "/api/diagnostico/result/link";
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
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<"" | "notPaid" | "failed">("");
  const started = useRef(false);
  const expiring = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const firstView = useRef(true);
  const resultReady = useRef(false);
  const navigating = useRef(false);

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
          // The attempt already has a paid order (the customer came back after paying).
          setView({ kind: "preparing" });
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

  // The diagnosis exists: ask for a link to the result and go there (once).
  async function goToResult() {
    if (navigating.current) return;
    navigating.current = true;
    try {
      const response = await fetch(LINK_URL, { method: "POST" });
      if (response.status === 403) {
        router.replace(EXPIRED_PATH);
        return;
      }
      if (response.ok) {
        const { path } = await response.json();
        router.replace(path);
        return;
      }
    } catch {
      // Fall through: the next check tries again.
    }
    navigating.current = false;
  }

  // "Já paguei" (manual) and the silent automatic check run the same server verification.
  async function checkPayment(manual: boolean) {
    if (manual) {
      setChecking(true);
      setNotice("");
    }
    try {
      const response = await fetch(CHECK_URL, { method: "POST" });
      if (response.status === 403) {
        router.replace(EXPIRED_PATH);
        return;
      }
      if (response.status === 404) {
        void request(CHECKOUT_URL);
        return;
      }
      if (!response.ok) {
        if (manual) setNotice("failed");
        return;
      }
      const answer = await response.json();
      const next = viewAfterCheck(answer);
      if (shouldOpenResult(answer)) resultReady.current = true;
      if (next === "confirmed") setView({ kind: "confirmed" });
      else if (next === "expired") void request(CHECKOUT_URL);
      else if (manual) setNotice("notPaid");
    } catch {
      if (manual) setNotice("failed");
    } finally {
      if (manual) setChecking(false);
    }
  }

  // While the Pix is valid the screen also asks by itself, without messages.
  const waiting = view.kind === "pending";
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void checkPayment(false), PAYMENT_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  // "Pagamento confirmado!" gives way to "Estamos preparando seu diagnóstico…".
  const confirmed = view.kind === "confirmed";
  useEffect(() => {
    if (!confirmed) return;
    const timer = setTimeout(() => {
      // "Pagamento confirmado!" shows for a moment; then the result (or the preparing state).
      if (resultReady.current) void goToResult();
      else setView({ kind: "preparing" });
    }, CONFIRMED_DELAY_MS);
    return () => clearTimeout(timer);
  }, [confirmed]);

  // After approval the status keeps being followed until the diagnosis exists.
  const preparing = view.kind === "preparing";
  useEffect(() => {
    if (!preparing) return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(CHECK_URL, { method: "POST" });
        if (response.status === 403) router.replace(EXPIRED_PATH);
        else if (response.ok && shouldOpenResult(await response.json())) void goToResult();
      } catch {
        // Silent: the next tick asks again.
      }
    }, PAYMENT_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [preparing, router]);

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

  if (view.kind === "confirmed" || view.kind === "preparing") {
    return (
      <div className="text-center" role="status">
        <h2 ref={headingRef} tabIndex={-1} className="text-[22px] font-semibold text-primary outline-none">
          {view.kind === "confirmed" ? TITLE_CONFIRMED : TITLE_PREPARING}
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

      <button
        type="button"
        onClick={() => void checkPayment(true)}
        disabled={checking}
        className="btn w-full border border-neutral-300 text-sm font-semibold uppercase tracking-wider text-primary disabled:opacity-50"
      >
        {checking ? "Verificando…" : "Já paguei"}
      </button>
      <div className="min-h-[20px] w-full text-center text-sm" aria-live="polite">
        {notice === "notPaid" ? (
          <p role="status" className="text-secondary">
            {MESSAGE_NOT_PAID}
          </p>
        ) : null}
        {notice === "failed" ? (
          <p role="alert" className="text-red-600">
            {MESSAGE_CHECK_FAILED}
          </p>
        ) : null}
      </div>
    </div>
  );
}
