import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Questionnaire from "@/components/Diagnostico/Questionnaire";
import { getActiveAttemptId } from "@/lib/diagnostico/answers";
import { EXPIRED_PATH } from "@/lib/diagnostico/paths";
import { loadQuestionnaire } from "@/lib/diagnostico/questionnaire-page";
import { getSupabaseAdmin } from "@/lib/diagnostico/supabase-server";

// Depends on the attempt cookie, so it is always rendered on the server for each request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vamos descobrir o seu estilo? | Millena Barreto",
  robots: { index: false, follow: false },
};

export default async function QuestionnairePage() {
  const db = getSupabaseAdmin();
  const attemptId = await getActiveAttemptId(db, cookies());
  if (!attemptId) redirect(EXPIRED_PATH);

  // The browser receives only the public question set (no style, no weight) and its own answers.
  const initial = await loadQuestionnaire(db, attemptId);
  return <Questionnaire initial={initial} />;
}
