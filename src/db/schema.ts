import { bigint, boolean, bigserial, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** A person who plays. Linked to their sign-in identity and their NEAR account. */
export const players = pgTable("players", {
  id: text("id").primaryKey(),
  authId: text("auth_id").notNull().unique(),
  email: text("email"),
  nearAccountId: text("near_account_id").unique(),
  /** The player account's private key, encrypted with KEYS_SECRET. Never sent to the browser. */
  nearKeyEnc: text("near_key_enc"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Fixed-window request counters for rate limiting action endpoints. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/** The whole town, saved after every tick. One row per world ("main"). */
export const worlds = pgTable("worlds", {
  id: text("id").primaryKey(),
  tick: integer("tick").notNull(),
  /** Serialized World (src/economy/serialize.ts keeps bigints exact). */
  state: jsonb("state").notNull(),
  fastForwardUntil: integer("fast_forward_until"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every slime and shop decision, with its reason, cost and verification. */
export const decisions = pgTable(
  "decisions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    worldId: text("world_id").notNull(),
    tick: integer("tick").notNull(),
    actorId: text("actor_id").notNull(),
    actorKind: text("actor_kind").notNull(),
    action: text("action").notNull(),
    target: text("target"),
    reason: text("reason").notNull(),
    say: text("say"),
    /** Bits (1/100 coin). Negative when the actor was paid. */
    cost: bigint("cost", { mode: "bigint" }).notNull(),
    source: text("source").notNull(),
    verified: boolean("verified"),
    signature: text("signature"),
    /** Raw signed model answer and attestation details, when a mind was asked. */
    proof: jsonb("proof"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("decisions_actor_idx").on(t.worldId, t.actorId, t.tick)],
);

/** Town news: shops closing and reopening, seasons, contests, slimes asleep. */
export const gameEvents = pgTable(
  "game_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    worldId: text("world_id").notNull(),
    tick: integer("tick").notNull(),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    shopId: text("shop_id"),
    slimeId: text("slime_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("game_events_tick_idx").on(t.worldId, t.tick)],
);

/** Daily price per item per shop, for charts. */
export const prices = pgTable(
  "prices",
  {
    worldId: text("world_id").notNull(),
    shopId: text("shop_id").notNull(),
    itemId: text("item_id").notNull(),
    day: integer("day").notNull(),
    price: bigint("price", { mode: "bigint" }).notNull(),
    reason: text("reason").notNull(),
  },
  (t) => [primaryKey({ columns: [t.worldId, t.shopId, t.itemId, t.day] })],
);
