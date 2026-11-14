"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Empty, Loading } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { HomeDto, SlimeDto } from "@/lib/dto";
import { explorer, formatBits } from "@/lib/format";
import { post, usePoll } from "@/lib/use-poll";

const CATEGORIES = [
  { id: "Food", label: "Food", hint: "Berries, jelly, cake, ice" },
  { id: "Training", label: "Training", hint: "Books and weights: better jobs" },
  { id: "Toy", label: "Toys", hint: "Fun, makes it happy" },
  { id: "Hat", label: "Hats", hint: "Charm, and very stylish" },
] as const;
const JOBS = [
  { id: "delivery", label: "Deliveries" },
  { id: "helper", label: "Shop helper" },
  { id: "guard", label: "Guard" },
  { id: "race", label: "Races (entry fee)" },
  { id: "puzzle", label: "Puzzle contests (entry fee)" },
] as const;

type OnChain = { onChain: { dailyLimit: string; savingsTarget: string; allowed: string[] } | null; town?: string; status: string } | null;

const coinsOf = (bits: string) => Number(BigInt(bits) / 100n);

export function RulesForm({ slime, onSaved }: { slime: SlimeDto; onSaved: () => void }) {
  const toast = useToast();
  const [limit, setLimit] = useState(coinsOf(slime.rules.dailyLimit));
  const [savings, setSavings] = useState(coinsOf(slime.rules.savingsTarget));
  const [allowed, setAllowed] = useState<string[]>(slime.rules.allowed);
  const [jobs, setJobs] = useState<string[]>(slime.rules.allowedJobs);
  const [busy, setBusy] = useState(false);
  const { data: chain, refresh } = usePoll<OnChain>(`/api/rules?slimeId=${slime.id}`, 15_000);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
      <Card className="flex min-w-0 flex-col gap-5">
        <div>
          <label htmlFor="limit" className="flex justify-between font-semibold">
            Daily spending limit <span>🪙 {limit}</span>
          </label>
          <input id="limit" type="range" min={0} max={500} step={5} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          <p className="text-sm text-ink-soft">The most {slime.name} may spend in one town day.</p>
        </div>
        <div>
          <label htmlFor="savings" className="flex justify-between font-semibold">
            Savings target <span>🪙 {savings}</span>
          </label>
          <input id="savings" type="range" min={0} max={500} step={5} value={savings} onChange={(e) => setSavings(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          <p className="text-sm text-ink-soft">It won&apos;t spend below this, except on food when it&apos;s starving.</p>
        </div>
        <fieldset>
          <legend className="mb-2 font-semibold">It may buy</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-bg-soft p-3">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--accent)]" checked={allowed.includes(c.id)} onChange={() => setAllowed((a) => toggle(a, c.id))} />
                <span>
                  <span className="block font-medium">{c.label}</span>
                  <span className="block text-sm text-ink-soft">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 font-semibold">Jobs it may take</legend>
          <div className="flex flex-wrap gap-2">
            {JOBS.map((j) => (
              <label key={j.id} className="flex cursor-pointer items-center gap-2 rounded-full bg-bg-soft px-3 py-1.5">
                <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={jobs.includes(j.id)} onChange={() => setJobs((x) => toggle(x, j.id))} />
                {j.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Button
          size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await post("/api/actions", { action: "rules", slimeId: slime.id, rules: { dailyLimit: limit, savingsTarget: savings, allowed, allowedJobs: jobs } });
            setBusy(false);
            toast(r.ok ? "Saved. You signed it; the game paid the gas." : r.error ?? "Could not save.", r.ok ? "ok" : "error");
            if (r.ok) {
              onSaved();
              setTimeout(() => void refresh(), 6000);
            }
          }}
        >
          {busy ? "Saving…" : "Save rules"}
        </Button>
      </Card>
      <Card className="flex min-w-0 flex-col gap-3 text-sm">
        <h2 className="text-base font-semibold">On the town contract now</h2>
        <p className="text-ink-soft">The town contract checks every spend against these rules again, so even the game&apos;s server can&apos;t overspend {slime.name}.</p>
        {!chain ? (
          <Loading label="Reading the chain…" />
        ) : chain.onChain ? (
          <ul className="space-y-1">
            <li>Daily limit: 🪙 {formatBits(chain.onChain.dailyLimit)} per town day</li>
            <li>Savings: 🪙 {formatBits(chain.onChain.savingsTarget)}</li>
            <li>Allowed: {chain.onChain.allowed.join(", ") || "nothing"}</li>
          </ul>
        ) : (
          <p className="text-ink-soft">{chain.status === "ready" ? "Not found on chain yet." : "Setting up on chain…"}</p>
        )}
        {chain?.town && (
          <a className="text-accent underline" href={explorer("address", chain.town)} target="_blank" rel="noreferrer">
            View the town contract
          </a>
        )}
      </Card>
    </div>
  );
}

export function RulesScreen() {
  const params = useSearchParams();
  const { data: home, error, refresh } = usePoll<HomeDto>("/api/home", 60_000);
  if (error === "Please sign in.") return <Empty title="Sign in to set your slime's rules" />;
  if (!home) return <Loading />;
  const slime = home.slimes.find((s) => s.id === params.get("slime")) ?? home.slimes[0];
  if (!slime) return <Empty title="No slime yet"><Link className="text-accent underline" href="/">Hatch one first.</Link></Empty>;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{slime.name}&apos;s rules</h1>
        <p className="text-ink-soft">{slime.name} acts alone inside these rules, and tells you why in its log.</p>
      </div>
      <RulesForm key={slime.id} slime={slime} onSaved={refresh} />
    </div>
  );
}
