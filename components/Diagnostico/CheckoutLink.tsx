"use client";

import { useReducedMotion } from "framer-motion";
import { HandoffError, HandoffLoading } from "@/components/Diagnostico/HandoffScreen";
import { useHandoffNavigation } from "@/components/Diagnostico/use-handoff-navigation";
import { HANDOFF_CHECKOUT_LABEL } from "@/lib/diagnostico/loading";
import { CHECKOUT_PATH } from "@/lib/diagnostico/paths";

/**
 * "RECEBER MEU DIAGNÓSTICO" for attempts on questionnaire version 2 (loading feedback RF-04). It
 * keeps the address and the look of the plain link, but a click runs the navigation in a transition
 * and swaps the button for "Preparando seu Pix…" and the loading line until the checkout renders.
 */
export default function CheckoutLink({ reduceMotion }: { reduceMotion?: boolean }) {
  const motionPreference = useReducedMotion();
  const handoff = useHandoffNavigation(CHECKOUT_PATH);
  const still = reduceMotion ?? Boolean(motionPreference);

  if (handoff.view === "loading") return <HandoffLoading label={HANDOFF_CHECKOUT_LABEL} reduceMotion={still} />;
  if (handoff.view === "failed") return <HandoffError onRetry={handoff.go} />;
  return (
    <a
      href={CHECKOUT_PATH}
      onClick={(event) => {
        // Let the browser handle modified clicks (new tab, new window).
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        handoff.go();
      }}
      className="btn btn-accent mt-8 w-full text-center text-sm font-semibold uppercase tracking-wider"
    >
      RECEBER MEU DIAGNÓSTICO
    </a>
  );
}
