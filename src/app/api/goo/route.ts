import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { players, slimeAccounts } from "@/db/schema";
import { GOO_ITEMS } from "@/economy/config";
import { remember } from "@/economy/memory";
import { serverEnv } from "@/lib/env";
import { burnGooFor, gooBalance, gooRulesLive, gooStats } from "@/near/goo";
import { wholeGoo } from "@/near/goo-rules";
import { decryptKey } from "@/near/keys";
import { fail, readJson } from "@/server/http";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";
import { MAIN_WORLD, noChanges, withWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** Your $GOO, what it can buy, and the token's live numbers. */
export async function GET() {
  const playerId = await currentPlayerId();
  const [p] = playerId ? await db().select({ account: players.nearAccountId }).from(players).where(eq(players.id, playerId)) : [];
  try {
    const [stats, rules, balance] = await Promise.all([gooStats(), gooRulesLive(), p?.account ? gooBalance(p.account) : Promise.resolve(0n)]);
    return Response.json({
      ok: true,
      balance: wholeGoo(balance).toString(),
      items: GOO_ITEMS.map((i) => ({ id: i.id, title: i.title, description: i.description, price: rules.item_prices[i.id] ? wholeGoo(BigInt(rules.item_prices[i.id]!)).toString() : null })),
      rewards: { care: wholeGoo(BigInt(rules.care_reward)).toString(), win: wholeGoo(BigInt(rules.win_reward)).toString(), rescueBurn: wholeGoo(BigInt(rules.rescue_burn)).toString() },
      stats: { supply: wholeGoo(BigInt(stats.total_supply)).toString(), pool: wholeGoo(BigInt(stats.pool)).toString(), burned: wholeGoo(BigInt(stats.burned)).toString(), rewarded: wholeGoo(BigInt(stats.rewarded)).toString(), reports: stats.reports },
    });
  } catch {
    return fail(503, "$GOO is unavailable right now.");
  }
}

const schema = z.object({ slimeId: z.string().regex(/^s[0-9a-z]{1,10}$/), itemId: z.string().regex(/^[a-z]{2,16}$/) });

/** Burn your own GOO for a rare item for one of your slimes. */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `goo-burn:${playerId}`, 5, 600))) return fail(429, "Slow down a little!");
  const body = await readJson(req, schema);
  const item = body && GOO_ITEMS.find((i) => i.id === body.itemId);
  if (!body || !item) return fail(400, "That can't be bought with GOO.");
  const [p] = await db().select().from(players).where(eq(players.id, playerId));
  const [mine] = await db().select({ id: slimeAccounts.slimeId }).from(slimeAccounts).where(and(eq(slimeAccounts.playerId, playerId), eq(slimeAccounts.worldId, MAIN_WORLD), eq(slimeAccounts.slimeId, body.slimeId)));
  const secret = serverEnv().KEYS_SECRET;
  if (!mine) return fail(404, "That's not your slime.");
  if (!p?.nearAccountId || !p.nearKeyEnc || !secret) return fail(409, "Your NEAR account is still being set up.");
  let tx: string;
  try {
    tx = await burnGooFor({ accountId: p.nearAccountId, fullKey: decryptKey(p.nearKeyEnc, secret), itemId: item.id });
  } catch (err) {
    return fail(409, err instanceof Error && err.message.startsWith("Not enough") ? err.message : "The burn didn't go through. Try again soon.");
  }
  // The contract burned the GOO; now the slime gets its item.
  await withWorld(db(), async (world) => {
    const slime = world.slimes[body.slimeId];
    if (slime) {
      slime.items[item.id] = (slime.items[item.id] ?? 0) + 1;
      remember(slime, `My keeper got me a ${item.title.toLowerCase()}!`);
    }
    return { result: null, changes: noChanges() };
  });
  return Response.json({ ok: true, message: `${item.title} is yours! The GOO is burned forever.`, tx });
}
