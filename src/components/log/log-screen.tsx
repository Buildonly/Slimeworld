"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card, Empty, ErrorNote, Loading } from "@/components/ui/states";
import type { DecisionDto, HomeDto } from "@/lib/dto";
import { explorer } from "@/lib/format";
import { usePoll } from "@/lib/use-poll";
import { DecisionItem } from "./decision-item";

const FILTERS = { all: "All", verified: "Verified minds", money: "Spending" } as const;
type Filter = keyof typeof FILTERS;

export function LogScreen() {
  const params = useSearchParams();
  const { data: home, error: homeError } = usePoll<HomeDto>("/api/home", 30_000);
  const slimeId = params.get("slime") ?? home?.slimes[0]?.id ?? null;
  const slime = home?.slimes.find((s) => s.id === slimeId) ?? null;
  const [rows, setRows] = useState<DecisionDto[] | null>(null);
  const [more, setMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(
    async (before?: number) => {
      if (!slimeId) return;
      const res = await fetch(`/api/log?slimeId=${slimeId}${before ? `&before=${before}` : ""}`, { cache: "no-store" });
      const json = (await res.json()) as { decisions?: DecisionDto[]; error?: string };
      if (!res.ok || !json.decisions) return setError(json.error ?? "Could not load the log.");
      setError(null);
      setMore(json.decisions.length === 40);
      setRows((r) => (before ? [...(r ?? []), ...json.decisions!] : json.decisions!));
    },
    [slimeId],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 8000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [load]);

  if (homeError === "Please sign in.") return <Empty title="Sign in to see your slime's log">Every decision your slime makes shows up here, with its reason.</Empty>;
  if (!home) return <Loading label="Opening the log…" />;
  if (!home.slimes.length) return <Empty title="No slime yet"><Link className="text-accent underline" href="/">Hatch one</Link> and its decisions will show up here.</Empty>;
  const shown = (rows ?? []).filter((d) => (filter === "verified" ? d.source === "near-ai" : filter === "money" ? BigInt(d.cost) !== 0n : true));
  const verified = (rows ?? []).filter((d) => d.verified).length;
  const thoughts = (rows ?? []).filter((d) => d.source === "near-ai").length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{slime?.name ?? "Your slime"}&apos;s log</h1>
        <p className="text-ink-soft">Every decision, with its reason and cost. Minds run on NEAR AI Cloud; each answer is signed in secure hardware and checked.</p>
      </div>
      {home.slimes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {home.slimes.map((s) => (
            <Link key={s.id} href={`/log?slime=${s.id}`} className={`rounded-full border border-line px-4 py-1.5 ${s.id === slimeId ? "bg-ink text-bg" : ""}`}>
              {s.name}
            </Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Card className="p-3">
          <p className="text-2xl font-semibold">{rows?.length ?? "–"}</p>
          <p className="text-xs text-ink-soft">decisions shown</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-semibold">{thoughts}</p>
          <p className="text-xs text-ink-soft">AI thoughts</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-semibold text-accent">{thoughts ? Math.round((verified / thoughts) * 100) : 0}%</p>
          <p className="text-xs text-ink-soft">verified</p>
        </Card>
      </div>
      <div className="flex gap-2" role="tablist" aria-label="Filter">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className="rounded-full border border-line px-4 py-1.5 text-sm aria-selected:bg-ink aria-selected:text-bg">
            {FILTERS[f]}
          </button>
        ))}
      </div>
      {error && <ErrorNote message={error} onRetry={() => load()} />}
      <Card>
        {rows === null ? (
          <Loading label="Reading the log…" />
        ) : shown.length ? (
          <ul className="divide-y divide-line">
            {shown.map((d) => (
              <DecisionItem key={d.id} d={d} />
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-ink-soft">Nothing here yet. Slimes think about once a game hour.</p>
        )}
        {rows && more && (
          <button type="button" onClick={() => load(rows.at(-1)?.id)} className="mt-2 w-full rounded-2xl bg-bg-soft py-2 font-medium">
            Load older
          </button>
        )}
      </Card>
      {slime?.chain?.status === "ready" && (
        <p className="text-center text-sm text-ink-soft">
          Money moves are settled on the town contract from{" "}
          <a className="text-accent underline" href={explorer("address", slime.chain.accountId)} target="_blank" rel="noreferrer">
            {slime.name}&apos;s own account
          </a>
          .
        </p>
      )}
    </div>
  );
}
