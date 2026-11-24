import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CheckoutLink from "@/components/Diagnostico/CheckoutLink";
import { getAttemptVersion } from "@/lib/diagnostico/answers";
import { resolveCheckoutAccess } from "@/lib/diagnostico/checkout";
import { formatPrice } from "@/lib/diagnostico/checkout-state";
import { PRICE_CENTS } from "@/lib/diagnostico/constants";
import { CHECKOUT_PATH } from "@/lib/diagnostico/paths";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";

// Depends on the attempt cookie, so it is always rendered on the server for each request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Questionário concluído | Millena Barreto",
  robots: { index: false, follow: false },
};

export default async function CompletionPage() {
  const access = await resolveCheckoutAccess(getSupabaseAdmin(), cookies());
  if (!access.ok) redirect((access as { redirectTo: string }).redirectTo);
  // Version 2 attempts wait on a loading screen while the checkout opens; version 1 keeps the plain link.
  const version = await getAttemptVersion(getSupabaseAdmin(), access.attemptId);

  return (
    <section className="mx-auto max-w-[560px] py-4 xl:py-12">
      <h1 className="font-primary text-[40px] leading-none text-primary xl:text-[64px]">
        Você está a um passo de descobrir sua essência!
      </h1>
      <p className="mt-4 text-base text-secondary">
        Suas respostas foram registradas. Agora, vamos transformar suas escolhas em um diagnóstico
        personalizado para revelar seus estilos predominantes.
      </p>

      <ul className="mt-8 space-y-2 rounded-lg border border-neutral-300 p-5 text-sm text-primary">
        <li className="font-semibold">Questionário concluído</li>
        <li>15 de 15 perguntas respondidas</li>
        <li>Produto: Diagnóstico de Estilo Pessoal</li>
        <li>Valor: {formatPrice(PRICE_CENTS)}</li>
      </ul>

      {version !== null && version >= 2 ? (
        <CheckoutLink />
      ) : (
        <Link
          href={CHECKOUT_PATH}
          className="btn btn-accent mt-8 w-full text-center text-sm font-semibold uppercase tracking-wider"
        >
          RECEBER MEU DIAGNÓSTICO
        </Link>
      )}
    </section>
  );
}
