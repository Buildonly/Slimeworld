/**
 * The player market: keepers sell to each other. An item from a slime's bag,
 * or shares in a shop (and with them, that shop's future profits). What is
 * for sale waits in the market until it sells or the seller takes it back.
 * Coins move through the money journal, so the town contract mirrors every
 * sale; the town takes its usual fee (TREASURY_FEE_BPS).
 */
import { BPS, ITEM_BY_ID, MARKET_MAX_LISTINGS, MARKET_MAX_PRICE, TREASURY_FEE_BPS, type Bits } from "./config";
import { nextWorldId } from "./ids";
import { playerParty, record, slimeParty } from "./journal";
import { remember } from "./memory";
import { formatCoins } from "./money";
import type { GameEvent, Listing, World } from "./types";

export type TradeResult = { ok: true; message: string; event?: GameEvent } | { ok: false; message: string };

const fail = (message: string): TradeResult => ({ ok: false, message });

function news(world: World, text: string): GameEvent {
  const event: GameEvent = { tick: world.tick, kind: "trade", text };
  world.events.push(event);
  return event;
}

function checkPrice(world: World, sellerId: string, price: Bits): string | null {
  if (price <= 0n || price > MARKET_MAX_PRICE) return `Prices go from 0.01 to ${formatCoins(MARKET_MAX_PRICE)} coins.`;
  if (world.listings.filter((l) => l.sellerId === sellerId).length >= MARKET_MAX_LISTINGS) return `You can have ${MARKET_MAX_LISTINGS} things for sale at once.`;
  return null;
}

/** Put one of a slime's items up for sale. */
export function listItem(world: World, playerId: string, slimeId: string, itemId: string, price: Bits): TradeResult {
  const slime = world.slimes[slimeId];
  if (!slime || slime.ownerId !== playerId) return fail("That's not your slime.");
  const item = ITEM_BY_ID.get(itemId);
  if (!item || (slime.items[itemId] ?? 0) < 1) return fail(`${slime.name} doesn't have that.`);
  const bad = checkPrice(world, playerId, price);
  if (bad) return fail(bad);
  slime.items[itemId] = (slime.items[itemId] ?? 0) - 1;
  world.listings.push({ id: nextWorldId(world, "L"), kind: "item", sellerId: playerId, slimeId, itemId, price, tick: world.tick });
  return { ok: true, message: `${item.title} is up for sale for ${formatCoins(price)} coins.` };
}

/** Put some of your shares in a shop up for sale. */
export function listShares(world: World, playerId: string, shopId: string, shares: Bits, price: Bits): TradeResult {
  const shop = world.shops[shopId];
  if (!shop) return fail("No such shop.");
  const held = shop.investors[playerId] ?? 0n;
  if (shares <= 0n || shares > held) return fail(`You hold ${formatCoins(held)} in ${shop.name}.`);
  const bad = checkPrice(world, playerId, price);
  if (bad) return fail(bad);
  shop.investors[playerId] = held - shares;
  if (shop.investors[playerId] === 0n) delete shop.investors[playerId];
  world.listings.push({ id: nextWorldId(world, "L"), kind: "shares", sellerId: playerId, shopId, shares, price, tick: world.tick });
  return { ok: true, message: `Your ${shop.name} shares are up for sale for ${formatCoins(price)} coins.` };
}

function giveBack(world: World, l: Listing): void {
  if (l.kind === "item") {
    const slime = world.slimes[l.slimeId];
    if (slime) slime.items[l.itemId] = (slime.items[l.itemId] ?? 0) + 1;
  } else {
    const shop = world.shops[l.shopId];
    if (shop) shop.investors[l.sellerId] = (shop.investors[l.sellerId] ?? 0n) + l.shares;
  }
}

/** Take something off the market; it goes back where it came from. */
export function cancelListing(world: World, playerId: string, listingId: string): TradeResult {
  const i = world.listings.findIndex((l) => l.id === listingId && l.sellerId === playerId);
  if (i < 0) return fail("That's not yours to take back.");
  const [l] = world.listings.splice(i, 1);
  giveBack(world, l!);
  return { ok: true, message: "Taken off the market." };
}

/** Buy something another player listed. Items go into one of the buyer's slimes' bags. */
export function buyListing(world: World, buyerId: string, listingId: string, toSlimeId: string | null): TradeResult {
  const l = world.listings.find((x) => x.id === listingId);
  const buyer = world.players[buyerId];
  if (!l || !buyer) return fail("That's already gone.");
  if (l.sellerId === buyerId) return fail("That's your own listing.");
  if (l.price > buyer.wallet) return fail("Not enough coins in your purse.");
  const toSlime = l.kind === "item" ? (toSlimeId ? world.slimes[toSlimeId] : undefined) : undefined;
  if (l.kind === "item" && (!toSlime || toSlime.ownerId !== buyerId)) return fail("Pick one of your slimes to get it.");
  const fee = (l.price * BigInt(TREASURY_FEE_BPS)) / BigInt(BPS);
  const proceeds = l.price - fee;
  buyer.wallet -= l.price;
  world.treasury += fee;
  record(world, { from: playerParty(buyerId), to: { kind: "town" }, amount: fee, kind: "spend", memo: "market fee" });
  const sellerName = world.players[l.sellerId]?.name ?? "a keeper";
  world.listings = world.listings.filter((x) => x.id !== l.id);

  if (l.kind === "item") {
    const item = ITEM_BY_ID.get(l.itemId)!;
    const seller = world.slimes[l.slimeId];
    if (seller) {
      seller.wallet += proceeds;
      seller.earnedTotal += proceeds;
      record(world, { from: playerParty(buyerId), to: slimeParty(seller.id), amount: proceeds, kind: "sale", memo: `market ${l.itemId}` });
      remember(seller, `My ${item.title.toLowerCase()} sold for ${formatCoins(l.price)} coins!`);
    } else {
      world.treasury += proceeds; // the seller's slime is gone; the town keeps it rather than lose it
    }
    toSlime!.items[l.itemId] = (toSlime!.items[l.itemId] ?? 0) + 1;
    remember(toSlime!, `My owner got me ${item.title.toLowerCase()} from the market.`);
    return { ok: true, message: `${toSlime!.name} got ${item.title.toLowerCase()} for ${formatCoins(l.price)} coins.`, event: news(world, `${buyer.name} bought ${item.title.toLowerCase()} from ${sellerName}.`) };
  }

  const shop = world.shops[l.shopId];
  const seller = world.players[l.sellerId];
  if (seller) {
    seller.wallet += proceeds;
    record(world, { from: playerParty(buyerId), to: playerParty(seller.id), amount: proceeds, kind: "sale", memo: `shares ${l.shopId}` });
  } else {
    world.treasury += proceeds;
  }
  if (shop) shop.investors[buyerId] = (shop.investors[buyerId] ?? 0n) + l.shares;
  return { ok: true, message: `You now own more of ${shop?.name ?? "the shop"}.`, event: news(world, `${buyer.name} bought shares in ${shop?.name ?? "a shop"} from ${sellerName}.`) };
}
