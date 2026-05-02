-- Run in Supabase SQL Editor: supabase.com/dashboard/project/gmlikdxykgviyprqtqwz/sql
-- These tables are missing and must be created for full API functionality

-- referral_credits table (used by /api/referral-credit.js)
CREATE TABLE IF NOT EXISTS referral_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  new_user_wallet TEXT NOT NULL,
  referrer_wallet TEXT,
  referrer_code TEXT,
  tts_amount NUMERIC DEFAULT 0,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS referral_credits_new_user_wallet_idx ON referral_credits(new_user_wallet);

-- outreach_queue table (for future DM automation if needed)
CREATE TABLE IF NOT EXISTS outreach_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  target_handle TEXT NOT NULL,
  target_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','replied','converted','ignored')),
  message_sent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- referrals table (for tracking referral events)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_wallet TEXT NOT NULL,
  referred_wallet TEXT NOT NULL,
  referral_code TEXT,
  tts_credited NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_wallet_idx ON referrals(referred_wallet);

-- club_partners table (used by /api/set-club-wallet.js and Admin Referrals tab)
CREATE TABLE IF NOT EXISTS club_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_code TEXT NOT NULL UNIQUE,
  club_name TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS club_partners_code_idx ON club_partners(club_code);

-- submissions table: add referral_code column if not already present
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Verify bonus_claims exists and has correct schema
-- (should already exist from previous session)
-- If not, run:
CREATE TABLE IF NOT EXISTS bonus_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  bonus_type TEXT NOT NULL CHECK (bonus_type IN ('signup','vote_match')),
  tts_amount NUMERIC NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS bonus_claims_wallet_type_idx ON bonus_claims(wallet_address, bonus_type);
