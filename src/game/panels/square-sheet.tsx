"use client";

import Link from "next/link";
import { useState } from "react";
import { FriendsPanel } from "@/components/social/friends-panel";
import { LeaderboardView } from "@/components/social/leaderboard-view";
import { SlimeActions } from "@/components/social/slime-actions";
import { SlimeDot } from "@/components/social/slime-dot";
import { Empty } from "@/components/ui/states";
import type { EventDto, TownSlimeDto } from "@/lib/dto";
import { MOOD } from "@/lib/format";
import { GameSheet } from "./sheet";

const TABS = ["Ranks", "Friends", "Players", "News"] as const;
type Tab = (typeof TABS)[number];
const NEWS_ICON: Record<string, string> = { cheered: "💖", gift: "🎁", contest: "🏁", shop_closed: "🏚️", shop_reopened: "🏪", invested: "📈", season: "🌤️", hoard: "📦", asleep: "💤", woke: "☀️", fed_by_friend: "🍓" };

/** The fountain: the town's meeting place. Ranks, other players' slimes, and what's happening. */
export function SquareSheet({ slimes, events, giftMax, onClose, onChanged }: { slimes: TownSlimeDto[]; events: EventDto[]; giftMax: number; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>("Ranks");
  const friends = slimes.filter((s) => s.player && !s.mine);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <GameSheet title="⛲ Town square" subtitle="Meet other keepers and see who's winning." onClose={onClose} wide>
      <div className="mb-3 flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="shrink-0 rounded-full px-4 py-1.5 aria-selected:bg-ink aria-selected:text-bg">
            {t}
          </button>
        ))}
      </div>
      {tab === "Ranks" && <LeaderboardView compact />}
      {tab === "Friends" && <FriendsPanel />}
      {tab === "Players" &&
        (friends.length === 0 ? (
          <Empty title="No other keepers here yet">Invite friends from the Friends tab!</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((s) => (
              <li key={s.id} className="rounded-2xl bg-bg-soft p-3">
                <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
                  <SlimeDot colour={s.colour} />
                  <span className="flex-1 font-semibold">{s.name}</span>
                  <span className="text-sm text-ink-soft">{s.working ? "💼 At work" : `${MOOD[s.state]?.emoji ?? ""} ${MOOD[s.state]?.label ?? ""}`}</span>
                </button>
                {open === s.id && (
                  <div className="mt-3 flex flex-col gap-2">
                    <SlimeActions slimeId={s.id} name={s.name} canGift signedIn giftMax={giftMax} onDone={onChanged} />
                    <Link href={`/slime/${s.id}`} className="text-sm text-accent underline">
                      See {s.name}&apos;s page
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}
      {tab === "News" &&
        (events.length === 0 ? (
          <Empty title="All quiet">Nothing has happened yet today.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {events.map((e, i) => (
              <li key={`${e.tick}-${i}`} className="flex gap-2 rounded-xl bg-bg-soft px-3 py-2 text-sm">
                <span aria-hidden>{NEWS_ICON[e.kind] ?? "📰"}</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        ))}
    </GameSheet>
  );
}
