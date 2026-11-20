import { describe, expect, it } from "vitest";
import {
  CONFIRMED_DELAY_MS,
  COPY_CONFIRMATION,
  IN_PROGRESS_RETRY_MS,
  MESSAGE_CHECK_FAILED,
  MESSAGE_NOT_PAID,
  PAYMENT_CHECK_INTERVAL_MS,
  PIX_VALIDITY_SECONDS,
  formatCountdown,
  formatPrice,
  secondsLeft,
  viewAfterCheck,
  viewAfterDelay,
} from "@/lib/diagnostico/checkout-state";

describe("checkout state helpers", () => {
  it("formatPrice formats 990 cents as R$ 9,90", () => {
    expect(formatPrice(990)).toBe("R$ 9,90");
    expect(formatPrice(1000)).toBe("R$ 10,00");
    expect(formatPrice(5)).toBe("R$ 0,05");
  });

  it("formatCountdown shows MM:SS", () => {
    expect(formatCountdown(1800)).toBe("30:00");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-4)).toBe("00:00");
  });

  it("secondsLeft counts down from expiresAt", () => {
    const now = Date.parse("2026-11-20T12:00:00.000Z");
    expect(secondsLeft("2026-11-20T12:30:00.000Z", now)).toBe(1800);
    expect(secondsLeft("2026-11-20T12:00:10.000Z", now)).toBe(10);
    expect(secondsLeft("2026-11-20T12:00:09.400Z", now)).toBe(10);
  });

  it("secondsLeft never returns a negative value", () => {
    const now = Date.parse("2026-11-20T12:00:00.000Z");
    expect(secondsLeft("2026-11-20T11:00:00.000Z", now)).toBe(0);
    expect(secondsLeft("2026-11-20T12:00:00.000Z", now)).toBe(0);
  });

  it("PIX_VALIDITY_SECONDS is 1800", () => {
    expect(PIX_VALIDITY_SECONDS).toBe(1800);
  });

  it("IN_PROGRESS_RETRY_MS is 2000", () => {
    expect(IN_PROGRESS_RETRY_MS).toBe(2000);
  });

  it("copy confirmation text is Código Pix copiado!", () => {
    expect(COPY_CONFIRMATION).toBe("Código Pix copiado!");
  });

  it("payment check interval is 5000 ms", () => {
    expect(PAYMENT_CHECK_INTERVAL_MS).toBe(5000);
  });

  it("the not-paid message matches the PRD text", () => {
    expect(MESSAGE_NOT_PAID).toBe(
      "Ainda não identificamos seu pagamento. Pode levar alguns instantes — tente novamente.",
    );
    expect(MESSAGE_CHECK_FAILED).toBe("Não conseguimos verificar agora. Tente novamente.");
  });

  it("the view moves to confirmed on an approved answer", () => {
    expect(viewAfterCheck({ state: "approved" })).toBe("confirmed");
    expect(viewAfterCheck({ state: "pending" })).toBe("pending");
    expect(viewAfterCheck({ state: "expired" })).toBe("expired");
  });

  it("the view moves to preparing after the confirmation delay", () => {
    expect(CONFIRMED_DELAY_MS).toBe(2000);
    expect(viewAfterDelay("confirmed")).toBe("preparing");
    expect(viewAfterDelay("pending")).toBe("pending");
  });
});
