"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Hand, Menu, Mic, Utensils } from "lucide-react";
import type { Reaction } from "@/components/slime/slime-model";
import { TalkPanel } from "@/components/home/talk-panel";
import { useToast } from "@/components/ui/toast";
import type { HomeDto, TownDto } from "@/lib/dto";
import { formatBits } from "@/lib/format";
import { post, usePoll } from "@/lib/use-poll";
import { GameBus } from "./bus";
import { guide } from "./guide";
import { Joystick } from "./hud/joystick";
import { LoadingScreen } from "./hud/loading-screen";
import { Minimap } from "./hud/minimap";
import { SlimeBadge } from "./hud/slime-badge";
import { spawnPoint, townLayout, type Spot } from "./layout";
import { CoinsSheet } from "./panels/coins-sheet";
import { JobsSheet } from "./panels/jobs-sheet";
import { MenuSheet } from "./panels/menu-sheet";
import { RaceSheet } from "./panels/race-sheet";
import { ShopSheet } from "./panels/shop-sheet";
import { useControls } from "./use-controls";

const GameScene = dynamic(() => import("./game-scene"), { ssr: false });

type Panel = { kind: "shop"; id: string } | { kind: "jobs" } | { kind: "races" } | { kind: "menu" } | { kind: "coins" } | null;

const SEASON_EMOJI: Record<string, string> = { calm: "🌤️", heatwave: "🔥", harvest: "🌾", festival: "🎪" };

function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(pointer: coarse)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

function spotLabel(spot: Spot, town: TownDto): { title: string; action: string } {
  if (spot.kind === "shop") {
    const shop = town.shops.find((s) => s.id === spot.id);
    return { title: shop?.name ?? "Shop", action: shop?.status === "closed" ? "Look inside" : "Shop" };
  }
  if (spot.kind === "jobs") return { title: "Job board", action: "Find work" };
  if (spot.kind === "races") return { title: "Race ground", action: "Races" };
  return { title: "Fountain", action: "Town news" };
}

/** The game: your slime in the town. Walk up to things to use them. */
export function GameScreen() {
  const toast = useToast();
  const home = usePoll<HomeDto>("/api/home", 4000);
  const town = usePoll<TownDto>("/api/town", 5000);
  const [bus] = useState(() => new GameBus(spawnPoint(6)));
  const [nearby, setNearby] = useState<Spot | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const [moved, setMoved] = useState(false);
  const coarse = useCoarsePointer();
  const stage = useRef<HTMLDivElement>(null);

  const shopIds = useMemo(() => town.data?.shops.map((s) => s.id) ?? [], [town.data?.shops]);
  const layout = useMemo(() => townLayout(shopIds), [shopIds]);
  const slime = home.data?.slimes[0] ?? null;

  useEffect(() => bus.onNearby(setNearby), [bus]);
  useEffect(() => {
    // Development only: lets automated play-tests drive the slime precisely.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __slimeGame?: GameBus }).__slimeGame = bus;
  }, [bus]);
  useEffect(() => {
    const id = setInterval(() => {
      if (bus.mover.speed > 0.5) {
        setMoved(true);
        clearInterval(id);
      }
    }, 500);
    return () => clearInterval(id);
  }, [bus]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const say = useCallback((line: string, kind: Reaction["kind"] = "hop") => {
    setSubtitle(line);
    setReaction({ kind, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!subtitle) return;
    const t = setTimeout(() => setSubtitle(null), 5000);
    return () => clearTimeout(t);
  }, [subtitle]);

  const act = useCallback(
    async (body: Record<string, unknown>, line: string, kind: Reaction["kind"] = "hop") => {
      if (!slime) return false;
      setBusy(true);
      const r = await post("/api/actions", { slimeId: slime.id, ...body });
      setBusy(false);
      if (r.ok) {
        say(line, kind);
        toast(r.message ?? "Done!");
        await Promise.all([home.refresh(), town.refresh()]);
      } else {
        setReaction({ kind: "droop", id: Date.now() });
        toast(r.error ?? "That didn't work.", "error");
      }
      return r.ok;
    },
    [slime, say, toast, home, town],
  );

  const use = useCallback(() => {
    if (!nearby) return;
    if (nearby.kind === "shop") setPanel({ kind: "shop", id: nearby.id });
    else if (nearby.kind === "jobs") setPanel({ kind: "jobs" });
    else if (nearby.kind === "races") setPanel({ kind: "races" });
    else setPanel({ kind: "menu" });
  }, [nearby]);

  useControls(bus, stage, use, panel === null && !talking);

  const ready = Boolean(home.data && town.data && slime);
  const goal = slime && town.data ? guide(slime, town.data, layout.spots) : null;
  const goalSpot = goal?.spotId ? (layout.spots.find((s) => s.id === goal.spotId) ?? null) : null;
  const closed = useMemo(() => new Set(town.data?.shops.filter((s) => s.status === "closed").map((s) => s.id) ?? []), [town.data?.shops]);

  if (!home.data || !town.data || !slime) return <LoadingScreen done={false} />;
  const t = town.data;
  const shop = panel?.kind === "shop" ? t.shops.find((s) => s.id === panel.id) : null;
  const label = nearby ? spotLabel(nearby, t) : null;
  const night = t.clock.hour >= 20 || t.clock.hour < 6;

  return (
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-sky">
      <LoadingScreen done={ready} />
      <div ref={stage} className="absolute inset-0 touch-none">
        <GameScene
          bus={bus}
          shops={t.shops}
          slimes={t.slimes.filter((s) => s.id !== slime.id)}
          me={{ colour: slime.colour, state: slime.state, size: slime.size, reaction }}
          layout={layout}
          hour={t.clock.hour}
          beam={goalSpot?.pos ?? null}
        />
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 flex flex-col p-3 pb-[max(env(safe-area-inset-bottom),12px)] md:p-5">
        <div className="flex items-start justify-between gap-2">
          <SlimeBadge slime={slime} onOpen={() => setPanel({ kind: "menu" })} />
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPanel({ kind: "coins" })}
                className="pointer-events-auto rounded-full bg-card/85 px-3 py-2 text-sm font-semibold shadow-lg backdrop-blur"
                aria-label={`${slime.name}'s coins. Add coins`}
              >
                🪙 {formatBits(slime.wallet)} <span className="text-accent">+</span>
              </button>
              <span className="hidden rounded-full bg-card/85 px-3 py-2 text-sm shadow-lg backdrop-blur sm:inline">
                {night ? "🌙" : SEASON_EMOJI[t.clock.season] ?? "🌤️"} Day {t.clock.day} · {String(t.clock.hour).padStart(2, "0")}:00
              </span>
              <button type="button" aria-label="Menu" onClick={() => setPanel({ kind: "menu" })} className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-card/85 shadow-lg backdrop-blur">
                <Menu size={20} />
              </button>
            </div>
            <Minimap bus={bus} spots={layout.spots} closed={closed} goal={goalSpot?.pos ?? null} />
          </div>
        </div>

        {goal && (
          <p className="mx-auto mt-2 max-w-sm rounded-full bg-black/45 px-4 py-1.5 text-center text-sm font-medium text-white backdrop-blur-sm">✨ {goal.text}</p>
        )}

        <div className="mt-auto flex flex-col items-center gap-3">
          {subtitle && (
            <p className="max-w-md animate-[pop_.2s_ease-out] rounded-2xl bg-black/55 px-4 py-2 text-center text-lg font-medium text-white backdrop-blur-sm">
              <span className="text-[#ffe08a]">{slime.name}:</span> {subtitle}
            </p>
          )}
          {label && !panel && (
            <button type="button" onClick={use} className="pointer-events-auto flex animate-[pop_.2s_ease-out] items-center gap-3 rounded-full bg-card px-5 py-3 font-semibold shadow-xl">
              {label.action} · {label.title}
              {!coarse && <kbd className="rounded-md border border-line px-1.5 text-xs text-ink-soft">E</kbd>}
            </button>
          )}
          {talking && (
            <div className="pointer-events-auto w-full max-w-md">
              <TalkPanel slimeId={slime.id} name={slime.name} onReply={(line) => say(line)} />
            </div>
          )}
          <div className="flex w-full items-end justify-between gap-3">
            <div>
              {coarse ? (
                <Joystick bus={bus} />
              ) : (
                !moved && <p className="rounded-2xl bg-black/45 px-3 py-2 text-sm text-white backdrop-blur-sm">WASD or click to hop · drag to look · E to use</p>
              )}
            </div>
            <div className="pointer-events-auto flex items-end gap-2">
              <RoundButton label="Feed" pulse={goal?.button === "feed"} disabled={busy} onClick={() => act({ action: "feed" }, "Yum! Thank you!")}>
                <Utensils size={22} />
              </RoundButton>
              <RoundButton label="Pat" pulse={goal?.button === "pat"} disabled={busy} onClick={() => act({ action: "play" }, "Hehe, that tickles!", "spin")}>
                <Hand size={22} />
              </RoundButton>
              <RoundButton label="Talk" big active={talking} onClick={() => setTalking((v) => !v)}>
                <Mic size={26} />
              </RoundButton>
            </div>
          </div>
        </div>
      </div>

      {shop && (
        <ShopSheet
          shop={shop}
          slimeName={slime.name}
          coins={home.data.player?.wallet ?? "0"}
          busy={busy}
          onClose={() => setPanel(null)}
          onBuy={(itemId) => act({ action: "give", itemId }, "Ooh, for me? Thank you!")}
          onInvest={async (amount) => {
            setBusy(true);
            const r = await post("/api/invest", { shopId: shop.id, amount });
            setBusy(false);
            toast(r.ok ? r.message ?? "Invested!" : r.error ?? "Could not invest.", r.ok ? "ok" : "error");
            if (r.ok) await town.refresh();
          }}
        />
      )}
      {panel?.kind === "jobs" && (
        <JobsSheet
          jobs={t.jobs}
          slimeName={slime.name}
          energy={slime.energy}
          working={Boolean(slime.job)}
          busy={busy}
          onClose={() => setPanel(null)}
          onWork={async () => {
            if (await act({ action: "job" }, "Off to work!")) setPanel(null);
          }}
        />
      )}
      {panel?.kind === "races" && (
        <RaceSheet
          contests={t.contests}
          results={t.events.filter((e) => e.kind === "contest")}
          slimeName={slime.name}
          busy={busy}
          onClose={() => setPanel(null)}
          onEnter={(kind) => act({ action: "race", kind }, kind === "race" ? "I'm so fast!" : "My brain is ready!")}
        />
      )}
      {panel?.kind === "coins" && (
        <CoinsSheet
          slimeName={slime.name}
          slimeCoins={slime.wallet}
          playerCoins={home.data.player?.wallet ?? "0"}
          busy={busy}
          onClose={() => setPanel(null)}
          onChanged={() => void home.refresh()}
          onGive={(amount) => act({ action: "topup", amount }, "Coins! I'll spend them wisely.", "spin")}
        />
      )}
      {panel?.kind === "menu" && <MenuSheet slime={slime} guest={home.data.player?.guest ?? false} onClose={() => setPanel(null)} onSaved={home.refresh} />}
    </div>
  );
}

function RoundButton({ label, children, onClick, disabled, pulse, big, active }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean; pulse?: boolean; big?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-full font-semibold shadow-xl transition active:scale-95 disabled:opacity-50 ${
        big ? "h-20 w-20 bg-accent text-accent-ink" : "h-16 w-16 bg-card text-ink"
      } ${active ? "ring-4 ring-white/80" : ""}`}
    >
      {pulse && <span className="absolute inset-0 animate-ping rounded-full bg-coin/60" aria-hidden="true" />}
      <span className="relative">{children}</span>
      <span className="relative text-[11px] leading-none">{label}</span>
    </button>
  );
}
