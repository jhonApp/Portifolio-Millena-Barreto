import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Checkout from "@/components/Diagnostico/Checkout";
import { resolveCheckoutAccess } from "@/lib/diagnostico/checkout";
import { PRICE_CENTS } from "@/lib/diagnostico/constants";
import { formatPrice } from "@/lib/diagnostico/checkout-state";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";

// Depends on the attempt cookie, so it is always rendered on the server for each request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagamento | Millena Barreto",
  robots: { index: false, follow: false },
};

const BENEFITS = [
  "Identificação do seu estilo predominante",
  "Identificação do seu estilo secundário",
  "Descrição dos estilos identificados",
  "Sugestões de roupas e combinações",
  "Orientações para expressar sua personalidade através da imagem",
  "Relatório personalizado em PDF",
];

export default async function CheckoutPage() {
  // Creates nothing: the Pix is requested by the client component after the page loads.
  const access = await resolveCheckoutAccess(getSupabaseAdmin(), cookies());
  if (!access.ok) redirect((access as { redirectTo: string }).redirectTo);

  return (
    <section className="mx-auto max-w-[560px] py-4 xl:py-10">
      <h1 className="font-primary text-[36px] leading-none text-primary xl:text-[56px]">
        Diagnóstico de Estilo Pessoal — Millena Barreto
      </h1>
      <p className="mt-4 text-lg font-semibold text-primary">
        {formatPrice(PRICE_CENTS)} — pagamento único via Pix
      </p>

      <ul className="mt-6 space-y-2 text-sm text-secondary">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex gap-2">
            <span aria-hidden="true" className="text-accent">
              ✓
            </span>
            {benefit}
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-lg border border-neutral-300 p-5">
        <Checkout />
      </div>

      <p className="mt-4 text-center text-xs text-secondary">
        Pagamento processado com segurança pela AbacatePay.
      </p>
    </section>
  );
}
