"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatBits } from "@/lib/format";
import { post, usePoll } from "@/lib/use-poll";
import { GameSheet } from "./sheet";

type Coin = { id: string; label: string; chain: string; symbol: string };
type TopUp = { id: number; coin: string; send: string; depositAddress: string; depositMemo: string | null; status: string; coins: string | null; seconds: number };
type Preview = { send: string; receiveNear: string; coins: string; usd: string | null; seconds: number };

const STEPS = [
  { key: "deposit", label: "Waiting for your deposit" },
  { key: "swap", label: "Swapping to NEAR" },
  { key: "done", label: "Coins added" },
];

function stepOf(status: string, credited: boolean): number {
  if (credited) return 3;
  if (status === "PENDING_DEPOSIT" || status === "INCOMPLETE_DEPOSIT") return 0;
  return status === "SUCCESS" || status === "CREDITING" ? 2 : 1;
}

function TopUpTracker({ start, onDone }: { start: TopUp; onDone: () => void }) {
  const { data } = usePoll<{ topUp: TopUp }>(`/api/topup/${start.id}`, 5000);
  const t = data?.topUp ?? start;
  const [copied, setCopied] = useState(false);
  const credited = t.coins !== null;
  const step = stepOf(t.status, credited);
  useEffect(() => {
    if (credited) onDone();
  }, [credited, onDone]);
  if (t.status === "REFUNDED" || t.status === "FAILED")
    return <p className="rounded-2xl bg-danger/10 p-3 text-danger">That swap didn&apos;t go through, so the money was sent back to your NEAR account.</p>;
  return (
    <div className="flex flex-col gap-3">
      {!credited && (
        <div className="rounded-2xl bg-bg-soft p-3">
          <p className="text-sm text-ink-soft">
            Send exactly <b className="text-ink">{t.send}</b> to this address from any wallet or exchange:
          </p>
          <button
            type="button"
            className="mt-2 flex w-full items-center gap-2 rounded-xl bg-card p-3 text-left font-mono text-sm break-all"
            onClick={async () => {
              await navigator.clipboard?.writeText(t.depositAddress).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <span className="flex-1">{t.depositAddress}</span>
            {copied ? <Check size={18} className="text-accent" /> : <Copy size={18} />}
          </button>
          {t.depositMemo && <p className="mt-2 text-sm">Memo: <b>{t.depositMemo}</b> (you must include it)</p>}
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-3">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${i < step ? "bg-accent text-accent-ink" : i === step ? "animate-pulse bg-coin/60" : "bg-bg-soft text-ink-soft"}`}>
              {i < step ? "✓" : i + 1}
            </span>
            <span className={i <= step ? "font-medium" : "text-ink-soft"}>{s.label}</span>
          </li>
        ))}
      </ol>
      {credited ? (
        <p className="rounded-2xl bg-accent/15 p-3 font-semibold">🎉 🪙 {formatBits(t.coins!)} coins added to your purse!</p>
      ) : (
        <p className="text-sm text-ink-soft">Usually takes about {Math.max(1, Math.round(t.seconds / 60))} minute{t.seconds > 90 ? "s" : ""} after your deposit lands.</p>
      )}
    </div>
  );
}

/** Your coins, your slime's coins, and adding coins from any chain. */
export function CoinsSheet({ slimeName, slimeCoins, playerCoins, busy, onGive, onClose, onChanged }: { slimeName: string; slimeCoins: string; playerCoins: string; busy: boolean; onGive: (n: number) => void; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { data } = usePoll<{ live: boolean; coins: Coin[]; recent: TopUp[] }>("/api/topup", 30_000);
  const [coinId, setCoinId] = useState("usdc-base");
  const [amount, setAmount] = useState("5");
  const [preview, setPreview] = useState<Preview | string | null>(null);
  const [active, setActive] = useState<TopUp | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!/^\d+(\.\d+)?$/.test(amount)) return;
    const t = setTimeout(async () => {
      const r = await post<{ ok: boolean; preview?: Preview; error?: string }>("/api/topup/preview", { coinId, amount });
      setPreview(r.ok && r.preview ? r.preview : (r.error ?? "Prices are unavailable right now."));
    }, 500);
    return () => clearTimeout(t);
  }, [coinId, amount]);

  const pending = active ?? data?.recent.find((t) => t.coins === null && !["REFUNDED", "FAILED"].includes(t.status)) ?? null;

  return (
    <GameSheet title="🪙 Coins" subtitle={`${slimeName} spends its own coins, inside your rules.`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-bg-soft p-3">
          <p className="text-2xl font-semibold">{formatBits(slimeCoins)}</p>
          <p className="text-xs text-ink-soft">{slimeName}&apos;s coins</p>
        </div>
        <div className="rounded-2xl bg-bg-soft p-3">
          <p className="text-2xl font-semibold">{formatBits(playerCoins)}</p>
          <p className="text-xs text-ink-soft">Your purse</p>
        </div>
      </div>
      <p className="mb-2 mt-4 font-semibold">Give {slimeName} coins from your purse</p>
      <div className="grid grid-cols-4 gap-2">
        {[10, 25, 50, 100].map((n) => (
          <Button key={n} tone="coin" disabled={busy || BigInt(playerCoins) < BigInt(n * 100)} onClick={() => onGive(n)}>
            {n}
          </Button>
        ))}
      </div>

      <p className="mb-2 mt-5 font-semibold">Add coins from any chain</p>
      {pending ? (
        <TopUpTracker
          start={pending}
          onDone={() => {
            toast("Coins added!");
            onChanged();
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pay with">
            {(data?.coins ?? []).map((c) => (
              <button key={c.id} role="radio" aria-checked={coinId === c.id} onClick={() => setCoinId(c.id)} className="rounded-full border border-line px-3 py-1.5 text-sm aria-checked:bg-ink aria-checked:text-bg">
                {c.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-sm text-ink-soft">Amount</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-28 rounded-xl border border-line bg-card px-3 py-2 text-lg"
              aria-label="Amount to send"
            />
            <span className="font-semibold">{data?.coins.find((c) => c.id === coinId)?.symbol}</span>
          </label>
          {typeof preview === "string" ? (
            <p className="text-sm text-danger">{preview}</p>
          ) : preview ? (
            <p className="rounded-2xl bg-bg-soft p-3">
              You get about <b>🪙 {formatBits(preview.coins)}</b> coins ({preview.receiveNear.slice(0, 6)} NEAR){preview.usd ? ` for ~$${Number(preview.usd).toFixed(2)}` : ""}. Takes about {Math.max(1, Math.round(preview.seconds / 60))} min.
            </p>
          ) : null}
          {data?.live ? (
            <Button
              size="lg"
              disabled={starting || typeof preview !== "object" || preview === null}
              onClick={async () => {
                setStarting(true);
                const r = await post<{ ok: boolean; topUp?: TopUp; error?: string }>("/api/topup", { coinId, amount });
                setStarting(false);
                if (r.ok && r.topUp) setActive(r.topUp);
                else toast(r.error ?? "Could not start the top up.", "error");
              }}
            >
              {starting ? "Getting your address…" : "Get my deposit address"}
            </Button>
          ) : (
            <p className="text-sm text-ink-soft">Top ups open when the town moves to NEAR mainnet. Prices above are live.</p>
          )}
          <p className="text-xs text-ink-soft">Swapped by NEAR Intents. If anything goes wrong, the money goes back to your NEAR account.</p>
        </div>
      )}
    </GameSheet>
  );
}
