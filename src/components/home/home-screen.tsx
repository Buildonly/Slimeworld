"use client";

import { GameScreen } from "@/game/game-screen";
import { LoadingScreen } from "@/game/hud/loading-screen";
import type { HomeDto } from "@/lib/dto";
import { usePoll } from "@/lib/use-poll";
import { ErrorNote } from "@/components/ui/states";
import { HatchOverWorld } from "./hatch-over-world";

export function HomeScreen() {
  const { data, error, refresh } = usePoll<HomeDto>("/api/home", 15_000);
  if (error && !data) return <ErrorNote message={error} onRetry={refresh} />;
  if (!data) return <LoadingScreen done={false} />;
  if (!data.slimes.length) return <HatchOverWorld onHatched={refresh} />;
  return <GameScreen />;
}
