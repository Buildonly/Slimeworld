"use client";

import Link from "next/link";
import { useState } from "react";
import { BriefcaseBusiness, Gift, Hand, Settings2, Utensils, Wallet } from "lucide-react";
import { SlimeView } from "@/components/slime/slime-view";
import type { Reaction } from "@/components/slime/slime-model";
import { DecisionItem } from "@/components/log/decision-item";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { HomeDto, MarketDto, SlimeDto } from "@/lib/dto";
import { explorer, formatBits, ITEM_EMOJI, MOOD } from "@/lib/format";
import { post } from "@/lib/use-poll";
import { SignOut } from "@/components/sign-out";
import { CoinJar } from "./coin-jar";
import { Sheet } from "./action-sheet";
import { StatBar } from "./stat-bar";

type Props = { home: HomeDto; refresh: () => Promise<void> };

function mood(s: SlimeDto) {
  return s.lonely && s.state !== "asleep" ? MOOD.lonely! : MOOD[s.state] ?? MOOD.fine!;
}

function headline(s: SlimeDto): string {
  if (s.state === "asleep") return `${s.name} is asleep. Feed it or top it up to wake it.`;
  if (s.job) return `${s.name} is at a ${s.job.kind} job.`;
  if (s.lonely) return `${s.name} misses you. Play with it!`;
  if (s.state === "broke") return `${s.name} is nearly out of coins.`;
  if (s.state === "hungry") return `${s.name} is hungry.`;
  if (s.state === "thriving") return `${s.name} is thriving!`;
  return `${s.name} is doing fine.`;
}

export function SlimeHome({ home, refresh }: Props) {
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"give" | "topup" | null>(null);
  const [market, setMarket] = useState<MarketDto | null>(null);
  const slime = home.slimes[Math.min(index, home.slimes.length - 1)]!;
  const m = mood(slime);
  const recent = home.recent[slime.id] ?? [];
  const say = bubble ?? recent.find((d) => d.say)?.say ?? null;

  async function act(action: string, extra: Record<string, unknown> = {}, kind: Reaction["kind"] = "hop") {
    setBusy(action);
    const r = await post("/api/actions", { action, slimeId: slime.id, ...extra });
    setBusy(null);
    if (r.ok) {
      setReaction({ kind, id: Date.now() });
      setBubble(action === "feed" || action === "give" ? "Yum!" : action === "play" ? "Wheee!" : action === "job" ? "Off to work!" : "Thank you!");
      toast(r.message ?? "Done!");
      setTimeout(() => setBubble(null), 3500);
      await refresh();
    } else {
      setReaction({ kind: "droop", id: Date.now() });
      toast(r.error ?? "That didn't work.", "error");
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <div className="flex min-w-0 flex-col gap-4">
        {home.slimes.length > 1 && (
          <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Your slimes">
            {home.slimes.map((s, i) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={i === index}
                onClick={() => setIndex(i)}
                className="rounded-full border border-line px-4 py-1.5 aria-selected:bg-accent aria-selected:text-accent-ink"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        <Card className="relative overflow-hidden bg-gradient-to-b from-sky/50 to-card p-0">
          <div className="absolute left-4 top-4 z-10 flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{slime.name}</h1>
            <span className="text-sm capitalize text-ink-soft">
              {slime.personality} · {slime.colour} · day {slime.ageDays + 1}
            </span>
          </div>
          <span className={`absolute right-4 top-4 z-10 rounded-full px-3 py-1 text-sm font-semibold ${m.tone}`}>
            {m.emoji} {m.label}
          </span>
          {say && (
            <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 animate-[pop_.25s_ease-out] rounded-2xl bg-card px-4 py-2 font-medium shadow-lg after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-card">
              {say}
            </div>
          )}
          <SlimeView state={slime.state} colour={slime.colour} size={slime.size} reaction={reaction} className="aspect-square w-full md:aspect-[4/3]" label={headline(slime)} />
          <p className="px-4 pb-4 text-center text-ink-soft">{headline(slime)}</p>
        </Card>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <Button onClick={() => act("feed")} disabled={busy !== null} className="flex-col py-3" title="Buy the cheapest food">
            <Utensils size={20} /> Feed
            {home.feedPrice && <span className="text-xs opacity-80">🪙 {formatBits(home.feedPrice)}</span>}
          </Button>
          <Button tone="soft" onClick={() => act("play", {}, "spin")} disabled={busy !== null} className="flex-col py-3">
            <Hand size={20} /> Play
          </Button>
          <Button tone="soft" onClick={() => act("job")} disabled={busy !== null || Boolean(slime.job) || slime.state === "asleep"} className="flex-col py-3">
            <BriefcaseBusiness size={20} /> Work
          </Button>
          <Button
            tone="soft"
            onClick={async () => {
              setSheet("give");
              setMarket(await fetch("/api/market").then((r) => r.json() as Promise<MarketDto>));
            }}
            disabled={busy !== null}
            className="flex-col py-3"
          >
            <Gift size={20} /> Give
          </Button>
          <Button tone="coin" onClick={() => setSheet("topup")} disabled={busy !== null} className="flex-col py-3">
            <Wallet size={20} /> Coins
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <CoinJar bits={slime.wallet} />
          <StatBar label="Energy" icon="⚡" value={slime.energy} colour="var(--coin)" />
          <StatBar label="Happiness" icon="💗" value={slime.joy} colour="#ff8fc7" />
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {(["speed", "smarts", "charm"] as const).map((k) => (
              <div key={k} className="rounded-2xl bg-bg-soft py-2">
                <p className="text-lg font-semibold">{slime.skills[k]}</p>
                <p className="capitalize text-ink-soft">{k}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">While you were away</h2>
            <Link href={`/log?slime=${slime.id}`} className="text-sm text-accent">
              Full log
            </Link>
          </div>
          {recent.length ? (
            <ul className="divide-y divide-line">
              {recent.map((d) => (
                <DecisionItem key={d.id} d={d} />
              ))}
            </ul>
          ) : (
            <p className="py-4 text-ink-soft">{slime.name} hasn&apos;t decided anything yet. Give it a minute.</p>
          )}
        </Card>

        <Card className="flex items-center gap-3">
          <Settings2 className="shrink-0 text-ink-soft" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Spending rules</p>
            <p className="text-ink-soft">
              Up to 🪙 {formatBits(slime.rules.dailyLimit)} a day, keeps 🪙 {formatBits(slime.rules.savingsTarget)} saved. {slime.rules.allowed.join(", ")}.
            </p>
          </div>
          <Link href={`/rules?slime=${slime.id}`} className="rounded-xl bg-bg-soft px-3 py-2 text-sm font-semibold">
            Edit
          </Link>
        </Card>

        {slime.chain && (
          <Card className="text-sm">
            <p className="font-semibold">On NEAR</p>
            {slime.chain.status === "ready" ? (
              <ul className="mt-1 space-y-1 text-ink-soft">
                <li>
                  Own account:{" "}
                  <a className="break-all text-accent underline" href={explorer(home.contracts.network, "address", slime.chain.accountId)} target="_blank" rel="noreferrer">
                    {slime.chain.accountId}
                  </a>
                </li>
                <li>
                  NFT #{slime.chain.nftTokenId} on{" "}
                  <a className="text-accent underline" href={explorer(home.contracts.network, "address", home.contracts.nft)} target="_blank" rel="noreferrer">
                    {home.contracts.nft}
                  </a>
                </li>
              </ul>
            ) : (
              <p className="mt-1 text-ink-soft">Making {slime.name}&apos;s account and NFT… (a few seconds)</p>
            )}
          </Card>
        )}
      </div>

      <div className="text-center md:col-span-2">
        <SignOut />
      </div>

      {sheet === "give" && (
        <Sheet title={`Give ${slime.name} something`} onClose={() => setSheet(null)}>
          {!market ? (
            <p className="py-6 text-center text-ink-soft">Checking prices…</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {market.items
                .filter((i) => i.category !== "Material")
                .map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      disabled={!i.best || busy !== null}
                      onClick={async () => {
                        setSheet(null);
                        await act("give", { itemId: i.id }, i.category === "Food" ? "hop" : "spin");
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl bg-bg-soft p-3 text-left disabled:opacity-50"
                      title={i.best?.reason}
                    >
                      <span className="text-2xl">{ITEM_EMOJI[i.id]}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{i.title}</span>
                        <span className="block text-sm text-ink-soft">{i.best ? `🪙 ${formatBits(i.best.price)}` : "Sold out"}</span>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-3 text-center text-sm text-ink-soft">Paid from your coins: 🪙 {formatBits(home.player?.wallet ?? "0")}</p>
        </Sheet>
      )}

      {sheet === "topup" && (
        <Sheet title={`Give ${slime.name} coins`} onClose={() => setSheet(null)}>
          <p className="mb-3 text-ink-soft">You have 🪙 {formatBits(home.player?.wallet ?? "0")}. {slime.name} spends them by itself, inside your rules.</p>
          <div className="grid grid-cols-4 gap-2">
            {[10, 25, 50, 100].map((n) => (
              <Button
                key={n}
                tone="coin"
                disabled={BigInt(home.player?.wallet ?? "0") < BigInt(n * 100)}
                onClick={async () => {
                  setSheet(null);
                  await act("topup", { amount: n }, "spin");
                }}
              >
                {n}
              </Button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
