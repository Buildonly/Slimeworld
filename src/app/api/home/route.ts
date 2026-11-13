import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { decisions } from "@/db/schema";
import { cheapestSellers } from "@/economy/market";
import type { DecisionDto, HomeDto } from "@/lib/dto";
import { serverEnv } from "@/lib/env";
import { gameAccount } from "@/near/client";
import { contractIds } from "@/near/contracts";
import { fail } from "@/server/http";
import { getPlayer } from "@/server/players";
import { playerSlimes } from "@/server/player-town";
import { currentPlayerId } from "@/server/session";
import { clock, decisionDto, slimeDto } from "@/lib/views";
import { MAIN_WORLD } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** Everything the Home screen shows for the signed-in player. */
export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  const account = await getPlayer(db(), playerId);
  const { player, slimes, world } = await playerSlimes(db(), playerId);
  const ids = slimes.map((s) => s.slime.id);
  const recent: Record<string, DecisionDto[]> = {};
  if (ids.length) {
    const rows = await db()
      .select()
      .from(decisions)
      .where(and(eq(decisions.worldId, MAIN_WORLD), inArray(decisions.actorId, ids)))
      .orderBy(desc(decisions.id))
      .limit(60);
    for (const r of rows) {
      const list = (recent[r.actorId] ??= []);
      if (list.length < 3) list.push(decisionDto(r));
    }
  }
  const food = ["berries", "jelly", "ice", "cake"].map((i) => cheapestSellers(world, i)[0]?.price).filter((p): p is bigint => p !== undefined).sort((a, b) => (a < b ? -1 : 1))[0];
  const game = gameAccount()?.accountId ?? "";
  const body: HomeDto = {
    clock: clock(world),
    player: player ? { id: player.id, wallet: player.wallet.toString(), nearAccountId: account?.nearAccountId ?? null } : null,
    slimes: slimes.map(({ slime, chain }) => slimeDto(world, slime, chain ? { accountId: chain.accountId, nftTokenId: chain.nftTokenId, status: chain.status } : null)),
    recent,
    feedPrice: food?.toString() ?? null,
    contracts: { ...contractIds(game), network: serverEnv().NEAR_NETWORK },
  };
  return Response.json(body);
}
