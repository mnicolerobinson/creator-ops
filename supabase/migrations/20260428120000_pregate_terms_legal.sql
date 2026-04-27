ALTER TABLE "pregate_submissions"
  ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamptz;

ALTER TABLE "pregate_submissions"
  ADD COLUMN IF NOT EXISTS "terms_version" text DEFAULT 'v1.0';
