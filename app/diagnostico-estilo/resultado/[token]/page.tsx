import type { Metadata } from "next";
import Link from "next/link";
import PreparingRefresh from "@/components/Diagnostico/PreparingRefresh";
import ResultView from "@/components/Diagnostico/ResultView";
import type { Style } from "@/lib/diagnostico/constants";
import { EXPIRED_LINK_NOTICE, RESULT_PATH } from "@/lib/diagnostico/paths";
import { loadResultByToken } from "@/lib/diagnostico/result-page";
import { styleImageFor } from "@/lib/diagnostico/style-images";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";

// The token is the credential: always rendered on the server, never indexed, and never sent to
// other sites in a Referer header.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seu diagnóstico de estilo | Millena Barreto",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResultPage({ params }: { params: { token: string } }) {
  const state = await loadResultByToken(getSupabaseAdmin(), params.token);

  if (state.state === "invalid") {
    return (
      <section className="mx-auto max-w-[560px] py-8 text-center">
        <h1 className="font-primary text-[34px] leading-none text-primary xl:text-[48px]">{EXPIRED_LINK_NOTICE}</h1>
        <Link href={RESULT_PATH} className="btn btn-accent mt-8 w-full text-sm font-semibold uppercase tracking-wider">
          Pedir novo link
        </Link>
      </section>
    );
  }

  if (state.state === "unpaid") {
    return (
      <section className="mx-auto max-w-[560px] py-8 text-center">
        <h1 className="font-primary text-[34px] leading-none text-primary xl:text-[48px]">
          Pagamento ainda não confirmado
        </h1>
      </section>
    );
  }

  if (state.state === "preparing") {
    return (
      <section className="mx-auto max-w-[560px]">
        <PreparingRefresh />
      </section>
    );
  }

  return (
    <ResultView
      token={params.token}
      content={state.content}
      hasPdf={state.hasPdf}
      imageSrc={styleImageFor(state.content.predominant.style as Style)}
    />
  );
}
