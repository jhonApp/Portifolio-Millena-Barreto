"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { HANDOFF_TIMEOUT_MS, handoffView, scheduleAdvance, type HandoffView } from "@/lib/diagnostico/loading";

/**
 * Navigates to `path` and tells the screen whether the next page is still opening (loading feedback
 * RF-04). The navigation runs inside a transition, so `pending` stays true until the new route has
 * rendered. A second call while it is pending does nothing, except the retry offered after the
 * wait passed HANDOFF_TIMEOUT_MS. The wait is cancelled when the navigation ends or the screen leaves.
 */
export function useHandoffNavigation(path: string): { view: HandoffView; go: () => void } {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [timedOut, setTimedOut] = useState(false);
  const locked = useRef(false);
  const timedOutRef = useRef(false);
  const cancelTimer = useRef<(() => void) | null>(null);

  function setTimeout_(value: boolean) {
    timedOutRef.current = value;
    setTimedOut(value);
  }

  // The navigation ended (the new page rendered, or the route changed): reset everything.
  useEffect(() => {
    if (pending) return;
    cancelTimer.current?.();
    cancelTimer.current = null;
    locked.current = false;
    setTimeout_(false);
  }, [pending]);

  useEffect(() => () => cancelTimer.current?.(), []);

  const go = useCallback(() => {
    if (locked.current && !timedOutRef.current) return;
    locked.current = true;
    setTimeout_(false);
    cancelTimer.current?.();
    cancelTimer.current = scheduleAdvance(HANDOFF_TIMEOUT_MS, () => setTimeout_(true));
    startTransition(() => {
      router.push(path);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, router]);

  return { view: handoffView(pending, timedOut), go };
}
