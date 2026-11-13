"use client";

import { LineChart } from "@/components/ui/line-chart";
import { Card } from "@/components/ui/states";
import type { WorldDto } from "@/lib/dto";
import { formatBits } from "@/lib/format";
import { MoodsBar } from "./moods-bar";

const WEATHER_EMOJI = (index: number) => (index > 15_000 ? "⛈️" : index > 12_000 ? "🌥️" : index < 8_500 ? "🍃" : "☀️");
const NEWS_EMOJI: Record<string, string> = { shop_closed: "🔒", shop_reopened: "🎉", invested: "💰", season: "📅", contest: "🏁", asleep: "💤", woke: "🌅", fed_by_friend: "🤝", hoard: "🤫" };

/** The economy at a glance. Used by the live World screen and by fast forward. */
export function WorldPanels({ world, highlight }: { world: WorldDto; highlight?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="flex items-center gap-4">
        <span className="text-5xl" aria-hidden="true">
          {WEATHER_EMOJI(world.weather.index)}
        </span>
        <div>
          <p className="text-sm text-ink-soft">Economy weather</p>
          <p className="text-lg font-semibold">{world.weather.label}</p>
          <p className="text-sm text-ink-soft">
            Prices at {(world.weather.index / 10_000).toFixed(2)}× normal {world.weather.trend === "up" ? "▲" : world.weather.trend === "down" ? "▼" : ""}
          </p>
        </div>
      </Card>
      <Card>
        <p className="mb-2 text-sm text-ink-soft">{world.population} slimes in town</p>
        <MoodsBar states={world.states} />
      </Card>
      <Card>
        <p className="text-sm text-ink-soft">Price index by day (1.0 = normal)</p>
        <LineChart values={world.priceIndex.map((p) => p.index / 10_000)} reference={1} min={0.5} max={2} height={72} label="Average price compared to normal, by day" />
      </Card>
      <Card className="md:col-span-2">
        <h2 className="mb-2 font-semibold">Shops</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {world.shops.map((s) => (
            <li key={s.id} className={`flex items-center gap-3 rounded-2xl p-3 ${s.open ? "bg-bg-soft" : "bg-danger/10"}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name}</p>
                <p className={`text-sm ${s.open ? "text-ink-soft" : "font-semibold text-danger"}`}>{s.open ? `🪙 ${formatBits(s.wallet)}` : "Closed: broke"}</p>
              </div>
              <div className="w-24">
                <LineChart values={s.history.map((h) => Number(BigInt(h)))} height={32} colour={s.open ? "var(--accent)" : "var(--danger)"} label={`${s.name} money by day`} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Top earners yesterday</h2>
        <ol className="space-y-1">
          {world.topEarners.map((t, i) => (
            <li key={`${t.name}-${i}`} className="flex justify-between">
              <span>
                {["🥇", "🥈", "🥉", "4.", "5."][i]} {t.name}
              </span>
              <span className="font-semibold">🪙 {formatBits(t.earned)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-ink-soft">Treasury: 🪙 {formatBits(world.treasury)} (funds season prizes)</p>
      </Card>
      <Card className="md:col-span-2 lg:col-span-3">
        <h2 className="mb-2 font-semibold">Town news</h2>
        {world.news.length ? (
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {world.news.slice(0, 12).map((n, i) => (
              <li key={`${n.tick}-${i}`} className={`flex gap-2 ${highlight && i === 0 ? "animate-[pop_.3s_ease-out] font-semibold" : ""}`}>
                <span aria-hidden="true">{NEWS_EMOJI[n.kind] ?? "📰"}</span>
                <span className="shrink-0 text-ink-soft">Day {Math.floor(n.tick / 24) + 1}</span>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft">Nothing yet. Give it a day.</p>
        )}
      </Card>
    </div>
  );
}
