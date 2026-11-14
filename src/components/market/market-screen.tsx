"use client";

import { useState } from "react";
import { LineChart } from "@/components/ui/line-chart";
import { Button } from "@/components/ui/button";
import { Card, ErrorNote, Loading } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { HomeDto, ItemDto, MarketDto } from "@/lib/dto";
import { formatBits, ITEM_EMOJI } from "@/lib/format";
import { post, usePoll } from "@/lib/use-poll";

const FILTERS = ["All", "Food", "Toy", "Training", "Hat", "Material"] as const;

function ItemCard({ item, slime, onGive }: { item: ItemDto; slime: { id: string; name: string } | null; onGive: (id: string) => Promise<void> }) {
  const [why, setWhy] = useState(false);
  const base = Number(BigInt(item.base));
  const now = item.best ? Number(BigInt(item.best.price)) : null;
  const history = item.history.map((h) => Number(BigInt(h.price)));
  const ratio = now ? now / base : null;
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-bg-soft text-2xl">{ITEM_EMOJI[item.id]}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{item.title}</p>
          <p className="truncate text-sm text-ink-soft">{item.description}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{item.best ? `🪙 ${formatBits(item.best.price)}` : "Sold out"}</p>
          {ratio !== null && (
            <p className={`text-xs ${ratio > 1.05 ? "text-danger" : ratio < 0.95 ? "text-accent" : "text-ink-soft"}`}>
              {ratio > 1.05 ? "▲" : ratio < 0.95 ? "▼" : "•"} {ratio.toFixed(2)}× base
            </p>
          )}
        </div>
      </div>
      <LineChart values={history} reference={base} min={base * 0.5} max={base * 3} height={56} label={`${item.title} price over the last days, base ${formatBits(item.base)}`} colour={ratio && ratio > 1.05 ? "var(--danger)" : "var(--accent)"} />
      {item.best && (
        <button type="button" className="text-left text-sm text-ink-soft" onClick={() => setWhy((w) => !w)} aria-expanded={why}>
          Cheapest at <span className="font-medium text-ink">{item.best.shopName}</span> · {why ? "hide why" : "why this price?"}
        </button>
      )}
      {why && item.best && <p className="rounded-xl bg-bg-soft px-3 py-2 text-sm">💬 “{item.best.reason}”</p>}
      {slime && item.category !== "Material" && (
        <Button tone="soft" disabled={!item.best} onClick={() => onGive(item.id)}>
          Give to {slime.name}
        </Button>
      )}
    </Card>
  );
}

export function MarketScreen({ signedIn }: { signedIn: boolean }) {
  const toast = useToast();
  const { data, error, loading, refresh } = usePoll<MarketDto>("/api/market", 10_000);
  const { data: home } = usePoll<HomeDto>(signedIn ? "/api/home" : null, 15_000);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  if (loading && !data) return <Loading label="Opening the market…" />;
  if (error && !data) return <ErrorNote message={error} onRetry={refresh} />;
  if (!data) return null;
  const slime = home?.slimes[0] ? { id: home.slimes[0].id, name: home.slimes[0].name } : null;
  const items = data.items.filter((i) => filter === "All" || i.category === filter);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Market</h1>
        <p className="text-ink-soft">Prices move with stock and demand. The dashed line is each item&apos;s normal price.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Item types">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className="shrink-0 rounded-full border border-line px-4 py-1.5 aria-selected:bg-ink aria-selected:text-bg">
            {f}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            slime={slime}
            onGive={async (itemId) => {
              const r = await post("/api/actions", { action: "give", slimeId: slime!.id, itemId });
              toast(r.ok ? r.message ?? "Given!" : r.error ?? "Could not buy that.", r.ok ? "ok" : "error");
              if (r.ok) await refresh();
            }}
          />
        ))}
      </div>
    </div>
  );
}
