"use client";

import Link from "next/link";
import { useState } from "react";
import { FastForward, Store } from "lucide-react";
import { SignIn } from "@/components/sign-in";
import { SlimeView } from "@/components/slime/slime-view";
import type { Reaction } from "@/components/slime/slime-model";
import type { SlimeColour } from "@/economy/types";
import type { WorldDto } from "@/lib/dto";
import { usePoll } from "@/lib/use-poll";

const COLOURS: SlimeColour[] = ["green", "pink", "blue", "gold", "crystal", "shadow"];

/** The first thing a new player sees: a slime to poke, one button, and a living town. */
export function Landing({ devLogin }: { devLogin: boolean }) {
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [colour, setColour] = useState(0);
  const { data: world } = usePoll<WorldDto>("/api/world", 15_000);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid items-center gap-4 md:grid-cols-2">
        <button
          type="button"
          aria-label="Poke the slime"
          className="relative aspect-square w-full rounded-[2.5rem] bg-gradient-to-b from-sky/60 to-transparent"
          onClick={() => {
            setReaction({ kind: Math.random() > 0.5 ? "hop" : "spin", id: Date.now() });
            setColour((c) => (c + 1) % COLOURS.length);
          }}
        >
          <SlimeView state="thriving" colour={COLOURS[colour] ?? "green"} reaction={reaction} className="h-full w-full" label="A happy slime. Tap it!" />
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-card/80 px-3 py-1 text-sm text-ink-soft">Tap me!</span>
        </button>
        <div className="flex flex-col items-center gap-5 text-center md:items-start md:text-left">
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Raise a slime that earns its own living.</h1>
          <p className="text-lg text-ink-soft">
            Every slime has its own wallet on NEAR. It works, shops and saves by itself, inside rules you set, and it tells you why.
          </p>
          <div className="w-full max-w-sm">
            <SignIn devLogin={devLogin} />
          </div>
          <div className="flex gap-2">
            <Link href="/town" className="inline-flex items-center gap-2 rounded-2xl bg-bg-soft px-4 py-2 font-medium">
              <Store size={18} /> Peek at the town
            </Link>
            <Link href="/fast" className="inline-flex items-center gap-2 rounded-2xl bg-bg-soft px-4 py-2 font-medium">
              <FastForward size={18} /> A week in a minute
            </Link>
          </div>
        </div>
      </section>

      {world && (
        <section aria-label="The town right now" className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl bg-card p-4 text-center shadow-[0_2px_0_var(--line)]">
            <p className="text-3xl font-semibold">{world.population}</p>
            <p className="text-ink-soft">slimes in town</p>
          </div>
          <div className="rounded-3xl bg-card p-4 text-center shadow-[0_2px_0_var(--line)]">
            <p className="text-3xl font-semibold">{world.shops.filter((s) => s.open).length}/{world.shops.length}</p>
            <p className="text-ink-soft">shops open</p>
          </div>
          <div className="rounded-3xl bg-card p-4 text-center shadow-[0_2px_0_var(--line)]">
            <p className="text-lg font-semibold">{world.weather.label}</p>
            <p className="text-ink-soft">economy weather</p>
          </div>
          {world.news[0] && (
            <p className="rounded-2xl bg-bg-soft px-4 py-3 text-center sm:col-span-3">📰 {world.news[0].text}</p>
          )}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { e: "🪙", t: "Its own wallet", d: "Each slime is an NFT with its own NEAR account. No seed phrase, no gas popups." },
          { e: "🛡️", t: "A verified mind", d: "Decisions run on NEAR AI Cloud in secure hardware, and each one is checked." },
          { e: "🏪", t: "A living town", d: "Shopkeepers price from stock and demand, go broke, and reopen when someone invests." },
        ].map((f) => (
          <div key={f.t} className="rounded-3xl border border-line p-4">
            <p className="text-2xl">{f.e}</p>
            <p className="font-semibold">{f.t}</p>
            <p className="text-ink-soft">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
