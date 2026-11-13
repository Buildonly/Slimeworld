/** The minds the live town uses: NEAR AI when a key is configured, else the free heuristic minds. */
import { defaultMinds, type Minds } from "@/economy/tick";
import { serverEnv } from "@/lib/env";
import { nearAiShopMind } from "./shop-mind";
import { budgetedMind, nearAiSlimeMind } from "./slime-mind";
import { DEFAULT_MIND_MODEL, MIND_CALLS_PER_TICK } from "./settings";

export function liveMinds(): Minds {
  const env = serverEnv();
  if (!env.NEAR_AI_API_KEY) return defaultMinds;
  const model = env.NEAR_AI_MODEL ?? DEFAULT_MIND_MODEL;
  const key = env.NEAR_AI_API_KEY === "proxy-injected" ? undefined : env.NEAR_AI_API_KEY;
  const ai = nearAiSlimeMind(model, key);
  return {
    // Slimes owned by real players always think on NEAR AI; town slimes share a small budget.
    slime: budgetedMind(ai, MIND_CALLS_PER_TICK, (ctx) => {
      const owner = ctx.slime.ownerId ? ctx.world?.players[ctx.slime.ownerId] : undefined;
      return owner?.care === "real";
    }),
    shop: nearAiShopMind(model, key),
    simulateOwners: true,
  };
}
