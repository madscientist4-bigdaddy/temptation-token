-- Age verification table — one record per wallet address
-- Run in Supabase SQL editor (gmlikdxykgviyprqtqwz)

create table if not exists public.wallet_verifications (
  id              uuid        primary key default gen_random_uuid(),
  wallet_address  text        not null unique,
  status          text        not null default 'pending'
                              check (status in ('pending', 'approved', 'rejected')),
  is_verified     boolean     not null default false,
  full_name       text,
  date_of_birth   date,
  id_doc_path     text,       -- path in wallet-verifications storage bucket
  signature_img   text,       -- base64 PNG of handwritten signature from modal
  notes           text,
  submitted_at    timestamptz not null default now(),
  verified_at     timestamptz,
  reviewed_by     text
);

-- RLS: allow all via anon key (consistent with existing table pattern in this project)
alter table public.wallet_verifications enable row level security;

create policy "wallet_verifications_all" on public.wallet_verifications
  for all using (true) with check (true);

-- Storage bucket: create manually in Supabase Dashboard → Storage → New bucket
-- Name: wallet-verifications   Public: false (private)

-- Retroactive record: Donielle Banks — verified offline May 10 2026
-- Find her wallet: select wallet_address from submissions where display_name ilike '%donielle%' limit 1;
-- Then replace '0xREPLACE_WITH_DONIELLE_WALLET' below and run:
insert into public.wallet_verifications
  (wallet_address, status, is_verified, full_name, notes, verified_at, submitted_at)
values
  ('0xREPLACE_WITH_DONIELLE_WALLET', 'approved', true, 'Donielle Banks',
   'Verified offline May 10 2026 — retroactive record', '2026-05-10T00:00:00Z', '2026-05-10T00:00:00Z')
on conflict (wallet_address) do nothing;
