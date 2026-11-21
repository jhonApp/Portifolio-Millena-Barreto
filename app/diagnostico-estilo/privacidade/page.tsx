import type { Metadata } from "next";
import PrivacyPolicy from "@/components/Diagnostico/PrivacyPolicy";
import { getAppEnv } from "@/lib/diagnostico/env";

// The contact address comes from the environment: read at request time, and a missing value fails
// loudly instead of showing a policy with no way to reach the controller.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Política de Privacidade | Millena Barreto",
  description: "Como a plataforma Descubra Seu Estilo trata os seus dados pessoais.",
};

export default function PrivacyPage() {
  return <PrivacyPolicy contactEmail={getAppEnv().PRIVACY_CONTACT_EMAIL} />;
}
