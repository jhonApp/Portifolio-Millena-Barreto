import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Descubra o seu estilo | Millena Barreto",
  robots: { index: false, follow: false },
};

// Placeholder entry page: RF-02 (Customer Identification) replaces it.
export default function DiagnosticoEntryPage() {
  return (
    <section className="py-12 text-center xl:py-24">
      <h1 className="h1">Descubra o seu estilo</h1>
      <p className="lead mt-6">Em breve.</p>
    </section>
  );
}
