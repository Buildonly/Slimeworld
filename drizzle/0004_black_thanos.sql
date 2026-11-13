CREATE TABLE "voice_lines" (
	"hash" text PRIMARY KEY NOT NULL,
	"voice_id" text NOT NULL,
	"text" text NOT NULL,
	"audio" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
