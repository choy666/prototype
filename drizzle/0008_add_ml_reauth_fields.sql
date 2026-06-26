ALTER TABLE "users"
ADD COLUMN "ml_needs_reauth" boolean DEFAULT false NOT NULL;

ALTER TABLE "users"
ADD COLUMN "ml_reauth_reason" text;
