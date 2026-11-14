"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty, ErrorNote, Loading } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatBits } from "@/lib/format";
import { post, usePoll } from "@/lib/use-poll";
import type { MarketDto } from "@/server/trade";

type Data = MarketDto & { ok: boolean };

function wholeCoins(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Buy from and sell to other keepers: items and shop shares. */
export function TradePanel({ onChanged }: { onChanged?: () => void }) {
  const toast = useToast();
  const { data, error, refresh } = usePoll<Data>("/api/trade", 10_000);
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState<string | null>(null);
  const [sell, setSell] = useState<{ key: string; price: string; shares?: string } | null>(null);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    const r = await post<{ ok: boolean; message?: string; error?: string }>("/api/trade", body);
    setBusy(false);
    toast(r.ok ? (r.message ?? "Done!") : (r.error ?? "That didn't work."), r.ok ? undefined : "error");
    if (r.ok) {
      setSell(null);
      await refresh();
      onChanged?.();
    }
    return r.ok;
  }

  if (error && !data) return <ErrorNote message="The market didn't load." onRetry={refresh} />;
  if (!data) return <Loading label="Opening the market…" />;
  const target = to ?? data.mySlimes[0]?.id ?? null;
  const others = data.listings.filter((l) => !l.mine);
  const mine = data.listings.filter((l) => l.mine);
  const priceInput = (aria: string) => (
    <input
      inputMode="numeric"
      autoFocus
      value={sell?.price ?? ""}
      onChange={(e) => setSell((s) => (s ? { ...s, price: e.target.value.replace(/\D/g, "") } : s))}
      placeholder="Price"
      aria-label={aria}
      className="w-24 rounded-xl border border-line bg-card px-3 py-2"
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">
        Your purse: <b>🪙 {formatBits(data.purse)}</b>. Buy from other keepers or sell what your slimes don&apos;t need. The town keeps a small fee.
      </p>

      <section className="flex flex-col gap-2">
        <p className="font-semibold">For sale</p>
        {data.mySlimes.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            Items go to
            <select value={target ?? ""} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-line bg-card px-2 py-1">
              {data.mySlimes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {others.length === 0 ? (
          <Empty title="Nothing for sale yet">Be the first to sell something!</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {others.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-2xl bg-bg-soft p-3">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {l.kind === "shares" ? "📈 " : "🎁 "}
                    {l.title}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    {l.detail} · {l.seller}
                  </span>
                </span>
                <Button tone="coin" disabled={busy || BigInt(l.price) > BigInt(data.purse)} onClick={() => send({ action: "buy", listingId: l.id, toSlimeId: l.kind === "item" ? target : null })}>
                  🪙 {formatBits(l.price)}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <p className="font-semibold">Sell</p>
        {data.mySlimes.every((s) => s.items.length === 0) && data.myShares.length === 0 && <p className="text-sm text-ink-soft">Your slimes have nothing to sell yet. Items they find and shop shares you own show up here.</p>}
        {data.mySlimes.flatMap((s) =>
          s.items.map((it) => {
            const key = `${s.id}:${it.id}`;
            const open = sell?.key === key;
            return (
              <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-bg-soft p-3">
                <span>
                  <b>{it.title}</b> ×{it.count} <span className="text-sm text-ink-soft">· {s.name}</span>
                </span>
                {open ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const price = wholeCoins(sell.price);
                      if (price) void send({ action: "listItem", slimeId: s.id, itemId: it.id, price });
                    }}
                  >
                    {priceInput(`Price for ${it.title}`)}
                    <Button type="submit" disabled={busy || !wholeCoins(sell.price)}>
                      List
                    </Button>
                  </form>
                ) : (
                  <Button tone="soft" onClick={() => setSell({ key, price: "" })}>
                    Sell
                  </Button>
                )}
              </div>
            );
          }),
        )}
        {data.myShares.map((sh) => {
          const key = `shares:${sh.shopId}`;
          const open = sell?.key === key;
          return (
            <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-bg-soft p-3">
              <span>
                <b>{sh.shop} shares</b> <span className="text-sm text-ink-soft">· 🪙 {formatBits(sh.shares)} invested</span>
              </span>
              {open ? (
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const price = wholeCoins(sell.price);
                    const shares = wholeCoins(sell.shares ?? "");
                    if (price && shares) void send({ action: "listShares", shopId: sh.shopId, shares, price });
                  }}
                >
                  <input
                    inputMode="numeric"
                    value={sell.shares ?? ""}
                    onChange={(e) => setSell((s) => (s ? { ...s, shares: e.target.value.replace(/\D/g, "") } : s))}
                    placeholder="How much"
                    aria-label={`How much of your ${sh.shop} stake to sell`}
                    className="w-24 rounded-xl border border-line bg-card px-3 py-2"
                  />
                  {priceInput(`Price for ${sh.shop} shares`)}
                  <Button type="submit" disabled={busy || !wholeCoins(sell.price) || !wholeCoins(sell.shares ?? "")}>
                    List
                  </Button>
                </form>
              ) : (
                <Button tone="soft" onClick={() => setSell({ key, price: "", shares: "" })}>
                  Sell
                </Button>
              )}
            </div>
          );
        })}
      </section>

      {mine.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <p className="font-semibold">Your listings</p>
          {mine.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 rounded-2xl bg-bg-soft p-3">
              <span className="min-w-0 truncate">
                {l.title} · 🪙 {formatBits(l.price)}
              </span>
              <Button tone="soft" disabled={busy} onClick={() => send({ action: "cancel", listingId: l.id })}>
                Take back
              </Button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
