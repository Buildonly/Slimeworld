/** The shopkeeper's daily strategy on NEAR AI Cloud (prompts/shopkeeper.md). */
import { ITEM_BY_ID, MAX_HIRES, SHOP_RENT_PER_DAY } from "@/economy/config";
import { formatCoins } from "@/economy/money";
import { season } from "@/economy/seasons";
import { heuristicShopStrategy, type ShopStrategy } from "@/economy/shops";
import type { ShopMind } from "@/economy/tick";
import type { Shop, World } from "@/economy/types";
import { extractJson, shopAnswerSchema } from "./answers";
import { chatSigned } from "./client";
import { fill, loadPrompt } from "./prompts";
import { DEFAULT_MIND_MODEL, MIND_MAX_TOKENS } from "./settings";

export function shopPrompt(world: World, shop: Shop): string {
  const title = (id: string) => ITEM_BY_ID.get(id)?.title ?? id;
  const rivals = Object.values(world.shops)
    .filter((s) => s.id !== shop.id && s.open && Object.keys(s.targets).some((i) => shop.targets[i] !== undefined))
    .map((s) => `- ${s.name}: ${Object.entries(s.prices).filter(([i]) => shop.targets[i] !== undefined).map(([i, p]) => `${title(i)} ${formatCoins(p.price)}`).join(", ")}`)
    .join("\n");
  return fill(loadPrompt("shopkeeper"), {
    name: shop.keeper,
    shopType: shop.name,
    personality: shop.personality,
    balance: formatCoins(shop.wallet),
    dailyCosts: formatCoins(SHOP_RENT_PER_DAY),
    stock: Object.entries(shop.stock).map(([i, n]) => `- ${title(i)}: ${n} (wants ${shop.targets[i] ?? 0})`).join("\n"),
    sales: Object.entries(shop.salesWindow).map(([i, w]) => `- ${title(i)}: ${w.reduce((a, b) => a + b, 0)}`).join("\n"),
    rivals: rivals || "- none",
    season: season(world.season).title,
    maxHires: MAX_HIRES,
  });
}

export function nearAiShopMind(model = DEFAULT_MIND_MODEL, apiKey?: string, fetcher?: typeof fetch): ShopMind {
  return {
    name: "near-ai",
    async decide(world, shop): Promise<ShopStrategy> {
      try {
        const answer = await chatSigned({ model, system: shopPrompt(world, shop), user: "Choose today's strategy.", maxTokens: MIND_MAX_TOKENS + 80, apiKey, fetcher });
        const parsed = shopAnswerSchema.safeParse(extractJson(answer.content));
        if (!parsed.success) return heuristicShopStrategy(world, shop);
        const a = parsed.data;
        const hoard = a.hoard && shop.targets[a.hoard] !== undefined ? a.hoard : null;
        return {
          margin: a.margin,
          hire: Math.min(a.hire, MAX_HIRES),
          hoard,
          reason: a.reason.slice(0, 100),
          verified: answer.verified,
          signature: answer.proof.signature || null,
          proof: answer.proof,
        };
      } catch {
        return heuristicShopStrategy(world, shop);
      }
    },
  };
}
