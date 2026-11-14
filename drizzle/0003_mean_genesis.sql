CREATE TABLE "chain_ops" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"tick" integer NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slime_accounts" (
	"slime_id" text NOT NULL,
	"world_id" text NOT NULL,
	"player_id" text NOT NULL,
	"account_id" text NOT NULL,
	"key_enc" text NOT NULL,
	"nft_token_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slime_accounts_world_id_slime_id_pk" PRIMARY KEY("world_id","slime_id"),
	CONSTRAINT "slime_accounts_account_id_unique" UNIQUE("account_id"),
	CONSTRAINT "slime_accounts_nft_token_id_unique" UNIQUE("nft_token_id")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "near_fc_key_enc" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "chain_ready" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "chain_ops_status_idx" ON "chain_ops" USING btree ("status","id");