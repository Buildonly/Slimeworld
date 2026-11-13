"use client";

import Link from "next/link";
import { FastForward } from "lucide-react";
import { ErrorNote, Loading } from "@/components/ui/states";
import type { WorldDto } from "@/lib/dto";
import { usePoll } from "@/lib/use-poll";
import { WorldPanels } from "./world-panels";

export function WorldScreen() {
  const { data, error, loading, refresh } = usePoll<WorldDto>("/api/world", 8000);
  if (loading && !data) return <Loading label="Looking over the town…" />;
  if (error && !data) return <ErrorNote message={error} onRetry={refresh} />;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">The world, live</h1>
          <p className="text-ink-soft">
            Day {data.clock.day} · {data.clock.seasonTitle}. Nobody patches this economy by hand.
          </p>
        </div>
        <Link href="/fast" className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 font-semibold text-accent-ink shadow-[0_4px_0_color-mix(in_srgb,var(--accent)_60%,black)]">
          <FastForward size={18} /> Watch next week in a minute
        </Link>
      </div>
      <WorldPanels world={data} />
    </div>
  );
}
