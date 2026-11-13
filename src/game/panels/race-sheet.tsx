"use client";

import { Button } from "@/components/ui/button";
import type { ContestDto, EventDto } from "@/lib/dto";
import { formatBits } from "@/lib/format";
import { GameSheet } from "./sheet";

export function RaceSheet({ contests, results, slimeName, busy, onEnter, onClose }: { contests: ContestDto[]; results: EventDto[]; slimeName: string; busy: boolean; onEnter: (kind: "race" | "puzzle") => void; onClose: () => void }) {
  const next = (kind: "race" | "puzzle") => contests.filter((c) => c.kind === kind).sort((a, b) => a.startsIn - b.startsIn)[0];
  return (
    <GameSheet title="🏁 Race ground" subtitle="Speed wins races, smarts win puzzles. Winners share the pot." onClose={onClose}>
      <div className="grid gap-2">
        {(["race", "puzzle"] as const).map((kind) => {
          const c = next(kind);
          return (
            <div key={kind} className="flex items-center gap-3 rounded-2xl bg-bg-soft p-3">
              <span className="text-3xl">{kind === "race" ? "🏃" : "🧩"}</span>
              <span className="flex-1">
                <span className="block font-semibold">{kind === "race" ? "Hop race" : "Puzzle contest"}</span>
                <span className="block text-xs text-ink-soft">
                  {c ? `${c.entrants} entered · starts in ${c.startsIn}h · entry 🪙 ${formatBits(c.entry)}` : "The next one opens soon"}
                </span>
              </span>
              <Button disabled={busy || !c || c.mine} onClick={() => onEnter(kind)}>
                {c?.mine ? "Entered" : "Enter"}
              </Button>
            </div>
          );
        })}
      </div>
      <h3 className="mb-1 mt-4 font-semibold">Recent winners</h3>
      {results.length ? (
        <ul className="space-y-1 text-sm">
          {results.slice(0, 5).map((e, i) => (
            <li key={i}>🏆 {e.text}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">No results yet. {slimeName} could be the first!</p>
      )}
    </GameSheet>
  );
}
