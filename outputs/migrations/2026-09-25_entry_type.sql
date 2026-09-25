-- Part 3 — distinguish AI-generated placeholder profiles from real creators.
--
-- Additive and non-breaking by design:
--   * entry_type is NULLABLE. The 21 profiles already on the board are NOT auto-classified:
--     labelling a real person as AI-generated, or an AI image as a verified creator, is
--     worse than leaving it unknown. Classification is a human decision.
--   * The consent CHECK is written so a NULL entry_type passes (SQL CHECK passes on NULL),
--     so the existing POST /api/profiles?action=submit path keeps working unchanged.
--   * Declared NOT VALID so existing rows are never retroactively rejected; it is enforced
--     on every insert and update from now on.
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS entry_type text,
  ADD COLUMN IF NOT EXISTS consent_record_id uuid,
  ADD COLUMN IF NOT EXISTS ai_provenance jsonb;

DO $$ BEGIN
  ALTER TABLE submissions ADD CONSTRAINT submissions_entry_type_chk
    CHECK (entry_type IS NULL OR entry_type IN ('verified_creator','ai_model')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A verified_creator must point at a consent record. An ai_model must not (it depicts
-- nobody, so there is nobody to consent).
DO $$ BEGIN
  ALTER TABLE submissions ADD CONSTRAINT submissions_creator_needs_consent_chk
    CHECK (
      entry_type IS DISTINCT FROM 'verified_creator' OR consent_record_id IS NOT NULL
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS submissions_entry_type_idx ON submissions (entry_type)
  WHERE entry_type IS NOT NULL;

COMMENT ON COLUMN submissions.entry_type IS
  'verified_creator | ai_model | NULL (unclassified legacy). AI entries must carry an "AI Model" badge in every client and must never take a paid prize.';
COMMENT ON COLUMN submissions.ai_provenance IS
  'For ai_model rows: {provider, model, prompt_hash, seed, generated_at, approved_by, approved_at, nsfw_score, apparent_age}.';
