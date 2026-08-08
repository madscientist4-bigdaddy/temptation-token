-- Self-serve club onboarding queue. Run once in the Supabase SQL editor
-- (project gmlikdxykgviyprqtqwz). Until this exists, /api/clubs/apply returns
-- "Applications are temporarily unavailable" — it fails CLOSED rather than
-- accepting applications it cannot store or rate-limit.

create table if not exists public.pending_clubs (
  id             bigserial primary key,
  club_code      text        not null unique,
  club_name      text        not null,
  city           text        not null,
  wallet_address text        not null,
  status         text        not null default 'pending'
                 check (status in ('pending','approved','denied')),
  applicant_ip   text,
  tx_hash        text,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz
);

create index if not exists pending_clubs_status_idx  on public.pending_clubs (status);
create index if not exists pending_clubs_wallet_idx  on public.pending_clubs (lower(wallet_address));
create index if not exists pending_clubs_created_idx on public.pending_clubs (created_at);

-- Server-only, like every other table holding applicant data. All reads and writes go
-- through the service-role key in api/set-club-wallet.js; the browser never touches it.
alter table public.pending_clubs enable row level security;
revoke all on public.pending_clubs from anon, authenticated;

-- Lets the admin dashboard read the queue through /api/admin-data.
-- (api/admin.js ALLOWED set already updated to include 'pending_clubs'.)
