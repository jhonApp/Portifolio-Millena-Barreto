import LoadingLine from "@/components/Diagnostico/LoadingLine";
import { HANDOFF_ERROR_MESSAGE, HANDOFF_FILL_MS, HANDOFF_FILL_TO } from "@/lib/diagnostico/loading";

/**
 * The wait while the next page opens (loading feedback RF-04): the shared loading line, filling
 * slowly toward 90%, with the status text. It has no hooks, so it can be rendered and tested
 * directly. The line is static under reduced motion and the text stays.
 */
export function HandoffLoading({ label, reduceMotion }: { label: string; reduceMotion: boolean }) {
  return (
    <div data-testid="handoff-loading" className="mx-auto mt-8 flex min-h-[160px] w-full max-w-[420px] items-center">
      <LoadingLine label={label} durationMs={HANDOFF_FILL_MS} endAt={HANDOFF_FILL_TO} reduceMotion={reduceMotion} />
    </div>
  );
}

/** Shown when the next page did not open in time: the answers are safe and the customer can retry. */
export function HandoffError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-testid="handoff-error"
      className="mx-auto mt-8 flex max-w-[420px] flex-col gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-600"
    >
      <p>{HANDOFF_ERROR_MESSAGE}</p>
      <button type="button" onClick={onRetry} className="btn border border-red-600 text-red-600">
        Tentar novamente
      </button>
    </div>
  );
}
