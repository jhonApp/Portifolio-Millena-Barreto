import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Questionnaire from "@/components/Diagnostico/Questionnaire";
import { getActiveAttemptId } from "@/lib/diagnostico/answers";
import {
  EXPIRED_PATH,
  INCOMPLETE_NOTICE,
  QUESTIONNAIRE_UNAVAILABLE_NOTICE,
  VERSION_CHANGED_NOTICE,
} from "@/lib/diagnostico/paths";
import { loadQuestionnairePage } from "@/lib/diagnostico/questionnaire-page";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";

// Depends on the attempt cookie, so it is always rendered on the server for each request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vamos descobrir o seu estilo? | Millena Barreto",
  robots: { index: false, follow: false },
};

export default async function QuestionnairePage({
  searchParams,
}: {
  searchParams?: { aviso?: string };
}) {
  const db = getSupabaseAdmin();
  const attemptId = await getActiveAttemptId(db, cookies());
  if (!attemptId) redirect(EXPIRED_PATH);

  // The browser receives only the public question set (no style, no weight) and its own answers.
  const page = await loadQuestionnairePage(db, attemptId);
  if (page.status === "expired") redirect(EXPIRED_PATH);
  if (page.status === "unavailable") {
    // No personal data in the log.
    console.error("questionnaire page: no questionnaire version is published");
    return (
      <section className="mx-auto max-w-[640px] py-4 xl:py-10">
        <h1 className="font-primary text-[36px] leading-none text-primary xl:text-[56px]">
          Vamos descobrir o seu estilo?
        </h1>
        <p role="status" className="mt-6 text-base text-secondary">
          {QUESTIONNAIRE_UNAVAILABLE_NOTICE}
        </p>
      </section>
    );
  }

  // Sent back from the completion or checkout page when some answers are missing (RF-05), or from
  // the questionnaire itself when a new version was published under an open page (RF-02).
  const aviso = searchParams?.aviso;
  const notice =
    aviso === "incompleto" ? INCOMPLETE_NOTICE : aviso === "atualizado" ? VERSION_CHANGED_NOTICE : undefined;
  // Keyed by version: a refreshed page on another version starts from a clean screen state.
  return <Questionnaire key={page.initial.questionSet.versionId} initial={page.initial} notice={notice} />;
}
