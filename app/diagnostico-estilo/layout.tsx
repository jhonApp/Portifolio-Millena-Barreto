import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";
import PrivacyLink from "@/components/Diagnostico/PrivacyLink";

// Shell shared by every diagnosis page: logo only (no navigation menu, to keep the
// customer focused on the purchase flow), privacy link and the site footer.
export default function DiagnosticoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="container mx-auto px-6 py-6">
        <Logo />
      </header>
      <main className="container mx-auto flex-1 px-6 py-8">{children}</main>
      <div className="container mx-auto px-6 py-6 text-center">
        <PrivacyLink />
      </div>
      <Footer />
    </div>
  );
}
