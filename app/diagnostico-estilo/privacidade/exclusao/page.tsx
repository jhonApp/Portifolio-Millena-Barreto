import type { Metadata } from "next";
import Link from "next/link";
import DeletionRequestForm from "@/components/Diagnostico/DeletionRequestForm";
import { PRIVACY_PATH } from "@/lib/diagnostico/paths";

export const metadata: Metadata = {
  title: "Excluir meus dados | Millena Barreto",
  robots: { index: false, follow: false },
};

// Step 1 of 2: the customer types the e-mail; the confirmation link arrives by e-mail.
export default function DeletionRequestPage() {
  return (
    <section className="mx-auto max-w-[560px] py-4 xl:py-12">
      <h1 className="font-primary text-[40px] leading-none text-primary xl:text-[64px]">Excluir meus dados</h1>
      <p className="mt-4 text-sm text-secondary">
        Informe o e-mail que você usou na compra. Se existirem dados para ele, enviaremos um link para você confirmar a
        exclusão.
      </p>
      <div className="mt-8">
        <DeletionRequestForm />
      </div>
      <p className="mt-8 text-sm text-secondary">
        Veja o que guardamos e por quanto tempo na{" "}
        <Link href={PRIVACY_PATH} className="text-accent underline underline-offset-4">
          Política de Privacidade
        </Link>
        .
      </p>
    </section>
  );
}
