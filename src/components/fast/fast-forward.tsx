"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, ErrorNote, Loading } from "@/components/ui/states";
import { WorldPanels } from "@/components/world/world-panels";
import { TICK_SECONDS_FAST, TICKS_PER_DAY } from "@/economy/config";
import { worldFromJson } from "@/economy/serialize";
import { runTick } from "@/economy/tick";
import type { GameEvent, World } from "@/economy/types";
import type { TownDto, WorldDto } from "@/lib/dto";
import { townDto, worldDto } from "@/lib/views";

const WorldView = dynamic(() => import("@/game/world-view").then((m) => m.WorldView), { ssr: false, loading: () => <Loading label="Building the town…" /> });

const WEEK = TICKS_PER_DAY * 7;
const SPEEDS = { normal: { label: "1 day / 10s", ticks: 1 }, turbo: { label: "Turbo", ticks: 6 } } as const;
type Speed = keyof typeof SPEEDS;
type Summary = { closed: number; reopened: number; asleep: number; indexFrom: number; indexTo: number };
const BIG_NEWS = new Set(["shop_closed", "shop_reopened", "season"]);

/**
 * Fast forward: take the live town and run the same economy engine in the
 * browser, one game day per 10 seconds. Nothing here touches real money.
 */
export function FastForward() {
  const world = useRef<World | null>(null);
  const start = useRef({ tick: 0, index: 10_000 });
  const events = useRef<GameEvent[]>([]);
  const [town, setTown] = useState<TownDto | null>(null);
  const [overview, setOverview] = useState<WorldDto | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [banner, setBanner] = useState<GameEvent | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const publish = useCallback(() => {
    const w = world.current;
    if (!w) return;
    setTown(townDto(w, null, 60));
    setOverview(worldDto(w));
    setProgress(Math.min(1, (w.tick - start.current.tick) / WEEK));
  }, []);

  const reset = useCallback(async () => {
    setPlaying(false);
    setSummary(null);
    setError(null);
    try {
      const res = await fetch("/api/world/snapshot", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const w = worldFromJson(await res.text());
      w.journal = [];
      world.current = w;
      events.current = [];
      start.current = { tick: w.tick, index: worldDto(w).weather.index };
      publish();
      setPlaying(true);
    } catch {
      setError("Could not load the town. Try again.");
    }
  }, [publish]);

  useEffect(() => {
    const t = setTimeout(() => void reset(), 0);
    return () => clearTimeout(t);
  }, [reset]);

  useEffect(() => {
    if (!playing) return;
    let running = false;
    const id = setInterval(async () => {
      const w = world.current;
      if (!w || running) return;
      running = true;
      for (let i = 0; i < SPEEDS[speed].ticks; i++) {
        const out = await runTick(w);
        events.current.push(...out.events);
        const big = out.events.find((e) => BIG_NEWS.has(e.kind));
        if (big) setBanner(big);
        if (w.tick - start.current.tick >= WEEK) {
          setPlaying(false);
          const ev = events.current;
          setSummary({
            closed: ev.filter((e) => e.kind === "shop_closed").length,
            reopened: ev.filter((e) => e.kind === "shop_reopened").length,
            asleep: Object.values(w.slimes).filter((s) => s.asleep).length,
            indexFrom: start.current.index,
            indexTo: worldDto(w).weather.index,
          });
          break;
        }
      }
      publish();
      running = false;
    }, TICK_SECONDS_FAST * 1000);
    return () => clearInterval(id);
  }, [playing, speed, publish]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 3500);
    return () => clearTimeout(t);
  }, [banner]);

  if (error) return <ErrorNote message={error} onRetry={reset} />;
  if (!town || !overview) return <Loading label="Copying the town…" />;
  const day = Math.floor(progress * 7) + 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold">Fast forward</h1>
          <p className="text-ink-soft">The live town, one week ahead. Same engine, running in your browser.</p>
        </div>
        <div className="flex gap-2">
          <Button tone="soft" onClick={() => setPlaying((p) => !p)} disabled={Boolean(summary)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </Button>
          {(Object.keys(SPEEDS) as Speed[]).map((s) => (
            <Button key={s} tone={speed === s ? "accent" : "soft"} onClick={() => setSpeed(s)}>
              {SPEEDS[s].label}
            </Button>
          ))}
          <Button tone="soft" onClick={reset} aria-label="Start again from the live town">
            <RotateCcw size={18} />
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-semibold">
            Day {Math.min(day, 7)} of 7 · {town.clock.seasonTitle}
          </span>
          <span className="text-ink-soft">
            Town day {town.clock.day}, {String(town.clock.hour).padStart(2, "0")}:00
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-bg-soft" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Week progress">
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="relative h-[46dvh] min-h-72 overflow-hidden rounded-3xl" style={{ background: town.clock.hour >= 20 || town.clock.hour < 6 ? "linear-gradient(#1d2246,#3b3160)" : "linear-gradient(#bfe6ff,#fff3df)" }}>
        <WorldView town={town} />
        {banner && (
          <div role="status" className={`absolute left-1/2 top-4 -translate-x-1/2 animate-[pop_.25s_ease-out] rounded-2xl px-4 py-2 font-semibold shadow-lg ${banner.kind === "shop_closed" ? "bg-danger text-white" : "bg-card text-ink"}`}>
            {banner.kind === "shop_closed" ? "🔒 " : banner.kind === "shop_reopened" ? "🎉 " : "📅 "}
            {banner.text}
          </div>
        )}
      </div>

      {summary && (
        <Card className="border-accent">
          <h2 className="text-lg font-semibold">A week later…</h2>
          <ul className="mt-1 grid gap-1 sm:grid-cols-2">
            <li>Prices went from {(summary.indexFrom / 10_000).toFixed(2)}× to {(summary.indexTo / 10_000).toFixed(2)}× normal.</li>
            <li>
              {summary.closed} shop closing{summary.closed === 1 ? "" : "s"}, {summary.reopened} rescued by investors.
            </li>
            <li>{summary.asleep} slimes are asleep, waiting for someone to feed them.</li>
            <li>No one changed a single number by hand.</li>
          </ul>
        </Card>
      )}

      <WorldPanels world={overview} highlight />
    </div>
  );
}
