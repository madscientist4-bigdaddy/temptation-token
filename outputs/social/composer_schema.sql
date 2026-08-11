-- Social AI Composer — schema + private media bucket.
-- Applied 2026-08-11 via the Supabase Management API.
--
-- Design notes:
--  • Media lives in a PRIVATE bucket. There is no public URL, ever. Server mints
--    short-lived signed URLs (upload: browser PUTs direct, bypassing Vercel's
--    4.5MB body cap; download: Telegram fetches the signed URL, X gets raw bytes).
--  • social_assets.source is the HARD GATE. 'admin_brand' may post; 'creator'
--    may NOT unless SOCIAL_CREATOR_MEDIA=true, enforced server-side in
--    api/social-post.js. Consent copy does not yet cover marketing use.
--  • Every post attempt — success or failure, now or scheduled — writes one
--    social_post_log row. Nothing posts without a log row.

-- ── Private media bucket ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-media', 'social-media', false, 67108864,
  array['image/png','image/jpeg','image/webp','image/gif',
        'video/mp4','video/quicktime']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Uploaded media ───────────────────────────────────────────────────────────
create table if not exists public.social_assets (
  id           uuid        primary key default gen_random_uuid(),
  storage_path text        not null unique,
  kind         text        not null check (kind in ('photo','video')),
  mime         text        not null,
  bytes        bigint,
  label        text,
  -- HARD GATE. Default is the restrictive value on purpose: a row that somehow
  -- skips an explicit source lands as 'creator' and is refused, not published.
  source       text        not null default 'creator'
               check (source in ('admin_brand','creator')),
  uploaded_by  text,
  created_at   timestamptz not null default now()
);

create index if not exists social_assets_created_idx on public.social_assets (created_at desc);
create index if not exists social_assets_source_idx  on public.social_assets (source);

-- ── Post log — one row per attempt, including refusals ───────────────────────
create table if not exists public.social_post_log (
  id                uuid        primary key default gen_random_uuid(),
  asset_id          uuid        references public.social_assets(id) on delete set null,
  mode              text        not null check (mode in ('now','scheduled')),
  platforms         text[]      not null default '{}',
  caption           text        not null default '',
  compliance        jsonb,
  x_tweet_id        text,
  telegram_msg_ids  jsonb,
  scheduled_post_id uuid,
  status            text        not null check (status in ('posted','partial','failed','blocked')),
  error             text,
  created_by        text,
  created_at        timestamptz not null default now()
);

create index if not exists social_post_log_created_idx on public.social_post_log (created_at desc);
create index if not exists social_post_log_status_idx  on public.social_post_log (status);

-- ── Let the existing content calendar carry media ────────────────────────────
alter table public.scheduled_posts add column if not exists media_asset_id uuid;

-- ── Server-only, like every other table behind the admin proxy ───────────────
alter table public.social_assets   enable row level security;
alter table public.social_post_log enable row level security;
revoke all on public.social_assets   from anon, authenticated;
revoke all on public.social_post_log from anon, authenticated;
