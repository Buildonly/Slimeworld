CREATE TABLE "cheat_proofs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"attempt" text NOT NULL,
	"title" text NOT NULL,
	"story" text NOT NULL,
	"error" text NOT NULL,
	"tx_hash" text NOT NULL,
	"network" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cheat_proofs_attempt_unique" UNIQUE("attempt")
);
