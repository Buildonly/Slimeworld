import { describe, expect, it } from "vitest";
import { BPS, coins, MARKET_MAX_LISTINGS, TREASURY_FEE_BPS } from "./config";
import { ensurePlayer, hatch } from "./actions";
import { invest } from "./shops";
import { buyListing, cancelListing, listItem, listShares } from "./trade";
import { createTown } from "./world";

function town() {
  const world = createTown(5, 6);
  ensurePlayer(world, "real-seller", "Sam's keeper", coins(500));
  ensurePlayer(world, "real-buyer", "Bea's keeper", coins(500));
  const sellerSlime = hatch(world, "real-seller", "Sam", "green", coins(10));
  const buyerSlime = hatch(world, "real-buyer", "Bea", "blue", coins(10));
  sellerSlime.items.ball = 2;
  const shop = Object.values(world.shops)[0]!;
  invest(world, shop, "real-seller", coins(200), { events: [] });
  world.players["real-seller"]!.wallet -= coins(200);
  world.journal = [];
  return { world, sellerSlime, buyerSlime, shop };
}

const fee = (price: bigint) => (price * BigInt(TREASURY_FEE_BPS)) / BigInt(BPS);

describe("player market", () => {
  it("sells an item from one slime's bag to another player's slime, fee to the town", () => {
    const { world, sellerSlime, buyerSlime } = town();
    expect(listItem(world, "real-seller", sellerSlime.id, "ball", coins(40)).ok).toBe(true);
    expect(sellerSlime.items.ball).toBe(1); // held by the market while for sale
    const treasury = world.treasury;
    const r = buyListing(world, "real-buyer", world.listings[0]!.id, buyerSlime.id);
    expect(r.ok).toBe(true);
    expect(buyerSlime.items.ball).toBe(1);
    expect(world.players["real-buyer"]!.wallet).toBe(coins(460));
    expect(sellerSlime.wallet).toBe(coins(10) + coins(40) - fee(coins(40)));
    expect(world.treasury - treasury).toBe(fee(coins(40)));
    expect(world.listings).toEqual([]);
    expect(world.journal.map((m) => [m.from.kind, m.to.kind, m.amount])).toEqual([
      ["player", "town", fee(coins(40))],
      ["player", "slime", coins(40) - fee(coins(40))],
    ]);
  });

  it("sells shop shares, and the profits follow the new owner", () => {
    const { world, shop } = town();
    expect(listShares(world, "real-seller", shop.id, coins(150), coins(160)).ok).toBe(true);
    expect(shop.investors["real-seller"]).toBe(coins(50));
    expect(buyListing(world, "real-buyer", world.listings[0]!.id, null).ok).toBe(true);
    expect(shop.investors["real-buyer"]).toBe(coins(150));
    expect(world.players["real-seller"]!.wallet).toBe(coins(300) + coins(160) - fee(coins(160)));
  });

  it("gives things back when the seller cancels", () => {
    const { world, sellerSlime, shop } = town();
    listItem(world, "real-seller", sellerSlime.id, "ball", coins(40));
    listShares(world, "real-seller", shop.id, coins(200), coins(220));
    expect(shop.investors["real-seller"]).toBeUndefined();
    for (const l of [...world.listings]) expect(cancelListing(world, "real-seller", l.id).ok).toBe(true);
    expect(sellerSlime.items.ball).toBe(2);
    expect(shop.investors["real-seller"]).toBe(coins(200));
  });

  it("refuses bad trades", () => {
    const { world, sellerSlime, buyerSlime, shop } = town();
    expect(listItem(world, "real-buyer", sellerSlime.id, "ball", coins(1)).ok).toBe(false); // not your slime
    expect(listItem(world, "real-seller", sellerSlime.id, "cake", coins(1)).ok).toBe(false); // not in the bag
    expect(listShares(world, "real-seller", shop.id, coins(999), coins(1)).ok).toBe(false); // more than held
    listItem(world, "real-seller", sellerSlime.id, "ball", coins(40));
    const id = world.listings[0]!.id;
    expect(buyListing(world, "real-seller", id, sellerSlime.id).ok).toBe(false); // own listing
    expect(cancelListing(world, "real-buyer", id).ok).toBe(false); // not theirs
    world.players["real-buyer"]!.wallet = coins(1);
    expect(buyListing(world, "real-buyer", id, buyerSlime.id).ok).toBe(false); // too poor
    expect(world.journal).toEqual([]);
  });

  it("caps how much one player can have for sale", () => {
    const { world, sellerSlime } = town();
    sellerSlime.items.ball = MARKET_MAX_LISTINGS + 2;
    for (let i = 0; i < MARKET_MAX_LISTINGS; i++) expect(listItem(world, "real-seller", sellerSlime.id, "ball", coins(1)).ok).toBe(true);
    expect(listItem(world, "real-seller", sellerSlime.id, "ball", coins(1)).ok).toBe(false);
  });
});
