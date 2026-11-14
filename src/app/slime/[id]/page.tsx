import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuiltOnNear, NearMark } from "@/components/brand/near-logo";
import { ProfileActions } from "@/components/social/profile-actions";
import { SlimeDot } from "@/components/social/slime-dot";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import { GIFT_MAX } from "@/economy/config";
import { formatBits, MOOD } from "@/lib/format";
import { profileDto } from "@/lib/views";
import { currentPlayerId } from "@/server/session";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!/^s[0-9a-z]{1,10}$/.test(id)) return null;
  const world = await loadWorld(db());
  const slime = world.slimes[id];
  if (!slime) return null;
  // The keeper's own NEAR wallet, if they linked one (public, like any account name).
  const [owner] = slime.ownerId ? await db().select({ wallet: players.walletAccountId }).from(players).where(eq(players.id, slime.ownerId)) : [];
  return { ...profileDto(world, slime, await currentPlayerId()), wallet: owner?.wallet ?? null };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await load((await params).id);
  if (!p) return { title: "Slimeworld" };
  const text = `${p.name} has ${formatBits(p.wallet)} coins, ${p.wins} wins and ${p.cheers} cheers in Slimeworld.`;
  return { title: `${p.name} · Slimeworld`, description: text, openGraph: { title: `Meet ${p.name} in Slimeworld`, description: text } };
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-bg-soft p-3 text-center">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  );
}

/** A slime's public page: share it, cheer it, send it a gift. */
export default async function Page({ params }: Params) {
  const p = await load((await params).id);
  if (!p) notFound();
  const signedIn = Boolean(await currentPlayerId());
  const mood = MOOD[p.asleep ? "asleep" : p.state] ?? MOOD.fine!;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-4">
        <SlimeDot colour={p.colour} size={72} />
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold">{p.name}</h1>
          <p className="text-ink-soft">
            {p.keeper} · {p.ageDays} day{p.ageDays === 1 ? "" : "s"} old · {p.personality}
          </p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-sm ${mood.tone}`}>
            {mood.emoji} {mood.label}
          </span>
          {p.wallet && (
            <span className="ml-2 mt-1 inline-flex items-center gap-1 rounded-full bg-bg-soft px-2 py-0.5 text-sm">
              <NearMark className="h-3.5 w-3.5" /> {p.wallet}
            </span>
          )}
        </div>
      </div>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Stats">
        <Stat value={`🪙 ${formatBits(p.wallet)}`} label="Coins" />
        <Stat value={`🪙 ${formatBits(p.earnedTotal)}`} label="Earned" />
        <Stat value={`🏁 ${p.wins}`} label="Wins" />
        <Stat value={`💖 ${p.cheers}`} label="Cheers" />
      </section>
      {p.mine ? (
        <p className="rounded-2xl bg-accent/15 p-3">This is your slime! Share this page so friends can cheer it on.</p>
      ) : null}
      <ProfileActions slimeId={p.id} name={p.name} canGift={p.player && !p.mine} canCheer={!p.mine} signedIn={signedIn} giftMax={Number(GIFT_MAX / 100n)} />
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Lately</h2>
        <ul className="flex flex-col gap-1.5">
          {p.memory
            .slice()
            .reverse()
            .map((m, i) => (
              <li key={i} className="rounded-xl bg-bg-soft px-3 py-2 text-sm">
                “{m}”
              </li>
            ))}
        </ul>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="font-semibold text-accent underline">
          {signedIn ? "Back to my slime" : "Hatch your own slime"}
        </Link>
        <Link href="/ranks" className="text-accent underline">
          See the ranks
        </Link>
      </div>
      <BuiltOnNear className="justify-center text-sm text-ink-soft" />
    </main>
  );
}
