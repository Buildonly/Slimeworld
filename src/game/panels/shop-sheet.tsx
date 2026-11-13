"use client";

import { useState } from "react";
import { SHOP_EMOJI } from "@/components/town/shop-style";
import { Button } from "@/components/ui/button";
import type { ShopDto } from "@/lib/dto";
import { formatBits, ITEM_EMOJI } from "@/lib/format";
import { GameSheet } from "./sheet";

const PERSONALITY: Record<string, string> = { greedy: "drives a hard bargain", fair: "keeps prices fair", generous: "loves a bargain" };

export function ShopSheet({
  shop,
  slimeName,
  coins,
  busy,
  onBuy,
  onInvest,
  onClose,
}: {
  shop: ShopDto;
  slimeName: string;
  coins: string;
  busy: boolean;
  onBuy: (itemId: string) => void;
  onInvest: (amount: number) => void;
  onClose: () => void;
}) {
  const [why, setWhy] = useState<string | null>(null);
  const [amount, setAmount] = useState(50);
  const closed = shop.status === "closed";
  return (
    <GameSheet title={`${SHOP_EMOJI[shop.id] ?? "🏪"} ${shop.name}`} subtitle={`${shop.keeper} ${PERSONALITY[shop.personality] ?? ""}.`} onClose={onClose}>
      {closed ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-2xl bg-danger/10 px-4 py-3 text-danger">{shop.keeper} ran out of money and closed up. Help reopen it and share the profit.</p>
          <InvestRow amount={amount} setAmount={setAmount} label="Reopen it" busy={busy} onInvest={onInvest} coins={coins} />
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {shop.prices
              .filter((p) => p.item !== "iron" && p.item !== "wood")
              .map((p) => {
                const up = BigInt(p.price) > BigInt(p.base);
                return (
                  <li key={p.item} className="rounded-2xl bg-bg-soft p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{ITEM_EMOJI[p.item]}</span>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setWhy(why === p.item ? null : p.item)} aria-expanded={why === p.item}>
                        <span className="block font-semibold">{p.title}</span>
                        <span className={`block text-xs ${up ? "text-danger" : "text-accent"}`}>
                          {up ? "pricier" : "cheaper"} than usual · {p.stock} left
                        </span>
                      </button>
                      <Button size="md" disabled={busy || p.stock === 0} onClick={() => onBuy(p.item)}>
                        🪙 {formatBits(p.price)}
                      </Button>
                    </div>
                    {why === p.item && <p className="mt-2 text-sm text-ink-soft">“{p.reason}” — {shop.keeper}</p>}
                  </li>
                );
              })}
          </ul>
          {shop.buys.length > 0 && <p className="mt-3 text-sm text-ink-soft">{shop.keeper} also buys {shop.buys.join(" and ")} from slimes.</p>}
          <p className="mt-3 text-center text-sm text-ink-soft">
            Bought for {slimeName} with your coins (🪙 {formatBits(coins)}). Tap an item to hear why it costs that.
          </p>
          <details className="mt-3 rounded-2xl bg-bg-soft p-3">
            <summary className="cursor-pointer font-medium">Invest in {shop.name}</summary>
            <div className="mt-2">
              <InvestRow amount={amount} setAmount={setAmount} label="Invest" busy={busy} onInvest={onInvest} coins={coins} />
            </div>
          </details>
        </>
      )}
    </GameSheet>
  );
}

function InvestRow({ amount, setAmount, label, busy, onInvest, coins }: { amount: number; setAmount: (n: number) => void; label: string; busy: boolean; onInvest: (n: number) => void; coins: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        aria-label="Coins to invest"
        value={amount}
        onChange={(e) => setAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
        className="w-24 rounded-xl border border-line bg-card px-3 py-2"
      />
      <span className="text-sm text-ink-soft">of 🪙 {formatBits(coins)}</span>
      <Button tone="coin" className="ml-auto" disabled={busy} onClick={() => onInvest(amount)}>
        {label}
      </Button>
    </div>
  );
}
