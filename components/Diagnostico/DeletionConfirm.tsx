"use client";

import Link from "next/link";
import { useState } from "react";
import { DELETION_EXPIRED_NOTICE, DELETION_PATH } from "@/lib/diagnostico/paths";

type State = "ready" | "sending" | "completed" | "pending" | "expired" | "error";

const MESSAGES = {
  completed: "Exclusão concluída. Enviamos uma confirmação por e-mail.",
  pending: "Recebemos sua confirmação. Avisaremos por e-mail quando a exclusão for concluída.",
  error: "Não conseguimos concluir agora. Tente novamente em instantes.",
} as const;

// Step 2 of the deletion flow: opening the link changes nothing; only this click deletes.
export default function DeletionConfirm({ token }: { token: string }) {
  const [state, setState] = useState<State>("ready");

  async function confirm() {
    setState("sending");
    try {
      const response = await fetch("/api/diagnostico/privacy/deletion/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (response.status === 410) return setState("expired");
      if (!response.ok) return setState("error");
      const body = (await response.json()) as { state: "completed" | "pending" };
      setState(body.state);
    } catch {
      setState("error");
    }
  }

  if (state === "completed" || state === "pending") {
    return (
      <p role="status" className="rounded-lg bg-accent/10 p-4 text-base text-primary">
        {MESSAGES[state]}
      </p>
    );
  }

  if (state === "expired") {
    return (
      <div role="alert">
        <p className="text-base text-primary">{DELETION_EXPIRED_NOTICE}</p>
        <Link href={DELETION_PATH} className="btn btn-accent mt-6 w-full text-sm font-semibold uppercase tracking-wider">
          Fazer novo pedido
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div aria-live="polite" className="min-h-[20px] text-sm text-red-600">
        {state === "error" ? MESSAGES.error : ""}
      </div>
      <button
        type="button"
        onClick={confirm}
        disabled={state === "sending"}
        className="btn btn-accent mt-2 w-full text-sm font-semibold uppercase tracking-wider disabled:opacity-50"
      >
        {state === "sending" ? "Excluindo…" : "Confirmar exclusão"}
      </button>
    </div>
  );
}
