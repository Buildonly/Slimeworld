import { bigint, boolean, bigserial, customType, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

/** A person who plays. Linked to their sign-in identity and their NEAR account. */
export const players = pgTable("players", {
  id: text("id").primaryKey(),
  authId: text("auth_id").notNull().unique(),
  email: text("email"),
  nearAccountId: text("near_account_id").unique(),
  /** The player account's private key, encrypted with KEYS_SECRET. Never sent to the browser. */
  nearKeyEnc: text("near_key_enc"),
  /** Function call key limited to the town contract; signs the player's gasless meta transactions. */
  nearFcKeyEnc: text("near_fc_key_enc"),
  /** Starter coins deposited and town key added on chain. */
  chainReady: boolean("chain_ready").notNull().default(false),
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

/** Each real player's slime on chain: its own NEAR account and its NFT. */
export const slimeAccounts = pgTable("slime_accounts", {
  slimeId: text("slime_id").notNull(),
  worldId: text("world_id").notNull(),
  playerId: text("player_id").notNull(),
  accountId: text("account_id").notNull().unique(),
  keyEnc: text("key_enc").notNull(),
  nftTokenId: text("nft_token_id").notNull().unique(),
  /** pending -> ready (account, NFT, rules and starter coins on chain) or failed. */
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.worldId, t.slimeId] })]);

/** Outbox of chain writes, processed in order by the chain worker. */
export const chainOps = pgTable(
  "chain_ops",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    worldId: text("world_id").notNull(),
    tick: integer("tick").notNull(),
    /** settle (operator batch), meta (player-signed, relayed), operator (game call), hatch, player_setup */
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    /** pending, done, rejected (the contract said no), failed (could not send) */
    status: text("status").notNull().default("pending"),
    txHash: text("tx_hash"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chain_ops_status_idx").on(t.status, t.id)],
);

/** Spoken lines, cached by voice and text so a line is only paid for once. */
export const voiceLines = pgTable("voice_lines", {
  hash: text("hash").primaryKey(),
  voiceId: text("voice_id").notNull(),
  text: text("text").notNull(),
  audio: bytea("audio").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Top ups from any chain through NEAR Intents 1Click. */
export const topups = pgTable(
  "topups",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    playerId: text("player_id").notNull(),
    coinId: text("coin_id").notNull(),
    /** What the player sends, in the coin's base units. */
    amountIn: text("amount_in").notNull(),
    depositAddress: text("deposit_address").notNull().unique(),
    depositMemo: text("deposit_memo"),
    /** The full signed quote from 1Click, kept to settle any dispute. */
    quote: jsonb("quote").notNull(),
    /** 1Click status: PENDING_DEPOSIT, PROCESSING, SUCCESS, REFUNDED, FAILED... */
    status: text("status").notNull().default("PENDING_DEPOSIT"),
    /** Bits credited to the player once the NEAR arrived and went into the town. */
    creditedBits: bigint("credited_bits", { mode: "bigint" }),
    creditTx: text("credit_tx"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("topups_player_idx").on(t.playerId, t.id)],
);

/** Real attempts to cheat the town contract on chain, and the rule that refused each one. */
export const cheatProofs = pgTable("cheat_proofs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  /** Short id of the attempt, e.g. "banned-item"; the newest run replaces older ones. */
  attempt: text("attempt").notNull().unique(),
  title: text("title").notNull(),
  story: text("story").notNull(),
  /** The contract's own refusal, as the chain reported it. */
  error: text("error").notNull(),
  txHash: text("tx_hash").notNull(),
  network: text("network").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
