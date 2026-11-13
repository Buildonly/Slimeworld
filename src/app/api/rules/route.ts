import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { slimeAccounts } from "@/db/schema";
import { GAME_DAYS_PER_REAL_DAY, YOCTO_PER_BIT } from "@/economy/config";
import { nearProvider } from "@/near/client";
import { contractIds } from "@/near/contracts";
import { gameAccount } from "@/near/client";
import { fail } from "@/server/http";
import { currentPlayerId } from "@/server/session";
import { MAIN_WORLD } from "@/server/world-store";

export const dynamic = "force-dynamic";

const query = z.object({ slimeId: z.string().regex(/^s[0-9a-z]{1,10}$/) });

/** The rules as the town contract holds them right now, read live from chain. Owner only. */
export async function GET(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return fail(400, "Which slime?");
  const [acct] = await db()
    .select()
    .from(slimeAccounts)
    .where(and(eq(slimeAccounts.worldId, MAIN_WORLD), eq(slimeAccounts.slimeId, parsed.data.slimeId), eq(slimeAccounts.playerId, playerId)));
  if (!acct) return fail(404, "Slime not found.");
  const game = gameAccount();
  if (!game || acct.status !== "ready") return Response.json({ onChain: null, account: acct.accountId, status: acct.status });
  const town = contractIds(game.accountId).town;
  const raw = await nearProvider()
    .callFunction<{ rules: { daily_limit: string; allowed: string[]; savings_target: string }; spent_today: string }>({
      contractId: town,
      method: "slime",
      args: { slime_id: acct.accountId },
    })
    .catch(() => null);
  // Back to game units: bits, and the limit per game day (the contract counts real days).
  const onChain = raw
    ? {
        dailyLimit: (BigInt(raw.rules.daily_limit) / YOCTO_PER_BIT / BigInt(GAME_DAYS_PER_REAL_DAY)).toString(),
        savingsTarget: (BigInt(raw.rules.savings_target) / YOCTO_PER_BIT).toString(),
        allowed: raw.rules.allowed,
      }
    : null;
  return Response.json({ onChain, account: acct.accountId, town, status: acct.status });
}
