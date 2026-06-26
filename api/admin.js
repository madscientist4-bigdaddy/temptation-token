// /api/admin  — consolidated admin endpoint (routes via ?action=)
//   ?action=auth  POST { username, password }      -> { ok, token, exp }   (401 on bad creds)
//                 POST { action:'verify', token }   -> { ok }
//   ?action=data  POST { op, table, query?, payload?, prefer? }  -> Supabase result (token-gated)
//
// vercel.json rewrites preserve the original URLs:
//   /api/admin-auth -> /api/admin?action=auth
//   /api/admin-data -> /api/admin?action=data
//
// The admin password lives only in ADMIN_PASSWORD (server env). Sessions are
// HMAC-signed tokens (secret = ADMIN_SESSION_SECRET, falls back to ADMIN_PASSWORD).
// The data proxy verifies the token, then reads/writes with the service key,
// restricted to an allowlisted set of tables.

import crypto from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const SECRET = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''
const TTL_MS = 24 * 60 * 60 * 1000

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const sign = (data, secret) =>
  crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function makeToken(secret) {
  const exp = Date.now() + TTL_MS
  const payload = b64url(JSON.stringify({ exp }))
  return { token: `${payload}.${sign(payload, secret)}`, exp }
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !SECRET) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = sign(payload, SECRET)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    return typeof exp === 'number' && Date.now() < exp
  } catch { return false }
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

const ALLOWED = new Set([
  'users', 'submissions', 'votes', 'stakes', 'staking_positions',
  'bonus_claims', 'referral_credits', 'referral_settings', 'club_partners',
  'scheduled_posts', 'admin_config', 'admin_audit_log', 'age_acknowledgments',
  'verified_submitters', 'verified_wallet_links', 'wallet_verifications',
  'project_expenses', 'project_income',
])
const METHODS = { get: 'GET', post: 'POST', patch: 'PATCH', delete: 'DELETE' }
const PREFER_OK = new Set(['return=minimal', 'return=representation', 'resolution=merge-duplicates', 'resolution=ignore-duplicates'])

function parseBody(req) {
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  return body || {}
}

async function handleAuth(req, res, body) {
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

  if (body.action === 'verify') {
    res.status(200).json({ ok: verifyToken(body.token) })
    return
  }
  if (!ADMIN_PASSWORD) {
    res.status(500).json({ ok: false, error: 'Server auth not configured: ADMIN_PASSWORD is unset' })
    return
  }
  const okUser = safeEqual(body.username || '', ADMIN_USERNAME)
  const okPass = safeEqual(body.password || '', ADMIN_PASSWORD)
  if (okUser && okPass) {
    const { token, exp } = makeToken(SECRET)
    res.status(200).json({ ok: true, token, exp })
  } else {
    res.status(401).json({ ok: false, error: 'Invalid credentials' })
  }
}

async function handleData(req, res, body) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (body.token || '')
  if (!verifyToken(token)) { res.status(401).json({ error: 'Unauthorized' }); return }
  if (!SERVICE_KEY) { res.status(500).json({ error: 'Server not configured: SUPABASE_SERVICE_KEY missing' }); return }

  const { op = 'get', table, query = '', payload, prefer } = body
  const method = METHODS[op]
  if (!method) { res.status(400).json({ error: 'Bad op' }); return }
  if (typeof table !== 'string' || !ALLOWED.has(table)) { res.status(400).json({ error: 'Table not allowed' }); return }

  const q = String(query || '').replace(/^\?/, '').replace(/[\r\n]/g, '')
  const url = `${SUPABASE_URL}/rest/v1/${table}${q ? `?${q}` : ''}`
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
  if (method === 'POST' || method === 'PATCH') {
    const tokens = typeof prefer === 'string'
      ? prefer.split(',').map(s => s.trim()).filter(t => PREFER_OK.has(t))
      : []
    headers.Prefer = tokens.length ? tokens.join(',') : 'return=representation'
  }

  try {
    const r = await fetch(url, { method, headers, body: payload !== undefined && method !== 'GET' ? JSON.stringify(payload) : undefined })
    const text = await r.text()
    res.setHeader('Cache-Control', 'no-store')
    res.status(r.status)
    try { res.json(text ? JSON.parse(text) : []) } catch { res.send(text) }
  } catch {
    res.status(502).json({ error: 'Upstream error' })
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const action = req.query.action || ''
  const body = parseBody(req)
  if (action === 'auth') return handleAuth(req, res, body)
  if (action === 'data') return handleData(req, res, body)
  res.status(400).json({ error: 'Unknown action' })
}
