import { BPS, SEASON_CYCLE, SEASON_DAYS, SEASONS, TICKS_PER_DAY, type Season, type SeasonId } from "./config";

/** The season for a given tick: weekly, cycling through SEASON_CYCLE. */
export function seasonAt(tick: number): SeasonId {
  const week = Math.floor(tick / (TICKS_PER_DAY * SEASON_DAYS));
  return SEASON_CYCLE[week % SEASON_CYCLE.length] ?? "calm";
}

export function season(id: SeasonId): Season {
  return SEASONS[id];
}

export function seasonPriceBps(id: SeasonId, itemId: string): number {
  return SEASONS[id].priceBps[itemId] ?? BPS;
}

export function seasonDemandBps(id: SeasonId, itemId: string): number {
  return SEASONS[id].demandBps[itemId] ?? BPS;
}
