"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ShopDto } from "@/lib/dto";
import { formatBits, ITEM_EMOJI } from "@/lib/format";
import { post } from "@/lib/use-poll";
import { SHOP_EMOJI, shopColour } from "./shop-style";

const PERSONALITY: Record<string, string> = { greedy: "drives a hard bargain", fair: "keeps prices fair", generous: "likes a bargain for everyone" };

/** One shop: prices with the keeper's reasons, stock, and investing. */
export function ShopPanel({ shop, signedIn, onChanged }: { shop: ShopDto; signedIn: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const closed = shop.status === "closed";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: `${shopColour(shop.id)}33` }}>
          {SHOP_EMOJI[shop.id] ?? "🏪"}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{shop.name}</h2>
          <p className="text-sm text-ink-soft">
            {shop.keeper} {PERSONALITY[shop.personality] ?? ""}. {shop.investors ? `${shop.investors} investors.` : ""}
          </p>
        </div>
      </div>
      {closed ? (
        <p className="rounded-2xl bg-danger/10 px-4 py-3 text-danger">This shop ran out of money and closed. Invest to open it again and share its profit.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shop.prices.map((p) => {
            const up = BigInt(p.price) > BigInt(p.base);
            return (
              <li key={p.item}>
                <button type="button" className="flex w-full items-center gap-3 py-2 text-left" onClick={() => setWhy(why === p.item ? null : p.item)} aria-expanded={why === p.item}>
                  <span className="text-xl">{ITEM_EMOJI[p.item]}</span>
                  <span className="flex-1">
                    <span className="block font-medium">{p.title}</span>
                    <span className="block text-xs text-ink-soft">{p.stock} in stock</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold">🪙 {formatBits(p.price)}</span>
                    <span className={`block text-xs ${up ? "text-danger" : "text-accent"}`}>
                      {up ? "▲" : "▼"} base {formatBits(p.base)}
                    </span>
                  </span>
                </button>
                {why === p.item && <p className="mb-2 rounded-xl bg-bg-soft px-3 py-2 text-sm">💬 {shop.keeper}: “{p.reason}”</p>}
              </li>
            );
          })}
        </ul>
      )}
      {shop.hoard && !closed && <p className="text-sm text-ink-soft">🤫 {shop.keeper} is holding some {shop.hoard} back to push the price up.</p>}
      {signedIn ? (
        <div className="flex items-center gap-2 rounded-2xl bg-bg-soft p-3">
          <label className="text-sm" htmlFor={`invest-${shop.id}`}>
            Invest
          </label>
          <input
            id={`invest-${shop.id}`}
            type="number"
            min={1}
            max={100000}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            className="w-20 rounded-xl border border-line bg-card px-2 py-1"
          />
          <span className="text-sm text-ink-soft">coins</span>
          <Button
            tone="coin"
            className="ml-auto"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await post("/api/invest", { shopId: shop.id, amount });
              setBusy(false);
              toast(r.ok ? r.message ?? "Invested!" : r.error ?? "Could not invest.", r.ok ? "ok" : "error");
              if (r.ok) onChanged();
            }}
          >
            {closed ? "Reopen it" : "Invest"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">Sign in to invest and earn a share of the profit.</p>
      )}
    </div>
  );
}
