/**
 * Step 7 check: feed, buy and job actions complete with no wallet popup.
 * Drives the real HTTP API as a browser would (no keys on the client), then
 * shows the chain writes and compares on-chain coins with the game.
 *   pnpm dev   (in another terminal)
 *   pnpm tsx --tsconfig tsconfig.json scripts/gasless-check.ts
 */
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { chainOps, players, slimeAccounts } from "@/db/schema";
import { YOCTO_PER_BIT } from "@/economy/config";
import { formatCoins } from "@/economy/money";
import { explorer } from "@/lib/format";
import { townBalance } from "@/near/town-chain";
import { processChainOps } from "@/server/chain-worker";
import { advanceTown, loadWorld } from "@/server/town";

const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
let cookie = "";

async function call(path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0] ?? "";
  return (await res.json()) as { ok: boolean; error?: string; message?: string; slimeId?: string; player?: { id: string; nearAccountId: string } };
}

async function drain() {
  for (let i = 0; i < 20; i++) {
    const r = await processChainOps(db());
    const pending = await db().select({ id: chainOps.id }).from(chainOps).where(eq(chainOps.status, "pending"));
    if (r && pending.length === 0) return;
    await new Promise((res) => setTimeout(res, 1500));
  }
}

async function main() {
  const signin = await call("/api/session/dev", { email: `gasless-${Date.now()}@example.com` });
  const playerId = signin.player!.id;
  console.log(`Signed in. Player account: ${signin.player!.nearAccountId}`);
  const hatched = await call("/api/slimes", { name: "Wobble", colour: "blue" });
  if (!hatched.ok) throw new Error(hatched.error);
  const slimeId = hatched.slimeId!;
  console.log(`Hatched slime ${slimeId}.`);
  await drain();

  for (const action of [
    { action: "feed", slimeId },
    { action: "give", slimeId, itemId: "ball" },
    { action: "job", slimeId },
  ]) {
    const r = await call("/api/actions", action);
    console.log(`${action.action.padEnd(5)} → ${r.ok ? "OK" : "NO"}: ${r.message ?? r.error}`);
  }
  // Let the town run a few hours so the job finishes and the slime pays its own way.
  for (let i = 0; i < 4; i++) await advanceTown(db(), 1);
  await drain();

  const [acct] = await db().select().from(slimeAccounts).where(eq(slimeAccounts.slimeId, slimeId));
  const ops = await db().select().from(chainOps).where(inArray(chainOps.kind, ["player_setup", "hatch", "meta", "settle", "operator"])).orderBy(chainOps.id);
  const mine = ops.filter((o) => JSON.stringify(o.payload).includes(acct!.accountId) || JSON.stringify(o.payload).includes(playerId));
  console.log("\nChain writes for this player (no popups: signed by the server, gas paid by the game or the relayer):");
  for (const o of mine) {
    const p = o.payload as { type: string; method?: string; op?: { kind: unknown; memo: string } };
    const what = p.type === "settle" ? `settle ${JSON.stringify(p.op?.kind)} ${p.op?.memo}` : p.type === "meta" ? `meta ${p.method} (player-signed, relayed)` : p.type;
    console.log(`  ${o.status.padEnd(8)} ${what.padEnd(48)} ${explorer("txns", o.txHash ?? "") ?? o.txHash}`);
  }

  const world = await loadWorld(db());
  const [p] = await db().select().from(players).where(eq(players.id, playerId));
  const chainSlime = (await townBalance(acct!.accountId)) / YOCTO_PER_BIT;
  const chainPlayer = (await townBalance(p!.nearAccountId!)) / YOCTO_PER_BIT;
  const gameSlime = world.slimes[slimeId]!.wallet;
  const gamePlayer = world.players[playerId]!.wallet;
  console.log(`\nSlime coins:  game ${formatCoins(gameSlime)} · chain ${formatCoins(chainSlime)}`);
  console.log(`Player coins: game ${formatCoins(gamePlayer)} · chain ${formatCoins(chainPlayer)}`);
  const ok = mine.every((o) => o.status === "done") && chainSlime === gameSlime && chainPlayer === gamePlayer;
  console.log(ok ? "\nPASS: every action went through with no wallet popup, and the chain matches the game." : "\nFAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
