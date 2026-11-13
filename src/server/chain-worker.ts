/**
 * Sends the outbox to NEAR, in order. One worker at a time (advisory lock).
 * - hatch: create the slime's account, mint its NFT, register its rules, starter coins
 * - player_setup: town-only key for gasless meta transactions, starter coins
 * - settle: batched into one settle_batch call; the contract re-checks rules
 * - meta: the player's own call, signed with their town key, relayed (NEP-366)
 * - operator: game calls such as close_shop
 * If the contract rejects an op, the engine takes the chain's balance as truth.
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { KeyPair } from "near-api-js";
import type { Db } from "@/db/client";
import { chainOps, players, slimeAccounts } from "@/db/schema";
import { YOCTO_PER_BIT } from "@/economy/config";
import { serverEnv } from "@/lib/env";
import { decryptKey, encryptKey } from "@/near/keys";
import { createSlimeOnChain, operatorCall, relayPlayerCall, settleBatch, setupPlayerOnChain, townBalance } from "@/near/town-chain";
import type { ChainOpPayload, ContractOp } from "@/near/town-ops";
import { noChanges, withWorld } from "./world-store";

const SETTLE_BATCH = 40;
const MAX_ATTEMPTS = 5;

export type HatchPayload = {
  type: "hatch";
  slimeId: string;
  playerId: string;
  name: string;
  traits: Record<string, unknown>;
  rules: { daily_limit: string; allowed: string[]; savings_target: string };
  starterYocto: string;
};
export type PlayerSetupPayload = { type: "player_setup"; playerId: string; starterYocto: string };
type AnyPayload = ChainOpPayload | HatchPayload | PlayerSetupPayload;
type OpRow = { id: number; worldId: string; payload: AnyPayload; attempts: number };

export type WorkerReport = { done: number; rejected: number; failed: number; waiting: number };

function secret(): string {
  const s = serverEnv().KEYS_SECRET;
  if (!s) throw new Error("KEYS_SECRET is not set");
  return s;
}

async function mark(db: Db, id: number, status: string, extra: { txHash?: string; error?: string } = {}) {
  await db
    .update(chainOps)
    .set({ status, txHash: extra.txHash ?? null, error: extra.error?.slice(0, 500) ?? null, updatedAt: new Date() })
    .where(eq(chainOps.id, id));
}

async function bump(db: Db, row: OpRow, err: unknown) {
  const error = err instanceof Error ? err.message : String(err);
  const attempts = row.attempts + 1;
  await db
    .update(chainOps)
    .set({ attempts, status: attempts >= MAX_ATTEMPTS ? "failed" : "pending", error: error.slice(0, 500), updatedAt: new Date() })
    .where(eq(chainOps.id, row.id));
}

async function setupPlayer(db: Db, playerId: string, starterYocto: string): Promise<string[]> {
  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  if (!p?.nearAccountId || !p.nearKeyEnc) throw new Error("Player has no NEAR account yet");
  if (p.chainReady) return [];
  let fcEnc = p.nearFcKeyEnc;
  if (!fcEnc) {
    fcEnc = encryptKey(KeyPair.fromRandom("ed25519").toString(), secret());
    await db.update(players).set({ nearFcKeyEnc: fcEnc }).where(eq(players.id, playerId));
  }
  const hashes = await setupPlayerOnChain({
    accountId: p.nearAccountId,
    fullKey: decryptKey(p.nearKeyEnc, secret()),
    fcPublicKey: decryptKey(fcEnc, secret()),
    starterYocto,
  });
  await db.update(players).set({ chainReady: true }).where(eq(players.id, playerId));
  return hashes;
}

/** Make the engine match the chain for these slimes and players. */
async function reconcile(db: Db, worldId: string, slimeIds: string[], playerIds: string[]) {
  if (!slimeIds.length && !playerIds.length) return;
  const slimeRows = slimeIds.length
    ? await db.select().from(slimeAccounts).where(and(eq(slimeAccounts.worldId, worldId), inArray(slimeAccounts.slimeId, slimeIds)))
    : [];
  const playerRows = playerIds.length ? await db.select().from(players).where(inArray(players.id, playerIds)) : [];
  const balances = new Map<string, bigint>();
  for (const s of slimeRows) balances.set(`s:${s.slimeId}`, (await townBalance(s.accountId)) / YOCTO_PER_BIT);
  for (const p of playerRows) if (p.nearAccountId) balances.set(`p:${p.id}`, (await townBalance(p.nearAccountId)) / YOCTO_PER_BIT);
  await withWorld(db, async (world) => {
    for (const [key, bits] of balances) {
      const [kind, id] = key.split(":") as ["s" | "p", string];
      if (kind === "s" && world.slimes[id]) world.slimes[id].wallet = bits;
      if (kind === "p" && world.players[id]) world.players[id].wallet = bits;
    }
    return { result: null, changes: noChanges() };
  }, { id: worldId });
}

export async function processChainOps(db: Db, max = 200): Promise<WorkerReport | null> {
  const report: WorkerReport = { done: 0, rejected: 0, failed: 0, waiting: 0 };
  return db.transaction(async (lockTx) => {
    const lock = await lockTx.execute<{ ok: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext('chain-worker')) as ok`);
    if (!lock.rows[0]?.ok) return null;

    const rows = (await db
      .select({ id: chainOps.id, worldId: chainOps.worldId, payload: chainOps.payload, attempts: chainOps.attempts })
      .from(chainOps)
      .where(eq(chainOps.status, "pending"))
      .orderBy(asc(chainOps.id))
      .limit(max)) as OpRow[];
    if (!rows.length) return report;

    const readySlimes = new Set(
      (await db.select({ id: slimeAccounts.slimeId }).from(slimeAccounts).where(eq(slimeAccounts.status, "ready"))).map((r) => r.id),
    );
    const readyPlayers = new Set((await db.select({ id: players.id }).from(players).where(eq(players.chainReady, true))).map((r) => r.id));
    const blocked = new Set<string>(); // keeps per-account order when something has to wait
    const toReconcile = new Map<string, { slimes: Set<string>; players: Set<string> }>();
    let batch: OpRow[] = [];

    const flush = async () => {
      if (!batch.length) return;
      const current = batch;
      batch = [];
      try {
        const ops = current.map((r) => (r.payload as Extract<ChainOpPayload, { type: "settle" }>).op as ContractOp);
        const { hash, results } = await settleBatch(ops);
        for (const [i, row] of current.entries()) {
          const ok = results[i] === true;
          await mark(db, row.id, ok ? "done" : "rejected", { txHash: hash, error: ok ? undefined : "The town contract rejected this operation" });
          if (ok) report.done++;
          else {
            report.rejected++;
            const p = row.payload as Extract<ChainOpPayload, { type: "settle" }>;
            const r = toReconcile.get(row.worldId) ?? { slimes: new Set(), players: new Set() };
            p.slimeIds.forEach((s) => r.slimes.add(s));
            p.playerIds.forEach((s) => r.players.add(s));
            toReconcile.set(row.worldId, r);
          }
        }
      } catch (err) {
        for (const row of current) await bump(db, row, err);
        report.failed += current.length;
      }
    };

    for (const row of rows) {
      const p = row.payload;
      try {
        if (p.type === "settle") {
          const waits = p.slimeIds.some((s) => !readySlimes.has(s) || blocked.has(`s:${s}`)) || p.playerIds.some((x) => !readyPlayers.has(x) || blocked.has(`p:${x}`));
          if (waits) {
            p.slimeIds.forEach((s) => blocked.add(`s:${s}`));
            p.playerIds.forEach((x) => blocked.add(`p:${x}`));
            report.waiting++;
            continue;
          }
          batch.push(row);
          if (batch.length >= SETTLE_BATCH) await flush();
          continue;
        }
        await flush();
        if (p.type === "player_setup") {
          const hashes = await setupPlayer(db, p.playerId, p.starterYocto);
          readyPlayers.add(p.playerId);
          await mark(db, row.id, "done", { txHash: hashes.at(-1) });
        } else if (p.type === "hatch") {
          if (!readyPlayers.has(p.playerId)) {
            report.waiting++;
            blocked.add(`s:${p.slimeId}`);
            continue;
          }
          const [acct] = await db.select().from(slimeAccounts).where(and(eq(slimeAccounts.worldId, row.worldId), eq(slimeAccounts.slimeId, p.slimeId)));
          const [owner] = await db.select().from(players).where(eq(players.id, p.playerId));
          if (!acct || !owner?.nearAccountId) throw new Error("Slime or owner missing");
          const hashes = await createSlimeOnChain({
            accountId: acct.accountId,
            privateKey: decryptKey(acct.keyEnc, secret()),
            tokenId: acct.nftTokenId,
            ownerAccountId: owner.nearAccountId,
            name: p.name,
            traits: p.traits,
            rules: p.rules,
            starterYocto: p.starterYocto,
          });
          await db.update(slimeAccounts).set({ status: "ready" }).where(and(eq(slimeAccounts.worldId, row.worldId), eq(slimeAccounts.slimeId, p.slimeId)));
          readySlimes.add(p.slimeId);
          await mark(db, row.id, "done", { txHash: hashes.at(-1) });
        } else if (p.type === "meta") {
          if (!readyPlayers.has(p.playerId) || blocked.has(`p:${p.playerId}`)) {
            blocked.add(`p:${p.playerId}`);
            report.waiting++;
            continue;
          }
          const [owner] = await db.select().from(players).where(eq(players.id, p.playerId));
          if (!owner?.nearAccountId || !owner.nearFcKeyEnc) throw new Error("Player town key missing");
          try {
            const hash = await relayPlayerCall({ accountId: owner.nearAccountId, fcKey: decryptKey(owner.nearFcKeyEnc, secret()), method: p.method, args: p.args });
            await mark(db, row.id, "done", { txHash: hash });
          } catch (err) {
            if (!(err instanceof Error) || !err.message.startsWith("Town said no")) throw err;
            await mark(db, row.id, "rejected", { error: err.message });
            report.rejected++;
            const r = toReconcile.get(row.worldId) ?? { slimes: new Set(), players: new Set() };
            r.players.add(p.playerId);
            toReconcile.set(row.worldId, r);
            continue;
          }
        } else {
          const hash = await operatorCall(p.method, p.args);
          await mark(db, row.id, "done", { txHash: hash });
        }
        report.done++;
      } catch (err) {
        await bump(db, row, err);
        report.failed++;
      }
    }
    await flush();
    for (const [worldId, r] of toReconcile) await reconcile(db, worldId, [...r.slimes], [...r.players]);
    return report;
  });
}
