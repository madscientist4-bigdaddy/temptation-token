-- Run this once in the Supabase SQL editor to create the admin_config and admin_audit_log tables.
-- Project: gmlikdxykgviyprqtqwz

-- Key-value store for admin-configurable platform parameters
CREATE TABLE IF NOT EXISTS admin_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed canonical defaults (won't overwrite existing rows)
INSERT INTO admin_config (key, value) VALUES
  ('signup_bonus_tts',            '500'),
  ('vote_match_cap_tts',          '1000'),
  ('vote_match_ratio_numerator',  '1'),
  ('vote_match_ratio_denominator','1')
ON CONFLICT (key) DO NOTHING;

-- Audit log for every config change made via admin dashboard
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  changed_by  TEXT DEFAULT 'admin',
  config_key  TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT
);

-- Enable Row Level Security (anon key can read admin_config for API use)
ALTER TABLE admin_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow anon read of admin_config (APIs read this without service key)
CREATE POLICY "anon_read_admin_config" ON admin_config
  FOR SELECT USING (true);

-- Allow anon insert/upsert on admin_config (dashboard uses anon key)
CREATE POLICY "anon_upsert_admin_config" ON admin_config
  FOR ALL USING (true) WITH CHECK (true);

-- Allow anon insert/read on audit log
CREATE POLICY "anon_rw_audit_log" ON admin_audit_log
  FOR ALL USING (true) WITH CHECK (true);
