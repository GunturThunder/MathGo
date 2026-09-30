CREATE TYPE "public"."consent_channel" AS ENUM('whatsapp', 'sms');--> statement-breakpoint
CREATE TYPE "public"."match_end_reason" AS ENUM('ko', 'time', 'forfeit');--> statement-breakpoint
CREATE TYPE "public"."match_mode" AS ENUM('ranked', 'invite');--> statement-breakpoint
CREATE TYPE "public"."match_outcome" AS ENUM('win', 'draw');--> statement-breakpoint
CREATE TYPE "public"."trophy_reason" AS ENUM('match', 'reversal');--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"user_id" uuid,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_answers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_answers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"match_id" uuid NOT NULL,
	"seat" smallint NOT NULL,
	"user_id" uuid,
	"question_index" integer NOT NULL,
	"value" integer NOT NULL,
	"correct" boolean NOT NULL,
	"latency_ms" integer NOT NULL,
	"at_ms" integer NOT NULL,
	"too_fast" boolean DEFAULT false NOT NULL,
	CONSTRAINT "match_answers_seat" CHECK ("match_answers"."seat" in (0, 1)),
	CONSTRAINT "match_answers_latency_non_negative" CHECK ("match_answers"."latency_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" "match_mode" NOT NULL,
	"arena" smallint NOT NULL,
	"level_trophies" integer NOT NULL,
	"seed" bigint NOT NULL,
	"seat0_user_id" uuid,
	"seat1_user_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"outcome" "match_outcome" NOT NULL,
	"winner_seat" smallint,
	"end_reason" "match_end_reason" NOT NULL,
	"seat0_hp" smallint NOT NULL,
	"seat1_hp" smallint NOT NULL,
	CONSTRAINT "matches_arena_range" CHECK ("matches"."arena" between 1 and 5),
	CONSTRAINT "matches_seed_uint32" CHECK ("matches"."seed" between 0 and 4294967295),
	CONSTRAINT "matches_winner_matches_outcome" CHECK (("matches"."outcome" = 'draw' and "matches"."winner_seat" is null) or ("matches"."outcome" = 'win' and "matches"."winner_seat" in (0, 1))),
	CONSTRAINT "matches_draw_only_at_time" CHECK ("matches"."outcome" = 'win' or "matches"."end_reason" = 'time')
);
--> statement-breakpoint
CREATE TABLE "parental_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone_hash" text NOT NULL,
	"channel" "consent_channel" NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "parental_consents_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "trophy_ledger" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trophy_ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"match_id" uuid,
	"delta" integer NOT NULL,
	"trophies_after" integer NOT NULL,
	"reason" "trophy_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trophy_ledger_trophies_after_non_negative" CHECK ("trophy_ledger"."trophies_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nickname" text NOT NULL,
	"birth_year" smallint NOT NULL,
	"trophies" integer DEFAULT 0 NOT NULL,
	"google_sub" text,
	"apple_sub" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub"),
	CONSTRAINT "users_apple_sub_unique" UNIQUE("apple_sub"),
	CONSTRAINT "users_trophies_non_negative" CHECK ("users"."trophies" >= 0),
	CONSTRAINT "users_birth_year_range" CHECK ("users"."birth_year" between 1900 and 2100)
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_answers" ADD CONSTRAINT "match_answers_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_answers" ADD CONSTRAINT "match_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_seat0_user_id_users_id_fk" FOREIGN KEY ("seat0_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_seat1_user_id_users_id_fk" FOREIGN KEY ("seat1_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parental_consents" ADD CONSTRAINT "parental_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trophy_ledger" ADD CONSTRAINT "trophy_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trophy_ledger" ADD CONSTRAINT "trophy_ledger_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_name_created_at_idx" ON "events" USING btree ("name","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "match_answers_match_seat_question_idx" ON "match_answers" USING btree ("match_id","seat","question_index");--> statement-breakpoint
CREATE INDEX "match_answers_user_too_fast_idx" ON "match_answers" USING btree ("user_id","too_fast");--> statement-breakpoint
CREATE INDEX "matches_seat0_user_id_idx" ON "matches" USING btree ("seat0_user_id");--> statement-breakpoint
CREATE INDEX "matches_seat1_user_id_idx" ON "matches" USING btree ("seat1_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trophy_ledger_one_settlement_idx" ON "trophy_ledger" USING btree ("user_id","match_id") WHERE "trophy_ledger"."reason" = 'match';--> statement-breakpoint
CREATE INDEX "trophy_ledger_user_id_idx" ON "trophy_ledger" USING btree ("user_id");