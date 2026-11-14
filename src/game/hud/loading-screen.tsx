"use client";

import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { SlimeMark } from "@/components/shell/logo";

const LINES = ["Waking the slimes…", "Polishing the stalls…", "Counting coins…", "Filling the fountain…", "Lighting the lanterns…"];
/** After this long, offer a way past the loader. */
const OFFER_SKIP_MS = 6_000;
/** Once the town data is in, never hold the player longer than this, even if 3D is still streaming. */
const GIVE_UP_MS = 15_000;

/** Shown while the town loads: real progress, small jokes, and never a trap. */
export function LoadingScreen({ done }: { done: boolean }) {
  const { progress } = useProgress();
  const [line, setLine] = useState(0);
  const [gone, setGone] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setLine((l) => (l + 1) % LINES.length), 1400);
    const skip = setTimeout(() => setCanSkip(true), OFFER_SKIP_MS);
    return () => {
      clearInterval(id);
      clearTimeout(skip);
    };
  }, []);
  useEffect(() => {
    if (!done) return;
    if (progress >= 100) {
      const t = setTimeout(() => setGone(true), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setGone(true), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [done, progress]);
  if (gone) return null;
  const pct = Math.round(done ? progress : Math.min(progress, 90));
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-bg transition-opacity duration-500 ${done && progress >= 100 ? "opacity-0" : "opacity-100"}`}>
      <div className="animate-bounce">
        <SlimeMark size={72} />
      </div>
      <h1 className="text-4xl font-semibold tracking-wide">Slimeworld</h1>
      <div className="h-2 w-64 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(6, pct)}%` }} />
      </div>
      <p className="text-ink-soft" aria-live="polite">
        {LINES[line]} {pct > 0 ? `${pct}%` : ""}
      </p>
      {canSkip && done && (
        <button type="button" onClick={() => setGone(true)} className="rounded-full border border-line px-4 py-2 text-sm font-medium">
          Taking a while? Jump in
        </button>
      )}
      {canSkip && !done && <p className="max-w-64 text-center text-sm text-ink-soft">Still connecting. A slow network can take a little longer.</p>}
    </div>
  );
}
