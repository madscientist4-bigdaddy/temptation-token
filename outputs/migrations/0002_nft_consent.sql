-- 0002_nft_consent.sql
-- Per-submission opt-in for using the submitted photo in stylized commemorative NFTs.
-- Default FALSE; existing rows are NOT opted in. Photo-composite NFT mode stays disabled
-- (NFT_PHOTO_MODE) until legal approves the consent copy regardless of this flag.
-- Run in the Supabase SQL editor (or via scripts/migrate.mjs).

BEGIN;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS nft_consent boolean NOT NULL DEFAULT false;

COMMIT;

-- Verify:
-- SELECT count(*) FILTER (WHERE nft_consent) AS opted_in, count(*) AS total FROM public.submissions;
