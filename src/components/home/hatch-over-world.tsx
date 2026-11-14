"use client";

import { LoadingScreen } from "@/game/hud/loading-screen";
import { WorldView } from "@/game/world-view";
import type { TownDto } from "@/lib/dto";
import { usePoll } from "@/lib/use-poll";
import { HatchFlow } from "./hatch-flow";

/** Your egg, with the town waiting behind it. */
export function HatchOverWorld({ onHatched }: { onHatched: () => void }) {
  const { data: town } = usePoll<TownDto>("/api/town", 10_000);
  if (!town) return <LoadingScreen done={false} />;
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-sky">
      <div className="absolute inset-0 opacity-90">
        <WorldView town={town} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
        <div className="w-full max-w-md rounded-[28px] bg-card/95 p-4 shadow-2xl backdrop-blur">
          <HatchFlow onHatched={onHatched} />
        </div>
      </div>
    </div>
  );
}
