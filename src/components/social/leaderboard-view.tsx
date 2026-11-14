"use client";

import Link from "next/link";
import { useState } from "react";
import { Empty, ErrorNote, Loading } from "@/components/ui/states";
import type { Board, BoardId } from "@/economy/leaderboard";
import { formatBits } from "@/lib/format";
import { usePoll } from "@/lib/use-poll";
import { SlimeDot } from "./slime-dot";

type Data = { boards: Board[]; places: Partial<Record<BoardId, { rank: number; of: number } | null>> };
const MEDAL = ["🥇", "🥈", "🥉"];
const SLIME_BOARDS: BoardId[] = ["richest", "earners", "champions", "cheered"];

function value(v: string, unit: string): string {
  if (unit === "coins") return `🪙 ${formatBits(v)}`;
  return `${v} ${Number(v) === 1 ? unit.replace(/s$/, "") : unit}`;
}

/** The town's rankings, one board at a time. */
export function LeaderboardView({ compact }: { compact?: boolean }) {
  const { data, error, refresh } = usePoll<Data>("/api/leaderboard", 15_000);
  const [tab, setTab] = useState<BoardId>("richest");
  if (error && !data) return <ErrorNote message="The rankings didn't load." onRetry={refresh} />;
  if (!data) return <Loading label="Counting coins…" />;
  const board = data.boards.find((b) => b.id === tab) ?? data.boards[0]!;
  const place = data.places[board.id];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Rankings">
        {data.boards.map((b) => (
          <button key={b.id} role="tab" aria-selected={b.id === board.id} onClick={() => setTab(b.id)} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm aria-selected:bg-ink aria-selected:text-bg">
            {b.title}
          </button>
        ))}
      </div>
      <p className="text-sm text-ink-soft">{board.blurb}</p>
      {board.entries.length === 0 ? (
        <Empty title="No one yet">Be the first on this board!</Empty>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {board.entries.map((e) => {
            const row = (
              <>
                <span className="w-7 text-center text-lg font-semibold">{MEDAL[e.rank - 1] ?? e.rank}</span>
                {SLIME_BOARDS.includes(board.id) && <SlimeDot colour={e.colour} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {e.name} {e.mine && <span className="rounded-full bg-accent/20 px-2 text-xs text-accent">you</span>}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">{e.sub}</span>
                </span>
                <span className="shrink-0 font-semibold">{value(e.value, e.unit)}</span>
              </>
            );
            const cls = `flex items-center gap-3 rounded-2xl p-2.5 ${e.mine ? "bg-accent/15 ring-1 ring-accent/40" : "bg-bg-soft"}`;
            return (
              <li key={e.id}>
                {SLIME_BOARDS.includes(board.id) ? (
                  <Link href={`/slime/${e.id}`} className={`${cls} hover:brightness-95`}>
                    {row}
                  </Link>
                ) : (
                  <div className={cls}>{row}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {place && !board.entries.some((e) => e.mine) && <p className="text-sm text-ink-soft">Your best slime is #{place.rank} of {place.of}. Keep going!</p>}
      {!compact && <p className="text-xs text-ink-soft">Updated live from the town.</p>}
    </div>
  );
}
