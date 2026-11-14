import type { Metadata } from "next";
import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { chainOps, slimeAccounts } from "@/db/schema";
import { cheatProofs } from "@/proofs/cheat-proofs";
import { explorer, formatBits } from "@/lib/format";
import { YOCTO_PER_BIT } from "@/economy/config";
import { BuiltOnNear } from "@/components/brand/near-logo";
import { serverEnv } from "@/lib/env";
import { nearProvider } from "@/near/client";
import { contractIds } from "@/near/contracts";
import { gooStats } from "@/near/goo";
import { wholeGoo } from "@/near/goo-rules";

export const metadata: Metadata = { title: "Fair play · Slimeworld" };
export const dynamic = "force-dynamic";

async function treasuryBits(town: string): Promise<string | null> {
  try {
    const v = await nearProvider().callFunction<string>({ contractId: town, method: "treasury", args: {} });
    return (BigInt(v ?? "0") / YOCTO_PER_BIT).toString();
  } catch {
    return null;
  }
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-bg-soft p-4 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  );
}

/** Public page: live numbers from the town contract and real refused cheats. */
export default async function Page() {
  const game = serverEnv().NEAR_GAME_ACCOUNT;
  const town = game ? contractIds(game).town : null;
  const proofs = cheatProofs();
  const gooId = game ? contractIds(game).goo : null;
  const goo = gooId
    ? await gooStats()
        .then((s) => ({ pool: String(wholeGoo(BigInt(s.pool))), rewarded: String(wholeGoo(BigInt(s.rewarded))), burned: String(wholeGoo(BigInt(s.burned))), reports: s.reports }))
        .catch(() => null)
    : null;
  const [[slimes], [settled], [refused], treasury] = await Promise.all([
    db().select({ n: count() }).from(slimeAccounts).where(eq(slimeAccounts.status, "ready")),
    db().select({ n: count() }).from(chainOps).where(eq(chainOps.status, "done")),
    db().select({ n: count() }).from(chainOps).where(eq(chainOps.status, "rejected")),
    town ? treasuryBits(town) : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <BuiltOnNear className="text-sm font-semibold text-ink-soft" />
        <h1 className="text-3xl font-bold">Fair play, checked by the town</h1>
        <p className="text-ink-soft">
          Every slime spends inside its owner&apos;s rules. The town contract checks each payment again, so nobody can break them: not a slime, not a player, not the game.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Live from the town">
        <Stat value={String(slimes?.n ?? 0)} label="Slimes on chain" />
        <Stat value={String(settled?.n ?? 0)} label="Payments settled" />
        <Stat value={String(refused?.n ?? 0)} label="Payments refused" />
        <Stat value={treasury === null ? "–" : `🪙 ${formatBits(treasury)}`} label="Town treasury" />
      </section>
      {goo && (
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4" aria-label="$GOO live">
          <h2 className="text-lg font-semibold">🟢 $GOO, live from its contract</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value={Number(goo.pool).toLocaleString()} label="In the Goo Pool" />
            <Stat value={Number(goo.rewarded).toLocaleString()} label="Paid to keepers" />
            <Stat value={Number(goo.burned).toLocaleString()} label="Burned forever" />
            <Stat value={String(goo.reports)} label="Things reported" />
          </div>
          <p className="text-sm text-ink-soft">The game only reports what happened, once each. The contract decides every amount and burns GOO when a keeper rescues a sleeping slime. Testnet, no cash value.</p>
          {gooId && (
            <a className="text-sm text-accent underline" href={explorer("address", gooId)} target="_blank" rel="noreferrer">
              {gooId}
            </a>
          )}
        </section>
      )}
      {town && (
        <p className="text-sm text-ink-soft">
          Town contract:{" "}
          <a className="text-accent underline" href={explorer("address", town)} target="_blank" rel="noreferrer">
            {town}
          </a>
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Try to cheat the town</h2>
        {proofs.length === 0 ? (
          <p className="rounded-2xl bg-bg-soft p-4 text-ink-soft">No attempts recorded yet.</p>
        ) : (
          proofs.map((p) => (
            <article key={p.attempt} className="rounded-2xl border border-line bg-card p-4">
              <p className="text-xs font-bold tracking-wide text-danger">BLOCKED</p>
              <h3 className="font-semibold">{p.title}</h3>
              <p className="text-sm text-ink-soft">{p.story}</p>
              <p className="mt-2 rounded-xl bg-bg-soft px-3 py-2 text-sm break-words">Refused: “{p.error.replace(/^Smart contract panicked:\s*/, "")}”</p>
              <a className="mt-2 inline-block text-sm text-accent underline" href={explorer("txns", p.txHash)} target="_blank" rel="noreferrer">
                See the refused transaction
              </a>
            </article>
          ))
        )}
        <p className="text-xs text-ink-soft">These are real transactions on NEAR {proofs[0]?.network ?? "testnet"}. Coins are play money with no cash value.</p>
      </section>
    </main>
  );
}
