// kyc_prod_assertions.mjs — production smoke assertions for the KYC / ID-retention
// + column-switch work. Read-only and non-destructive: the one write-path assertion
// (storage-del) relies on RETAIN_IDS=true short-circuiting BEFORE any delete, and uses
// a non-existent path, so nothing is ever removed.
//
// Usage:  node scripts/kyc_prod_assertions.mjs
//   ADMIN_PASSWORD is read from the environment, or from .env.vercel if present.
//   Override target with BASE=https://app.temptationtoken.io
//
// Covers: auth/authz gates, PII leak-checks, private-bucket privacy, the id_doc_path/
// selfie_path/submission_id column-switch (new + legacy), path-traversal + table
// allowlist guards, and the RETAIN_IDS retention flag (the headline assertion).

import { readFileSync } from 'node:fs'

const BASE = process.env.BASE || 'https://app.temptationtoken.io'
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'

// Pull ADMIN_PASSWORD from env or .env.vercel (never printed).
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
if (!ADMIN_PASSWORD) {
  try {
    const env = readFileSync(new URL('../.env.vercel', import.meta.url), 'utf8')
    const m = env.match(/^ADMIN_PASSWORD=(.*)$/m)
    if (m) ADMIN_PASSWORD = m[1].trim().replace(/^["']|["']$/g, '')
  } catch { /* no file */ }
}

const RANDOM_WALLET = '0x' + 'a1b2c3d4'.repeat(5)          // valid-format, unlikely to exist
const PRIVATE_FIELDS = ['id_doc_path', 'selfie_path', 'submission_id', 'reference_id']

const results = []
const record = (name, pass, detail = '') => { results.push({ name, pass, blocked: false, detail }); console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`) }
// Credential-gated checks we couldn't run (no valid admin token) are BLOCKED, not FAILED —
// they say nothing about correctness, only that the harness lacked the prod admin password.
const block = (name, detail = '') => { results.push({ name, pass: false, blocked: true, detail }); console.log(`⏭  BLOCK ${name}${detail ? `  — ${detail}` : ''}`) }

// Small retry so a transient network blip (esp. the direct-to-Supabase probe) isn't a false fail.
async function tryFetch(url, opts, attempts = 3) {
  let last
  for (let i = 0; i < attempts; i++) {
    try { return await fetch(url, opts) } catch (e) { last = e; await new Promise(r => setTimeout(r, 400 * (i + 1))) }
  }
  throw last
}
const post = (action, body, headers = {}) =>
  tryFetch(`${BASE}/api/admin?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
const get = (path) => tryFetch(`${path.startsWith('http') ? path : BASE + path}`, {})

async function main() {
  console.log(`\nKYC / ID-retention prod assertions → ${BASE}\n${'─'.repeat(60)}`)
  if (!ADMIN_PASSWORD) console.log('(no ADMIN_PASSWORD — running the 8 no-auth checks; 7 admin-gated will be BLOCKED)\n')

  // ── Auth / authz gates (no token) ──────────────────────────────────────────
  try { record('01 storage-del rejects no-token (401)', (await post('storage-del', { paths: ['x'] })).status === 401) } catch (e) { record('01 storage-del rejects no-token', false, String(e)) }
  try { record('02 storage-url rejects no-token (401)', (await post('storage-url', { path: 'x' })).status === 401) } catch (e) { record('02 storage-url rejects no-token', false, String(e)) }
  try { record('03 data proxy rejects no-token (401)', (await post('data', { op: 'get', table: 'users' })).status === 401) } catch (e) { record('03 data proxy rejects no-token', false, String(e)) }
  try { record('04 auth rejects wrong password (401)', (await post('auth', { username: ADMIN_USERNAME, password: 'definitely-wrong-' + Date.now() })).status === 401) } catch (e) { record('04 auth wrong pw', false, String(e)) }

  // ── PII leak-checks (public endpoints) ─────────────────────────────────────
  try {
    const r = await get(`/api/kyc?action=status&wallet=${RANDOM_WALLET}`)
    const t = await r.text()
    const leaks = PRIVATE_FIELDS.filter(f => t.includes(f))
    record('05 kyc status leaks no private ID columns', r.status === 200 && leaks.length === 0, leaks.length ? `LEAKED: ${leaks}` : `status=${r.status}`)
  } catch (e) { record('05 kyc status leak-check', false, String(e)) }
  try { record('06 kyc status rejects malformed wallet (400)', (await get('/api/kyc?action=status&wallet=not-a-wallet')).status === 400) } catch (e) { record('06 kyc malformed wallet', false, String(e)) }
  try {
    const r = await get('/api/public-profiles')
    const t = await r.text()
    const leaks = [...PRIVATE_FIELDS, 'wallet_address', 'payout_wallet'].filter(f => t.includes(f))
    record('07 public-profiles leaks no private fields', r.status === 200 && leaks.length === 0, leaks.length ? `LEAKED: ${leaks}` : `status=${r.status}`)
  } catch (e) { record('07 public-profiles leak-check', false, String(e)) }

  // ── Private bucket must not be publicly readable ───────────────────────────
  try {
    const r = await get(`${SUPABASE_URL}/storage/v1/object/public/id-verifications/__assert_probe__.jpg`)
    record('08 private id bucket not public (no 200)', r.status !== 200, `status=${r.status}`)
  } catch (e) { record('08 private bucket privacy', false, String(e)) }

  // ── Admin-gated: get a real token ──────────────────────────────────────────
  let token = null
  if (!ADMIN_PASSWORD) {
    block('09 auth accepts correct creds → token', 'no ADMIN_PASSWORD provided')
  } else {
    try {
      const r = await post('auth', { username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
      const d = await r.json().catch(() => ({}))
      token = d.token || null
      record('09 auth accepts correct creds → token', r.status === 200 && !!token, token ? '' : `status=${r.status} (wrong password?)`)
    } catch (e) { record('09 auth correct creds', false, String(e)) }
  }
  const auth = token ? { Authorization: `Bearer ${token}` } : {}

  if (!token) {
    // No valid admin token → the 6 admin-gated checks can't run. Report them BLOCKED.
    const msg = 'no valid admin token (set ADMIN_PASSWORD to the current prod password)'
    block('10 new ID columns queryable (column-switch live)', msg)
    block('11 legacy reference_id still readable (compat)', msg)
    block('12 RETAIN_IDS=true live (storage-del retains)', msg)
    block('13 storage-url blocks path traversal (400)', msg)
    block('14 data proxy enforces table allowlist (400)', msg)
    block('15 issued token verifies (ok:true)', msg)
  } else {
    // ── Column-switch: new columns queryable + legacy still readable ──────────
    try {
      const r = await post('data', { op: 'get', table: 'verified_submitters', query: 'select=id_doc_path,selfie_path,submission_id&limit=1' }, auth)
      record('10 new ID columns queryable (column-switch live)', r.status === 200, `status=${r.status}`)
    } catch (e) { record('10 new ID columns', false, String(e)) }
    try {
      const r = await post('data', { op: 'get', table: 'verified_submitters', query: 'select=reference_id&limit=1' }, auth)
      record('11 legacy reference_id still readable (compat)', r.status === 200, `status=${r.status}`)
    } catch (e) { record('11 legacy column compat', false, String(e)) }

    // ── RETENTION FLAG — headline assertion ──────────────────────────────────
    try {
      const r = await post('storage-del', { paths: ['__assert_nonexistent_never_deleted__.jpg'] }, auth)
      const d = await r.json().catch(() => ({}))
      record('12 RETAIN_IDS=true live (storage-del retains)', r.status === 200 && d.retained === true, `retained=${d.retained}`)
    } catch (e) { record('12 RETAIN_IDS retention', false, String(e)) }

    // ── Hardening guards ─────────────────────────────────────────────────────
    try { record('13 storage-url blocks path traversal (400)', (await post('storage-url', { path: '../secrets/x' }, auth)).status === 400) } catch (e) { record('13 path traversal', false, String(e)) }
    try { record('14 data proxy enforces table allowlist (400)', (await post('data', { op: 'get', table: 'secrets', query: 'select=*' }, auth)).status === 400) } catch (e) { record('14 table allowlist', false, String(e)) }
    try {
      const r = await post('auth', { action: 'verify', token })
      const d = await r.json().catch(() => ({}))
      record('15 issued token verifies (ok:true)', r.status === 200 && d.ok === true)
    } catch (e) { record('15 token verify', false, String(e)) }
  }

  // ── Tally ──────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length
  const blocked = results.filter(r => r.blocked).length
  const failed = results.filter(r => !r.pass && !r.blocked).length
  console.log(`${'─'.repeat(60)}\n${passed}/${results.length} passed` + (blocked ? `, ${blocked} blocked (credential)` : '') + (failed ? `, ${failed} FAILED` : ''))
  if (failed) { console.log('FAILED:', results.filter(r => !r.pass && !r.blocked).map(r => r.name).join('; ')); process.exit(1) }
  if (blocked) { console.log(`⚠️  ${passed}/${passed + blocked} runnable green; ${blocked} need the prod admin password. Re-run:  ADMIN_PASSWORD='<pw>' node scripts/kyc_prod_assertions.mjs`); process.exit(3) }
  console.log('✅ ALL 15 GREEN'); process.exit(0)
}

main().catch(e => { console.error('harness error:', e); process.exit(2) })
