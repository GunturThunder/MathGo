CREATE TABLE "consent_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_hash" text NOT NULL,
	"channel" "consent_channel" NOT NULL,
	"birth_year" smallint NOT NULL,
	"code_hash" text NOT NULL,
	"wrong_attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"locked_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_codes_birth_year_range" CHECK ("consent_codes"."birth_year" between 1900 and 2100),
	CONSTRAINT "consent_codes_wrong_attempts_range" CHECK ("consent_codes"."wrong_attempts" between 0 and 6)
);
--> statement-breakpoint
CREATE INDEX "consent_codes_phone_hash_created_at_idx" ON "consent_codes" USING btree ("phone_hash","created_at");