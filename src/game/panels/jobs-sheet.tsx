"use client";

import { Button } from "@/components/ui/button";
import type { JobDto } from "@/lib/dto";
import { formatBits } from "@/lib/format";
import { GameSheet } from "./sheet";

const JOB_LOOK: Record<string, { emoji: string; title: string; skill: string }> = {
  delivery: { emoji: "📦", title: "Delivery", skill: "speed" },
  helper: { emoji: "🧺", title: "Shop helper", skill: "charm" },
  guard: { emoji: "🛡️", title: "Guard", skill: "size" },
};

export function JobsSheet({ jobs, slimeName, energy, working, busy, onWork, onClose }: { jobs: JobDto[]; slimeName: string; energy: number; working: boolean; busy: boolean; onWork: () => void; onClose: () => void }) {
  return (
    <GameSheet title="📌 Job board" subtitle="Shops pin up work here. Better skills, better odds." onClose={onClose}>
      {jobs.length ? (
        <ul className="flex flex-col gap-2">
          {jobs.map((j, i) => {
            const look = JOB_LOOK[j.kind] ?? { emoji: "💼", title: j.kind, skill: "" };
            return (
              <li key={i} className="flex items-center gap-3 rounded-2xl bg-bg-soft p-3">
                <span className="text-2xl">{look.emoji}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{look.title}</span>
                  <span className="block text-xs text-ink-soft">
                    {j.shop ?? "A traveller"} · needs {look.skill}
                  </span>
                </span>
                <span className="font-semibold">🪙 {formatBits(j.wage)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-6 text-center text-ink-soft">No work pinned up right now. Shops post more when they get busy.</p>
      )}
      <Button size="lg" className="mt-4 w-full" disabled={busy || working || !jobs.length || energy < 10} onClick={onWork}>
        {working ? `${slimeName} is already at work` : energy < 10 ? `${slimeName} is too tired` : `Send ${slimeName} to the best job`}
      </Button>
    </GameSheet>
  );
}
