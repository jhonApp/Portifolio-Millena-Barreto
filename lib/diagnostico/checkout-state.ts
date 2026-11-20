// Pure helpers for the checkout screen. Safe to import in the browser and on the server.

/** How long a Pix charge is valid (spec RF-05). */
export const PIX_VALIDITY_SECONDS = 1800;
/** Wait before asking again while another request is creating the charge. */
export const IN_PROGRESS_RETRY_MS = 2000;
export const IN_PROGRESS_MAX_RETRIES = 5;
export const COPY_CONFIRMATION = "Código Pix copiado!";
export const COPY_CONFIRMATION_MS = 3000;

/** Whole seconds until the expiry; never negative. */
export function secondsLeft(expiresAtIso: string, nowMs: number): number {
  const diff = Math.ceil((new Date(expiresAtIso).getTime() - nowMs) / 1000);
  return diff > 0 ? diff : 0;
}

/** "MM:SS". */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

// --- RF-06: payment confirmation ---

/** The checkout screen asks the server about the payment this often while it waits. */
export const PAYMENT_CHECK_INTERVAL_MS = 5000;
/** "Pagamento confirmado!" stays this long before "Estamos preparando seu diagnóstico…". */
export const CONFIRMED_DELAY_MS = 2000;

export const MESSAGE_NOT_PAID =
  "Ainda não identificamos seu pagamento. Pode levar alguns instantes — tente novamente.";
export const MESSAGE_CHECK_FAILED = "Não conseguimos verificar agora. Tente novamente.";
export const TITLE_CONFIRMED = "Pagamento confirmado!";
export const TITLE_PREPARING = "Estamos preparando seu diagnóstico…";

export type PaymentView = "pending" | "confirmed" | "preparing" | "expired";

/** What the screen shows after the server answers a payment check. */
export function viewAfterCheck(answer: { state: string }): PaymentView {
  if (answer.state === "approved") return "confirmed";
  if (answer.state === "expired") return "expired";
  return "pending";
}

/** "Pagamento confirmado!" gives way to "Estamos preparando seu diagnóstico…" after the delay. */
export function viewAfterDelay(view: PaymentView): PaymentView {
  return view === "confirmed" ? "preparing" : view;
}

/** 990 -> "R$ 9,90". */
export function formatPrice(cents: number): string {
  const reais = Math.floor(cents / 100);
  const rest = cents % 100;
  return `R$ ${reais},${String(rest).padStart(2, "0")}`;
}
