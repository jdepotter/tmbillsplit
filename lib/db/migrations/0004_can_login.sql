ALTER TABLE "users" ADD COLUMN "can_login" boolean DEFAULT false NOT NULL;
-- Backfill: anyone who already has a password hash can log in
UPDATE "users" SET "can_login" = true WHERE "password_hash" IS NOT NULL;
