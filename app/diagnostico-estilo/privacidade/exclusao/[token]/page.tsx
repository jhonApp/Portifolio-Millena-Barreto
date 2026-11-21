import type { Metadata } from "next";
import Link from "next/link";
import DeletionConfirm from "@/components/Diagnostico/DeletionConfirm";
import { isDeletionTokenUsable } from "@/lib/diagnostico/deletion";
import { DELETION_EXPIRED_NOTICE, DELETION_PATH } from "@/lib/diagnostico/paths";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";

// The token is the credential: always rendered on the server, never indexed, never sent to other
// sites in a Referer header. Opening this page deletes nothing.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirmar exclusão | Millena Barreto",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function DeletionConfirmPage({ params }: { params: { token: string } }) {
  const usable = await isDeletionTokenUsable(getSupabaseAdmin(), params.token);

  if (!usable) {
    return (
      <section className="mx-auto max-w-[560px] py-8 text-center">
        <h1 className="font-primary text-[34px] leading-none text-primary xl:text-[48px]">{DELETION_EXPIRED_NOTICE}</h1>
        <Link href={DELETION_PATH} className="btn btn-accent mt-8 w-full text-sm font-semibold uppercase tracking-wider">
          Fazer novo pedido
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[560px] py-4 xl:py-12">
      <h1 className="font-primary text-[40px] leading-none text-primary xl:text-[56px]">
        Confirmar exclusão dos meus dados
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-secondary">
        Vamos apagar o seu cadastro, as suas respostas, o seu diagnóstico, o arquivo PDF e os links de acesso. Fica
        guardado apenas o registro do pagamento (número do pedido, valor e data), sem ligação com você, como a lei exige
        para fins fiscais. Esta ação não pode ser desfeita.
      </p>
      <div className="mt-8">
        <DeletionConfirm token={params.token} />
      </div>
    </section>
  );
}
