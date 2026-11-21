"use client";

import { useState } from "react";
import { RESEND_NEUTRAL_MESSAGE } from "@/lib/diagnostico/paths";

const INVALID_EMAIL = "Informe um e-mail válido.";
const SEND_ERROR = "Não conseguimos enviar agora. Tente novamente em instantes.";

export default function ResendLinkForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/diagnostico/result/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.status === 400) setError(INVALID_EMAIL);
      else if (!response.ok) setError(SEND_ERROR);
      else setDone(true);
    } catch {
      setError(SEND_ERROR);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="rounded-lg bg-accent/10 p-4 text-base text-primary">
        {RESEND_NEUTRAL_MESSAGE}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <label htmlFor="resend-email" className="text-sm font-medium text-primary">
        E-mail usado na compra
      </label>
      <input
        id="resend-email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="input"
        aria-invalid={error === INVALID_EMAIL}
      />
      <div aria-live="polite" className="min-h-[20px] text-sm text-red-600">
        {error}
      </div>
      <button
        type="submit"
        disabled={sending}
        className="btn btn-accent w-full text-sm font-semibold uppercase tracking-wider disabled:opacity-50"
      >
        {sending ? "Enviando…" : "Enviar novo link"}
      </button>
    </form>
  );
}
