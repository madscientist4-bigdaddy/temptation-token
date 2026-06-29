-- Harmless no-op migration: proves the runner can execute real DDL with the
-- least-privilege migrator role, while leaving NOTHING behind.
create table if not exists _migration_healthcheck (checked_at timestamptz default now());
drop table if exists _migration_healthcheck;
