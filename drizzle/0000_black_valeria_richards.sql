CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_id" text NOT NULL,
	"email" text,
	"near_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_auth_id_unique" UNIQUE("auth_id"),
	CONSTRAINT "players_near_account_id_unique" UNIQUE("near_account_id")
);
