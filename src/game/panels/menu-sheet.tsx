"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FastForward, LogOut, ShieldCheck } from "lucide-react";
import { DecisionItem } from "@/components/log/decision-item";
import { BuiltOnNear } from "@/components/brand/near-logo";
import { SignIn } from "@/components/sign-in";
import { MarketScreen } from "@/components/market/market-screen";
import { RulesForm } from "@/components/rules/rules-screen";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Loading } from "@/components/ui/states";
import { WorldPanels } from "@/components/world/world-panels";
import type { DecisionDto, SlimeDto, WorldDto } from "@/lib/dto";
import { explorer } from "@/lib/format";
import { usePoll } from "@/lib/use-poll";
import { GameSheet } from "./sheet";

const TABS = ["Journal", "Rules", "Market", "Town", "More"] as const;
type Tab = (typeof TABS)[number];

function Journal({ slime }: { slime: SlimeDto }) {
  const { data } = usePoll<{ decisions: DecisionDto[] }>(`/api/log?slimeId=${slime.id}`, 8000);
  if (!data) return <Loading label="Opening the journal…" />;
  return data.decisions.length ? (
    <ul className="divide-y divide-line">
      {data.decisions.map((d) => (
        <DecisionItem key={d.id} d={d} />
      ))}
    </ul>
  ) : (
    <p className="py-6 text-center text-ink-soft">{slime.name} hasn&apos;t decided anything yet.</p>
  );
}

function Town() {
  const { data } = usePoll<WorldDto>("/api/world", 10_000);
  return data ? <WorldPanels world={data} /> : <Loading label="Asking around town…" />;
}

export function MenuSheet({ slime, guest, onClose, onSaved }: { slime: SlimeDto; guest: boolean; onClose: () => void; onSaved: () => void }) {
  const [tab, setTab] = useState<Tab>("Journal");
  const router = useRouter();
  return (
    <GameSheet title={tab === "Journal" ? `${slime.name}'s journal` : tab} onClose={onClose} wide>
      <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="shrink-0 rounded-full px-4 py-1.5 aria-selected:bg-ink aria-selected:text-bg">
            {t}
          </button>
        ))}
      </div>
      {tab === "Journal" && (
        <>
          <p className="mb-2 text-sm text-ink-soft">Everything {slime.name} decided, and why. ✓ means its mind was checked as genuine.</p>
          <Journal slime={slime} />
        </>
      )}
      {tab === "Rules" && <RulesForm slime={slime} onSaved={onSaved} />}
      {tab === "Market" && <MarketScreen signedIn />}
      {tab === "Town" && <Town />}
      {tab === "More" && (
        <div className="flex flex-col gap-3">
          {guest && (
            <div className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-3">
              <p className="font-semibold">Keep {slime.name} forever</p>
              <p className="text-sm text-ink-soft">You&apos;re playing as a guest. Sign in to keep your slime and coins on any device.</p>
              <SignIn devLogin={false} guest={false} />
            </div>
          )}
          <div className="flex items-center justify-between rounded-2xl bg-bg-soft p-3">
            <span>Light or dark</span>
            <ThemeToggle />
          </div>
          <Link href="/fast" className="flex items-center gap-2 rounded-2xl bg-bg-soft p-3">
            <FastForward size={18} /> Watch the town a week ahead
          </Link>
          <Link href="/proof" className="flex items-center gap-2 rounded-2xl bg-bg-soft p-3">
            <ShieldCheck size={18} /> Fair play: see the town refuse cheats
          </Link>
          {slime.chain?.status === "ready" && (
            <a className="rounded-2xl bg-bg-soft p-3" href={explorer("address", slime.chain.accountId)} target="_blank" rel="noreferrer">
              🔗 See {slime.name}&apos;s own wallet on NEAR
            </a>
          )}
          <button
            type="button"
            className="flex items-center gap-2 rounded-2xl bg-bg-soft p-3 text-left"
            onClick={async () => {
              await fetch("/api/session", { method: "DELETE" });
              router.refresh();
            }}
          >
            <LogOut size={18} /> Sign out
          </button>
          <BuiltOnNear className="justify-center pt-2 text-sm text-ink-soft" />
        </div>
      )}
    </GameSheet>
  );
}
