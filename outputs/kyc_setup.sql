-- KYC + Age Verification tables
-- Run in Supabase SQL Editor before deploying kyc-session / kyc-webhook / age-acknowledge API routes.

-- Primary KYC table: one row per wallet, status reflects latest Persona inquiry
CREATE TABLE IF NOT EXISTS verified_submitters (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address   TEXT        NOT NULL,
  verified_at      TIMESTAMPTZ,
  provider         TEXT        NOT NULL DEFAULT 'persona',
  reference_id     TEXT,                    -- Persona inquiry_id (inq_...)
  status           TEXT        NOT NULL DEFAULT 'pending', -- pending | approved | declined | needs_review
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet_address)
);

-- Linked wallets: same KYC record covers additional wallets (admin-added)
CREATE TABLE IF NOT EXISTS verified_wallet_links (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_wallet  TEXT        NOT NULL,    -- must exist in verified_submitters with status=approved
  linked_wallet   TEXT        NOT NULL,
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by       TEXT        NOT NULL DEFAULT 'admin',
  UNIQUE (linked_wallet)
);

-- Voter 18+ acknowledgment (one row per wallet, first connect)
CREATE TABLE IF NOT EXISTS age_acknowledgments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address   TEXT        NOT NULL UNIQUE,
  acknowledged_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address       TEXT,
  agreement_version TEXT       NOT NULL DEFAULT 'v1.0'
);

-- RLS: allow anon reads (status check from frontend) + service-key writes
ALTER TABLE verified_submitters   ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_wallet_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_acknowledgments   ENABLE ROW LEVEL SECURITY;

-- Allow frontend to read own row (wallet_address lookup is sufficient filtering)
CREATE POLICY "anon_read_verified_submitters"   ON verified_submitters   FOR SELECT USING (true);
CREATE POLICY "anon_read_verified_wallet_links" ON verified_wallet_links FOR SELECT USING (true);
CREATE POLICY "anon_read_age_acknowledgments"   ON age_acknowledgments   FOR SELECT USING (true);

-- Only service role can write (all writes go through API routes with SUPABASE_SERVICE_KEY)
CREATE POLICY "service_write_verified_submitters"   ON verified_submitters   FOR ALL  USING (auth.role() = 'service_role');
CREATE POLICY "service_write_verified_wallet_links" ON verified_wallet_links FOR ALL  USING (auth.role() = 'service_role');
CREATE POLICY "service_write_age_acknowledgments"   ON age_acknowledgments   FOR ALL  USING (auth.role() = 'service_role');

-- Indexes for the hot query paths
CREATE INDEX IF NOT EXISTS idx_vs_wallet   ON verified_submitters   (wallet_address, status);
CREATE INDEX IF NOT EXISTS idx_vwl_linked  ON verified_wallet_links (linked_wallet);
CREATE INDEX IF NOT EXISTS idx_aa_wallet   ON age_acknowledgments   (wallet_address);
