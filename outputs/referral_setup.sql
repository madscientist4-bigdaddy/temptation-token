-- Referral system schema (idempotent). Run in Supabase SQL editor.
-- Defaults are SAFE-OFF: referral_enabled=false (kill switch on) until go-live.
-- RLS: leave enabled + deny-by-default for anon — all access is via the service
-- key through /api/bonus and /api/admin-data.

-- ── referrals: one row per referee (referrer + referee are WALLET addresses) ──
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_wallet TEXT NOT NULL,
  referee_wallet  TEXT NOT NULL,
  source          TEXT DEFAULT 'web',          -- web | bot
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','qualified','paid','rejected')),
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  qualified_at    TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ
);
-- columns may pre-exist from an older schema — add the ones the endpoint needs
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_wallet TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referee_wallet  TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS source          TEXT DEFAULT 'web';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'pending';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reject_reason   TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS qualified_at    TIMESTAMPTZ;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS paid_at         TIMESTAMPTZ;
-- a referee can only be referred ONCE (root anti-double-capture/payout guarantee)
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referee_unique ON referrals(referee_wallet);

-- ── referral_credits: payout ledger; UNIQUE on referee enforces single payout ──
CREATE TABLE IF NOT EXISTS referral_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referee_wallet  TEXT NOT NULL,
  referrer_wallet TEXT NOT NULL,
  amount_tts      NUMERIC NOT NULL,
  qualifying_tx   TEXT,
  tx_hash         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE referral_credits ADD COLUMN IF NOT EXISTS referee_wallet  TEXT;
ALTER TABLE referral_credits ADD COLUMN IF NOT EXISTS referrer_wallet TEXT;
ALTER TABLE referral_credits ADD COLUMN IF NOT EXISTS amount_tts      NUMERIC;
ALTER TABLE referral_credits ADD COLUMN IF NOT EXISTS qualifying_tx   TEXT;
-- HARD double-payout guard: one payout per referee, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS referral_credits_referee_unique ON referral_credits(referee_wallet);

-- ── referral_settings: single config row (id=1). DEFAULTS OFF + conservative ──
CREATE TABLE IF NOT EXISTS referral_settings (
  id INT PRIMARY KEY DEFAULT 1,
  referral_enabled        BOOLEAN NOT NULL DEFAULT false,   -- KILL SWITCH (off until go-live)
  referrer_bonus_tts      NUMERIC NOT NULL DEFAULT 100,
  min_qualifying_vote_tts NUMERIC NOT NULL DEFAULT 500,
  per_referrer_daily_cap  INT     NOT NULL DEFAULT 10,
  program_daily_cap_tts   NUMERIC NOT NULL DEFAULT 10000,
  reserve_floor_tts       NUMERIC NOT NULL DEFAULT 0,
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS referral_enabled        BOOLEAN DEFAULT false;
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS referrer_bonus_tts      NUMERIC DEFAULT 100;
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS min_qualifying_vote_tts NUMERIC DEFAULT 500;
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS per_referrer_daily_cap  INT     DEFAULT 10;
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS program_daily_cap_tts   NUMERIC DEFAULT 10000;
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS reserve_floor_tts       NUMERIC DEFAULT 0;
INSERT INTO referral_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── auto-funder settings (top up the referral wallet from MARKETING, never Bank) ──
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS auto_fund_enabled          BOOLEAN DEFAULT false;  -- KILL SWITCH (off)
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS max_daily_topup_tts        NUMERIC DEFAULT 25000;  -- hard ceiling per top-up
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS max_wallet_balance_tts     NUMERIC DEFAULT 50000;  -- referral-wallet ceiling
ALTER TABLE referral_settings ADD COLUMN IF NOT EXISTS marketing_reserve_floor_tts NUMERIC DEFAULT 100000;-- Marketing solvency floor
