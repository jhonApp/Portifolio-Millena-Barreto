import LoadingLine from "@/components/Diagnostico/LoadingLine";
import { QUESTION_TRANSITION_LABEL, QUESTION_TRANSITION_MS } from "@/lib/diagnostico/loading";

/**
 * The pause between two questions (loading feedback RF-03): the shared loading line with the
 * question wait and text. It has no hooks and takes no props. It is never shown under reduced
 * motion (the screen moves on at once), so the line always animates.
 */
export default function QuestionTransition() {
  return <LoadingLine label={QUESTION_TRANSITION_LABEL} durationMs={QUESTION_TRANSITION_MS} reduceMotion={false} />;
}
