CREATE TABLE "clans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clans_name_unique" UNIQUE("name"),
	CONSTRAINT "clans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "invited_by" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "invite_rewarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "clan_id" text;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_invite_code_unique" UNIQUE("invite_code");