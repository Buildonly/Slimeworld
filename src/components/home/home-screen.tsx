"use client";

import type { HomeDto } from "@/lib/dto";
import { usePoll } from "@/lib/use-poll";
import { ErrorNote, Loading } from "@/components/ui/states";
import { HatchFlow } from "./hatch-flow";
import { SlimeHome } from "./slime-home";

export function HomeScreen() {
  const { data, error, loading, refresh } = usePoll<HomeDto>("/api/home", 4000);
  if (loading && !data) return <Loading label="Finding your slime…" />;
  if (error && !data) return <ErrorNote message={error} onRetry={refresh} />;
  if (!data) return null;
  if (!data.slimes.length) return <HatchFlow onHatched={refresh} />;
  return <SlimeHome home={data} refresh={refresh} />;
}
