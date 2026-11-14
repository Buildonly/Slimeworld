/** The player market, on the locked town. */
import type { Db } from "@/db/client";
import { ITEM_BY_ID, type Bits } from "@/economy/config";
import { buyListing, cancelListing, listItem, listShares, type TradeResult } from "@/economy/trade";
import type { World } from "@/economy/types";
import { noChanges, withWorld } from "./world-store";

export type TradeAction =
  | { action: "listItem"; slimeId: string; itemId: string; price: Bits }
  | { action: "listShares"; shopId: string; shares: Bits; price: Bits }
  | { action: "cancel"; listingId: string }
  | { action: "buy"; listingId: string; toSlimeId: string | null };

export async function tradeForPlayer(db: Db, playerId: string, a: TradeAction): Promise<TradeResult> {
  const result = await withWorld(db, async (world) => {
    const r =
      a.action === "listItem"
        ? listItem(world, playerId, a.slimeId, a.itemId, a.price)
        : a.action === "listShares"
          ? listShares(world, playerId, a.shopId, a.shares, a.price)
          : a.action === "cancel"
            ? cancelListing(world, playerId, a.listingId)
            : buyListing(world, playerId, a.listingId, a.toSlimeId);
    const changes = noChanges();
    changes.moves = world.journal.splice(0);
    if (r.ok && r.event) changes.events.push(r.event);
    return { result: r, changes };
  });
  return result ?? { ok: false, message: "The town is busy. Try again." };
}

export type ListingDto = { id: string; kind: "item" | "shares"; title: string; detail: string; price: string; seller: string; mine: boolean };
export type MarketDto = {
  listings: ListingDto[];
  mySlimes: { id: string; name: string; items: { id: string; title: string; count: number }[] }[];
  myShares: { shopId: string; shop: string; shares: string }[];
  purse: string;
};

export function marketDto(world: World, viewerId: string | null): MarketDto {
  const listings = [...world.listings]
    .sort((a, b) => b.tick - a.tick)
    .map((l): ListingDto => {
      const seller = world.players[l.sellerId]?.name ?? "A keeper";
      if (l.kind === "item") {
        const item = ITEM_BY_ID.get(l.itemId);
        return { id: l.id, kind: "item", title: item?.title ?? l.itemId, detail: `${item?.category ?? "Item"} · from ${world.slimes[l.slimeId]?.name ?? "a slime"}`, price: l.price.toString(), seller, mine: l.sellerId === viewerId };
      }
      return { id: l.id, kind: "shares", title: `${world.shops[l.shopId]?.name ?? "Shop"} shares`, detail: `${(Number(l.shares) / 100).toLocaleString()} coins' worth · gets a share of its profits`, price: l.price.toString(), seller, mine: l.sellerId === viewerId };
    });
  const mine = viewerId ? Object.values(world.slimes).filter((s) => s.ownerId === viewerId) : [];
  return {
    listings,
    mySlimes: mine.map((s) => ({
      id: s.id,
      name: s.name,
      items: Object.entries(s.items)
        .filter(([, n]) => n > 0)
        .map(([id, count]) => ({ id, title: ITEM_BY_ID.get(id)?.title ?? id, count })),
    })),
    myShares: viewerId
      ? Object.values(world.shops)
          .filter((sh) => (sh.investors[viewerId] ?? 0n) > 0n)
          .map((sh) => ({ shopId: sh.id, shop: sh.name, shares: sh.investors[viewerId]!.toString() }))
      : [],
    purse: (viewerId ? (world.players[viewerId]?.wallet ?? 0n) : 0n).toString(),
  };
}
