CREATE TABLE "topups" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"coin_id" text NOT NULL,
	"amount_in" text NOT NULL,
	"deposit_address" text NOT NULL,
	"deposit_memo" text,
	"quote" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING_DEPOSIT' NOT NULL,
	"credited_bits" bigint,
	"credit_tx" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topups_deposit_address_unique" UNIQUE("deposit_address")
);
--> statement-breakpoint
CREATE INDEX "topups_player_idx" ON "topups" USING btree ("player_id","id");