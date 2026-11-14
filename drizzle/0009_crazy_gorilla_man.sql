CREATE TABLE "wallet_challenges" (
	"nonce" text PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "wallet_account_id" text;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_wallet_account_id_unique" UNIQUE("wallet_account_id");