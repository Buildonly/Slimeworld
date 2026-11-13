"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { TownDto } from "@/lib/dto";
import { GameBus } from "./bus";
import { townLayout } from "./layout";

const GameScene = dynamic(() => import("./game-scene"), { ssr: false });

/** The town with no player in it: the camera drifts around. For visitors and spectators. */
export function WorldView({ town, highlight }: { town: TownDto; highlight?: string | null }) {
  const [bus] = useState(() => new GameBus());
  const shopIds = useMemo(() => town.shops.map((s) => s.id), [town.shops]);
  const layout = useMemo(() => townLayout(shopIds), [shopIds]);
  const beam = highlight ? (layout.spots.find((s) => s.id === highlight)?.pos ?? null) : null;
  return <GameScene bus={bus} shops={town.shops} slimes={town.slimes.slice(0, 30)} me={null} layout={layout} hour={town.clock.hour} beam={beam} />;
}
