/** Make a new town: starting shops, town slimes, and (for the sim) owners. */
import {
  CARING_OWNER_SAVINGS_TARGET,
  DEFAULT_RULES,
  ITEM_BY_ID,
  SHOP_SIZE_FOR_SLIMES,
  SLIME_NAMES,
  STARTER_WALLET,
  STARTING_SHOPS,
  TICKS_PER_DAY,
  coins,
  type SlimePersonality,
} from "./config";
import { nextWorldId } from "./ids";
import { refreshPrices } from "./market";
import { nextFloat, pick, pickWeighted, type Rng } from "./rng";
import type { CareStyle, Player, Shop, Slime, SlimeColour, World } from "./types";

const PERSONALITIES: SlimePersonality[] = ["thrifty", "greedy", "lazy", "brave", "social"];
const COLOURS: SlimeColour[] = ["green", "blue", "pink", "gold", "crystal", "shadow"];
/** Rarer colours hatch less often (green common, shadow rare). */
const COLOUR_WEIGHTS = [40, 25, 18, 10, 5, 2];

export function emptyWorld(seed: number): World {
  return {
    tick: 0,
    rng: { state: seed | 0 },
    season: "calm",
    slimes: {},
    shops: {},
    players: {},
    jobs: [],
    contests: [],
    treasury: 0n,
    flows: { visitors: 0n, guardPay: 0n, topUps: 0n, wholesale: 0n, rent: 0n, thinking: 0n, prizes: 0n },
    history: [],
    events: [],
    nextId: 0,
    journal: [],
  };
}

export function makeShop(seed: (typeof STARTING_SHOPS)[number], scale = 1): Shop {
  const targets = Object.fromEntries(Object.entries(seed.stockTargets).map(([k, v]) => [k, Math.max(2, Math.round(v * scale))]));
  const salesWindow: Record<string, number[]> = {};
  const avgSales: Record<string, number> = {};
  for (const item of Object.keys(targets)) {
    salesWindow[item] = Array.from({ length: TICKS_PER_DAY }, () => 0);
    avgSales[item] = Math.max(1, Math.round((targets[item] ?? 0) / 3));
  }
  return {
    id: seed.id,
    name: seed.name,
    keeper: seed.keeper,
    personality: seed.personality,
    size: scale,
    wallet: (seed.wallet * BigInt(Math.round(scale * 100))) / 100n,
    stock: { ...targets },
    targets,
    buys: [...seed.buys],
    salesWindow,
    avgSales,
    prices: {},
    margin: "normal",
    hoard: null,
    hires: 0,
    open: true,
    troubleTicks: 0,
    closedAtTick: null,
    investors: {},
    incomeToday: 0n,
    costsToday: 0n,
  };
}

export function hatchSlime(world: World, opts: { name?: string; ownerId: string | null; colour?: SlimeColour; personality?: SlimePersonality; rng?: Rng }): Slime {
  const rng = opts.rng ?? world.rng;
  const colour = opts.colour ?? COLOURS[Math.max(0, pickWeighted(rng, COLOUR_WEIGHTS))] ?? "green";
  const skill = () => 10 + Math.floor(nextFloat(rng) * 25);
  const slime: Slime = {
    id: nextWorldId(world, "s"),
    name: opts.name ?? pick(rng, SLIME_NAMES) ?? "Blub",
    ownerId: opts.ownerId,
    colour,
    personality: opts.personality ?? pick(rng, PERSONALITIES) ?? "thrifty",
    skills: { speed: skill(), smarts: skill(), charm: skill() },
    size: 0.85,
    bornTick: world.tick,
    energy: 80,
    joy: 70,
    wallet: STARTER_WALLET,
    items: {},
    rules: { ...DEFAULT_RULES, allowed: [...DEFAULT_RULES.allowed], allowedJobs: [...DEFAULT_RULES.allowedJobs] },
    spentToday: 0n,
    earnedToday: 0n,
    earnedYesterday: 0n,
    job: null,
    asleep: false,
    lastThinkTick: -100,
    lastCareTick: world.tick,
    memory: ["I hatched!"],
    friends: [],
  };
  world.slimes[slime.id] = slime;
  return slime;
}

const PLAYER_NAMES = ["Ada", "Ben", "Cleo", "Dev", "Eli", "Fay", "Gus", "Hana", "Ivo", "Juno", "Kai", "Lia", "Milo", "Nia", "Oto", "Pia"];

/**
 * A town for the simulator or fast forward: the starting shops and `slimes`
 * slimes. Most belong to simulated owners with mixed care; some are town slimes.
 */
export function createTown(seed: number, slimes: number): World {
  const world = emptyWorld(seed);
  const scale = Math.max(0.5, slimes / SHOP_SIZE_FOR_SLIMES);
  for (const s of STARTING_SHOPS) world.shops[s.id] = makeShop(s, scale);
  for (const shop of Object.values(world.shops)) refreshPrices(world, shop);
  // Per five slimes: two devoted owners, one casual, one absent, one town slime.
  const cares: (CareStyle | null)[] = ["devoted", "devoted", "casual", "absent", null];
  for (let i = 0; i < slimes; i++) {
    let ownerId: string | null = null;
    const care = cares[i % cares.length] ?? null;
    if (care) {
      const player: Player = { id: nextWorldId(world, "p"), name: `${pick(world.rng, PLAYER_NAMES)}`, wallet: coins(300), care };
      world.players[player.id] = player;
      ownerId = player.id;
    }
    const slime = hatchSlime(world, { ownerId });
    // Caring owners and the town itself keep a sensible savings floor.
    if (care !== "absent") slime.rules.savingsTarget = CARING_OWNER_SAVINGS_TARGET;
  }
  if (!ITEM_BY_ID.size) throw new Error("No items configured");
  return world;
}
