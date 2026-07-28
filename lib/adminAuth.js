// Shared admin-session verification for server endpoints that sign privileged
// (Bank-wallet) on-chain transactions. Mirrors the HMAC token scheme minted by
// api/admin.js (?action=auth): token = `${b64url(JSON.stringify({exp}))}.${HMAC}`,
// HMAC = base64url( HMAC-SHA256(payload, SECRET) ).
//
// SECRET resolves the same way as api/admin.js so tokens are cross-valid.
import crypto from 'crypto'

const SECRET = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''

const sign = (data, secret) =>
  crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// Verify an admin session token. Returns true only for a well-formed,
// correctly-signed, unexpired token. Fail-closed if SECRET is unset.
export function verifyAdminToken(token) {
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

// Pull the bearer token from an incoming request (Authorization header first,
// then a body.token fallback — matching api/admin.js's handleData).
export function tokenFromReq(req, body) {
  const auth = req.headers?.authorization || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7)
  return (body && body.token) || ''
}

// Guard helper: verifies the request carries a valid admin token. On failure it
// writes a 401 and returns false; on success returns true. Usage:
//   if (!requireAdmin(req, res, body)) return
export function requireAdmin(req, res, body) {
  if (verifyAdminToken(tokenFromReq(req, body))) return true
  res.status(401).json({ ok: false, error: 'Unauthorized' })
  return false
}
