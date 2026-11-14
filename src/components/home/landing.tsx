"use client";

import Link from "next/link";
import { useState } from "react";
import { FastForward } from "lucide-react";
import { SignIn } from "@/components/sign-in";
import { SlimeMark } from "@/components/shell/logo";
import { BuiltOnNear } from "@/components/brand/near-logo";
import { LoadingScreen } from "@/game/hud/loading-screen";
import { GameSheet } from "@/game/panels/sheet";
import { WorldView } from "@/game/world-view";
import type { TownDto } from "@/lib/dto";
import { usePoll } from "@/lib/use-poll";

/** The first thing anyone sees: the living town itself, and one button. */
export function Landing({ devLogin }: { devLogin: boolean }) {
  const { data: town } = usePoll<TownDto>("/api/town", 8000);
  const [signIn, setSignIn] = useState(false);
  if (!town) return <LoadingScreen done={false} />;
  const news = town.events[0];
  const open = town.shops.filter((s) => s.status !== "closed").length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-sky">
      <LoadingScreen done />
      <div className="absolute inset-0">
        <WorldView town={town} />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
            <h1 className="flex items-center gap-2 text-3xl font-semibold md:text-5xl">
              <SlimeMark size={40} /> Slimeworld
            </h1>
            <p className="mt-1 max-w-xs text-base md:text-lg">A town of slimes that earn, spend and save, all by themselves.</p>
          </div>
          <BuiltOnNear className="whitespace-nowrap rounded-full bg-black/45 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur" />
        </div>

        <div className="mt-auto flex flex-col items-center gap-4 md:flex-row md:items-end md:justify-between">
          <div className="pointer-events-auto w-full max-w-sm rounded-3xl bg-card/90 p-4 shadow-xl backdrop-blur">
            <p className="text-sm text-ink-soft">
              Day {town.clock.day} · {town.slimes.length} slimes · {open} of {town.shops.length} shops open
            </p>
            {news && <p className="mt-1 font-medium">📰 {news.text}</p>}
            <Link href="/fast" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
              <FastForward size={16} /> Watch a week in a minute
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setSignIn(true)}
            className="pointer-events-auto rounded-full bg-accent px-10 py-4 text-xl font-semibold text-accent-ink shadow-[0_6px_0_color-mix(in_srgb,var(--accent)_60%,black)] transition active:translate-y-1 active:shadow-none"
          >
            Hatch your slime
          </button>
        </div>
      </div>
      {signIn && (
        <GameSheet title="Welcome to Slimeworld" subtitle="Your slime gets its own little wallet. No seed phrase, no fees to pay." onClose={() => setSignIn(false)}>
          <SignIn devLogin={devLogin} />
        </GameSheet>
      )}
    </div>
  );
}
