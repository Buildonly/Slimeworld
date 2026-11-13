import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

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
