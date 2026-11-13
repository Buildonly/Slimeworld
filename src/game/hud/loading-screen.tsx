"use client";

import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { SlimeMark } from "@/components/shell/logo";

const LINES = ["Waking the slimes…", "Polishing the stalls…", "Counting coins…", "Filling the fountain…", "Lighting the lanterns…"];

/** Shown while the town loads: real progress, small jokes. */
export function LoadingScreen({ done }: { done: boolean }) {
  const { progress } = useProgress();
  const [line, setLine] = useState(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setLine((l) => (l + 1) % LINES.length), 1400);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!done || progress < 100) return;
    const t = setTimeout(() => setGone(true), 500);
    return () => clearTimeout(t);
  }, [done, progress]);
  if (gone) return null;
  const pct = done ? progress : Math.min(progress, 90);
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-bg transition-opacity duration-500 ${done && progress >= 100 ? "opacity-0" : "opacity-100"}`}>
      <div className="animate-bounce">
        <SlimeMark size={72} />
      </div>
      <h1 className="text-4xl font-semibold tracking-wide">Slimeworld</h1>
      <div className="h-2 w-64 overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(6, pct)}%` }} />
      </div>
      <p className="text-ink-soft" aria-live="polite">
        {LINES[line]}
      </p>
    </div>
  );
}
