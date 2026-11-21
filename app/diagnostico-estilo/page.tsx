import type { Metadata } from "next";
import RegistrationForm from "@/components/Diagnostico/RegistrationForm";
import { SESSION_EXPIRED_NOTICE } from "@/lib/diagnostico/paths";

export const metadata: Metadata = {
  title: "Descubra o seu estilo | Millena Barreto",
  description:
    "Responda a 15 perguntas e descubra quais estilos representam sua personalidade e sua maneira de se vestir.",
};

// Entry page of the diagnosis, reached from the existing landing page.
export default function DiagnosticoEntryPage({
  searchParams,
}: {
  searchParams?: { sessao?: string };
}) {
  const expired = searchParams?.sessao === "expirada";
  return (
    <section className="mx-auto max-w-[560px] py-4 xl:py-12">
      {expired ? (
        <p role="status" className="mb-6 rounded-lg bg-accent/10 p-3 text-sm text-primary">
          {SESSION_EXPIRED_NOTICE}
        </p>
      ) : null}
      <h1 className="font-primary text-[40px] leading-none text-primary xl:text-[64px]">
        Antes de começar, vamos nos conhecer
      </h1>
      <p className="mt-4 text-sm text-secondary">
        15 perguntas · R$ 9,90 no Pix · resultado após a confirmação do pagamento
      </p>
      <div className="mt-8">
        <RegistrationForm />
      </div>
    </section>
  );
}
