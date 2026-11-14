"use client";

import { useCallback, useState } from "react";
import type { StepId } from "./first-day";

const key = (slimeId: string) => `slimeworld-first-day-${slimeId}`;

function read(slimeId: string | null): Set<StepId> {
  if (!slimeId) return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key(slimeId)) ?? "[]") as StepId[]);
  } catch {
    return new Set();
  }
}

/** Which first-day steps this slime's keeper has done, remembered on this device. */
export function useFirstDay(slimeId: string | null) {
  const [state, setState] = useState<{ id: string | null; done: Set<StepId> }>(() => ({ id: slimeId, done: read(slimeId) }));
  const done = state.id === slimeId ? state.done : read(slimeId);
  const mark = useCallback(
    (step: StepId | StepId[]) => {
      if (!slimeId) return;
      setState((prev) => {
        const base = prev.id === slimeId ? prev.done : read(slimeId);
        const next = new Set(base);
        for (const s of Array.isArray(step) ? step : [step]) next.add(s);
        if (next.size === base.size) return prev;
        try {
          localStorage.setItem(key(slimeId), JSON.stringify([...next]));
        } catch {
          // Private mode: the steps just won't be remembered next visit.
        }
        return { id: slimeId, done: next };
      });
    },
    [slimeId],
  );
  return { done, mark };
}
