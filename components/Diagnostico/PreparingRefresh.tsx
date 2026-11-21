"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PAYMENT_CHECK_INTERVAL_MS } from "@/lib/diagnostico/checkout-state";

/** The preparing state of the result screen: asks the server again every 5 seconds, without a visible reload. */
export default function PreparingRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), PAYMENT_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div role="status" className="py-8 text-center">
      <h1 className="font-primary text-[34px] leading-none text-primary xl:text-[48px]">
        Estamos preparando seu diagnóstico…
      </h1>
      <p className="mt-4 text-sm text-secondary">Isso leva só alguns instantes. Esta página se atualiza sozinha.</p>
    </div>
  );
}
