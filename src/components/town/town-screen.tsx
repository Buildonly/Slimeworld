"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Card, ErrorNote, Loading } from "@/components/ui/states";
import type { TownDto } from "@/lib/dto";
import { usePoll } from "@/lib/use-poll";
import { ShopPanel } from "./shop-panel";
import { SHOP_EMOJI, shopColour } from "./shop-style";

const WorldView = dynamic(() => import("@/game/world-view").then((m) => m.WorldView), {
  ssr: false,
  loading: () => <Loading label="Building the town…" />,
});

export function TownScreen({ signedIn }: { signedIn: boolean }) {
  const { data, error, loading, refresh } = usePoll<TownDto>("/api/town", 6000);
  const [selected, setSelected] = useState<string | null>(null);
  if (loading && !data) return <Loading label="Walking into town…" />;
  if (error && !data) return <ErrorNote message={error} onRetry={refresh} />;
  if (!data) return null;
  const shop = data.shops.find((s) => s.id === selected) ?? null;
  const night = data.clock.hour >= 20 || data.clock.hour < 6;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="flex min-w-0 flex-col gap-3">
        <div
          className="relative h-[52dvh] min-h-80 overflow-hidden rounded-3xl md:h-[60dvh]"
          style={{ background: night ? "linear-gradient(#1d2246,#3b3160)" : "linear-gradient(#bfe6ff,#fff3df)" }}
        >
          <WorldView town={data} highlight={selected} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Shops">
          {data.shops.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={selected === s.id}
              onClick={() => setSelected(s.id)}
              className="flex shrink-0 items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm aria-selected:bg-ink aria-selected:text-bg"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.status === "closed" ? "#9a948c" : shopColour(s.id) }} />
              {SHOP_EMOJI[s.id]} {s.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <Card>{shop ? <ShopPanel shop={shop} signedIn={signedIn} onChanged={refresh} /> : <p className="py-6 text-center text-ink-soft">Tap a stall to see its prices and why.</p>}</Card>
        <Card>
          <h2 className="mb-2 font-semibold">Town news</h2>
          {data.events.length ? (
            <ul className="space-y-2 text-sm">
              {data.events.slice(0, 8).map((e, i) => (
                <li key={`${e.tick}-${i}`} className="flex gap-2">
                  <span className="shrink-0 text-ink-soft">Day {Math.floor(e.tick / 24) + 1}</span>
                  <span>{e.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">A quiet day in town.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
