#!/usr/bin/env node
// Least-privilege Supabase migration runner.
//
// Connects with MIGRATION_DATABASE_URL — a DEDICATED `migrator` Postgres role,
// NOT the postgres master password and NOT the service key. Applies *.sql files
// transactionally, tracked in a `_migrations` ledger (idempotent by filename +
// checksum). Refuses to run as a privileged role.
//
// Usage:
//   node --env-file=.env scripts/migrate.mjs                 # apply outputs/migrations/*.sql
//   node --env-file=.env scripts/migrate.mjs path/to/file.sql
//   node --env-file=.env scripts/migrate.mjs --dry-run

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, basename } from 'node:path'

const die = (m) => { console.error('✗ ' + m); process.exit(1) }

const URL_ENV = process.env.MIGRATION_DATABASE_URL
const dryRun = process.argv.includes('--dry-run')
const pathArg = process.argv.slice(2).find(a => !a.startsWith('--'))
const target = pathArg || 'outputs/migrations'

// ── Safety guards run BEFORE any driver/connection ──────────────────────────
if (!URL_ENV) {
  die('MIGRATION_DATABASE_URL not set. Add the dedicated `migrator` connection ' +
      'string to .env (NOT the postgres master, NOT the service key).')
}
let u
try { u = new URL(URL_ENV) } catch { die('MIGRATION_DATABASE_URL is not a valid URL') }
const user = decodeURIComponent(u.username || '')
const role = user.split('.')[0] // Supavisor pooler username is "role.projectref"
if (['postgres', 'supabase_admin', 'service_role', 'rds_superuser'].includes(role)) {
  die(`Refusing to connect as privileged role "${role}". Use the dedicated ` +
      'least-privilege `migrator` role (see outputs/migration_role_setup.sql).')
}

// ── Collect migrations ──────────────────────────────────────────────────────
function sqlFiles(t) {
  const s = statSync(t)
  if (s.isFile()) return [t]
  return readdirSync(t).filter(f => f.endsWith('.sql')).sort().map(f => join(t, f))
}
let files
try { files = sqlFiles(target) } catch { die('No migrations found at: ' + target) }
if (!files.length) die('No .sql files at: ' + target)

// ── Driver (loaded only after guards pass) ──────────────────────────────────
let pg
try { pg = (await import('pg')).default } catch { die('The "pg" driver is not installed. Run:  npm i pg') }

const client = new pg.Client({ connectionString: URL_ENV })
await client.connect().catch(e => die('Connection failed: ' + e.message))
console.log(`Connected as "${user}" (least-privilege migrator).`)

await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
  filename   text PRIMARY KEY,
  checksum   text NOT NULL,
  applied_at timestamptz DEFAULT now()
)`)

let applied = 0, skipped = 0
for (const f of files) {
  const name = basename(f)
  const sql = readFileSync(f, 'utf8')
  const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16)

  const { rows } = await client.query('SELECT checksum FROM _migrations WHERE filename=$1', [name])
  if (rows.length) {
    if (rows[0].checksum !== checksum) {
      console.warn(`! ${name}: already applied but file changed — skipping. Create a NEW migration instead of editing applied ones.`)
    } else {
      console.log(`= ${name} (already applied)`)
    }
    skipped++
    continue
  }
  if (dryRun) { console.log(`~ ${name} (dry-run — would apply)`); continue }

  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO _migrations(filename, checksum) VALUES($1,$2)', [name, checksum])
    await client.query('COMMIT')
    console.log(`+ ${name} applied`)
    applied++
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    await client.end()
    die(`Migration ${name} failed (rolled back, no partial changes): ${e.message}`)
  }
}
await client.end()
console.log(`\nDone. applied=${applied} skipped=${skipped}${dryRun ? ' (dry-run)' : ''}`)
