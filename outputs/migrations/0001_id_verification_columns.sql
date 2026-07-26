-- 0001_id_verification_columns.sql
-- Promote the in-dashboard ID-verification storage paths from the reference_id
-- JSON blob (commit 468ac41, provider='id_upload' rows) to dedicated columns on
-- verified_submitters. Idempotent + backward-safe: run in the Supabase SQL editor
-- (Dashboard → SQL) or via psql with the pooler connection string.
--
-- reference_id JSON shape written by api/profiles.js:
--   {"i": <idDocPath>, "s": <selfiePath>, "sub": <submissionId>}
--
-- Leak-safety NOTE: these three columns are PRIVATE. They must NEVER be added to
-- any public SELECT (public-profiles / SAFE_SELECT / kyc status). Public endpoints
-- use explicit column allowlists, so adding columns does not expose them — but the
-- app code that reads them (admin.js / kyc.js / profiles.js) must select them
-- explicitly and only on server, token-gated paths.

BEGIN;

ALTER TABLE public.verified_submitters
  ADD COLUMN IF NOT EXISTS id_doc_path   text,
  ADD COLUMN IF NOT EXISTS selfie_path   text,
  ADD COLUMN IF NOT EXISTS submission_id text;

-- Backfill existing id_upload rows from the reference_id JSON. Only touch rows
-- whose reference_id is a JSON object (id_upload), never Persona inquiry-id rows.
UPDATE public.verified_submitters
   SET id_doc_path   = (reference_id::jsonb ->> 'i'),
       selfie_path   = (reference_id::jsonb ->> 's'),
       submission_id = (reference_id::jsonb ->> 'sub')
 WHERE provider = 'id_upload'
   AND reference_id IS NOT NULL
   AND left(btrim(reference_id), 1) = '{'
   AND id_doc_path IS NULL;

COMMIT;

-- Verify (should list the migrated id_upload rows with populated columns):
-- SELECT wallet_address, provider, status, id_doc_path, selfie_path, submission_id
--   FROM public.verified_submitters WHERE provider = 'id_upload' ORDER BY created_at DESC LIMIT 20;
