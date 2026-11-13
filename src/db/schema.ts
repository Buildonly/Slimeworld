import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** A person who plays. Linked to their sign-in identity and their NEAR account. */
export const players = pgTable("players", {
  id: text("id").primaryKey(),
  authId: text("auth_id").notNull().unique(),
  email: text("email"),
  nearAccountId: text("near_account_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
