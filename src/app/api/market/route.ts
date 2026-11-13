import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { prices } from "@/db/schema";
import { ITEMS, TICKS_PER_DAY } from "@/economy/config";
import { cheapestSellers } from "@/economy/market";
import type { MarketDto } from "@/lib/dto";
import { clock } from "@/lib/views";
import { loadWorld, MAIN_WORLD } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** Every item with the best price now, why, and its price history (cheapest shop per day). */
export async function GET() {
  const world = await loadWorld(db());
  const fromDay = Math.floor(world.tick / TICKS_PER_DAY) - 30;
  const rows = await db().select().from(prices).where(and(eq(prices.worldId, MAIN_WORLD), gte(prices.day, fromDay)));
  const byItem = new Map<string, Map<number, bigint>>();
  for (const r of rows) {
    const days = byItem.get(r.itemId) ?? new Map<number, bigint>();
    const cur = days.get(r.day);
    if (cur === undefined || r.price < cur) days.set(r.day, r.price);
    byItem.set(r.itemId, days);
  }
  const body: MarketDto = {
    clock: clock(world),
    items: ITEMS.map((item) => {
      const best = cheapestSellers(world, item.id)[0];
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        base: item.basePrice.toString(),
        best: best ? { price: best.price.toString(), shopId: best.shop.id, shopName: best.shop.name, reason: best.shop.prices[item.id]?.reason ?? "" } : null,
        history: [...(byItem.get(item.id) ?? new Map<number, bigint>()).entries()].sort((a, b) => a[0] - b[0]).map(([day, p]) => ({ day, price: p.toString() })),
      };
    }),
  };
  return Response.json(body);
}
