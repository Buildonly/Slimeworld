"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { post, usePoll } from "@/lib/use-poll";

type Data = { ok: boolean; balance: string; items: { id: string; title: string; description: string; price: string | null }[]; rewards: { care: string; win: string; rescueBurn: string } };

/** Your $GOO: how you earn it, and what to burn it for. */
export function GooPanel({ slimeId, onChanged }: { slimeId: string; onChanged?: () => void }) {
  const toast = useToast();
  const { data, refresh } = usePoll<Data>("/api/goo", 20_000);
  const [busy, setBusy] = useState(false);
  if (!data?.ok) return null;
  const have = BigInt(data.balance);
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-bg-soft p-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">🟢 $GOO</p>
        <p className="text-lg font-semibold">{Number(data.balance).toLocaleString()} GOO</p>
      </div>
      <p className="text-sm text-ink-soft">
        Earn {data.rewards.care} GOO a day for caring for your slime and {data.rewards.win} for each race win. Rescuing a sleeping slime burns {data.rewards.rescueBurn} GOO from the pool. Play money: no cash value.
      </p>
      {data.items.map((it) => (
        <div key={it.id} className="flex items-center justify-between gap-2 rounded-xl bg-card p-2.5">
          <span className="min-w-0">
            <b>👑 {it.title}</b>
            <span className="block text-xs text-ink-soft">{it.description}</span>
          </span>
          <Button
            tone="coin"
            disabled={busy || !it.price || have < BigInt(it.price ?? "0")}
            onClick={async () => {
              setBusy(true);
              const r = await post<{ ok: boolean; message?: string; error?: string }>("/api/goo", { slimeId, itemId: it.id });
              setBusy(false);
              toast(r.ok ? (r.message ?? "Done!") : (r.error ?? "That didn't work."), r.ok ? undefined : "error");
              if (r.ok) {
                await refresh();
                onChanged?.();
              }
            }}
          >
            Burn {it.price}
          </Button>
        </div>
      ))}
    </section>
  );
}
