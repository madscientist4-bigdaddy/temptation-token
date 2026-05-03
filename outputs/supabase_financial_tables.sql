-- Run this in the Supabase SQL editor for the Financial KPI tab
-- Project: gmlikdxykgviyprqtqwz

-- ── PROJECT EXPENSES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL,
  vendor       text NOT NULL,
  category     text NOT NULL,
  amount_usd   numeric NOT NULL,
  notes        text,
  receipt_url  text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_expenses" ON project_expenses FOR ALL USING (true) WITH CHECK (true);

-- ── PROJECT INCOME (manual off-chain entries) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS project_income (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  income_date date,
  source      text NOT NULL,
  amount_usd  numeric NOT NULL,
  notes       text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE project_income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_income" ON project_income FOR ALL USING (true) WITH CHECK (true);
