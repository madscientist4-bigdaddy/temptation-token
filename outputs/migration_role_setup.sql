-- ============================================================================
-- ONE-TIME bootstrap — run ONCE in the Supabase SQL editor (privileged).
-- Creates a dedicated least-privilege "migrator" role for automated DDL
-- migrations. Does NOT use or expose the postgres master password.
-- Revoke anytime with:  DROP ROLE migrator;
-- ============================================================================

-- 1. Create the role — login only; NOT superuser/createdb/createrole/bypassrls.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'migrator') then
    create role migrator with login password 'CHANGE_ME_TO_A_STRONG_PASSWORD'
      nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end $$;

-- 2. Schema-scoped DDL: create new objects in public (migrator owns what it
--    creates, so it can ALTER/DROP those freely in future migrations).
grant usage, create on schema public to migrator;

-- 3. Data + management on EXISTING public objects (data migrations, etc.).
grant all privileges on all tables    in schema public to migrator;
grant all privileges on all sequences in schema public to migrator;
alter default privileges in schema public grant all on tables    to migrator;
alter default privileges in schema public grant all on sequences to migrator;

-- 4. Defensive: ensure NO reach outside the public app schema (it has none by
--    default — this just makes it explicit).
revoke all on schema auth    from migrator;
revoke all on schema storage from migrator;

-- 5. (Only if a FUTURE migration must ALTER a table that already exists and is
--    owned by another role) transfer that specific table's ownership, e.g.:
--      alter table referral_settings owner to migrator;
--    Tables migrator itself creates need no such step.

-- ============================================================================
-- After running, add to .env (gitignored) — use the Supavisor SESSION pooler
-- (port 5432) for IPv4 + DDL/transaction support. Replace <region> from
-- Dashboard → Project Settings → Database → Connection string (Session pooler):
--
--   MIGRATION_DATABASE_URL=postgresql://migrator.gmlikdxykgviyprqtqwz:CHANGE_ME_TO_A_STRONG_PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres
--
-- Then:  node --env-file=.env scripts/migrate.mjs --dry-run
--        node --env-file=.env scripts/migrate.mjs
-- ============================================================================
