CREATE TABLE "decisions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"tick" integer NOT NULL,
	"actor_id" text NOT NULL,
	"actor_kind" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"reason" text NOT NULL,
	"say" text,
	"cost" bigint NOT NULL,
	"source" text NOT NULL,
	"verified" boolean,
	"signature" text,
	"proof" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"tick" integer NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"shop_id" text,
	"slime_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"world_id" text NOT NULL,
	"shop_id" text NOT NULL,
	"item_id" text NOT NULL,
	"day" integer NOT NULL,
	"price" bigint NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "prices_world_id_shop_id_item_id_day_pk" PRIMARY KEY("world_id","shop_id","item_id","day")
);
--> statement-breakpoint
CREATE TABLE "worlds" (
	"id" text PRIMARY KEY NOT NULL,
	"tick" integer NOT NULL,
	"state" jsonb NOT NULL,
	"fast_forward_until" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "decisions_actor_idx" ON "decisions" USING btree ("world_id","actor_id","tick");--> statement-breakpoint
CREATE INDEX "game_events_tick_idx" ON "game_events" USING btree ("world_id","tick");