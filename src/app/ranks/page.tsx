import type { Metadata } from "next";
import { BuiltOnNear } from "@/components/brand/near-logo";
import { LeaderboardView } from "@/components/social/leaderboard-view";

export const metadata: Metadata = { title: "Ranks · Slimeworld", description: "The richest, hardest-working and most-loved slimes in town." };

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BuiltOnNear className="text-sm font-semibold text-ink-soft" />
        <h1 className="text-3xl font-bold">🏆 Town ranks</h1>
        <p className="text-ink-soft">Who&apos;s winning in Slimeworld right now. Tap a slime to see its page.</p>
      </header>
      <LeaderboardView />
    </main>
  );
}
