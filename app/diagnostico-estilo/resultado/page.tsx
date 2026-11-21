import type { Metadata } from "next";
import ResendLinkForm from "@/components/Diagnostico/ResendLinkForm";

export const metadata: Metadata = {
  title: "Pedir novo link | Millena Barreto",
  robots: { index: false, follow: false },
};

// The customer lost the link of the e-mail: a new one is sent to the e-mail used in the purchase.
export default function RequestNewLinkPage() {
  return (
    <section className="mx-auto max-w-[560px] py-4 xl:py-12">
      <h1 className="font-primary text-[40px] leading-none text-primary xl:text-[64px]">Pedir novo link</h1>
      <p className="mt-4 text-sm text-secondary">
        Informe o e-mail que você usou na compra. Se houver um diagnóstico para ele, enviaremos um novo link.
      </p>
      <div className="mt-8">
        <ResendLinkForm />
      </div>
    </section>
  );
}
