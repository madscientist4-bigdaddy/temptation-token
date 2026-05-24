// POST /api/age-acknowledge
// Body: { walletAddress }
// Records 18+ acknowledgment for a voter on first wallet connect.
// Idempotent: returns { ok: true, alreadyDone: true } if already recorded.
//
// GET /api/age-acknowledge?wallet=0x...
// Returns { acknowledged: true/false }

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const AGREEMENT_VERSION = 'v1.0'

function sbFetch(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const wallet = (req.query.wallet || '').toLowerCase()
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/i.test(wallet)) {
      return res.status(400).json({ error: 'Invalid wallet address' })
    }
    try {
      const r = await sbFetch(`/age_acknowledgments?wallet_address=eq.${wallet}&select=id`)
      const rows = await r.json()
      return res.status(200).json({ acknowledged: Array.isArray(rows) && rows.length > 0 })
    } catch {
      return res.status(200).json({ acknowledged: false })
    }
  }

  if (req.method !== 'POST') return res.status(405).end()

  const { walletAddress } = req.body || {}
  if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/i.test(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' })
  }

  const wallet = walletAddress.toLowerCase()

  // Idempotency check
  try {
    const r = await sbFetch(`/age_acknowledgments?wallet_address=eq.${wallet}&select=id`)
    const rows = await r.json()
    if (Array.isArray(rows) && rows.length > 0) {
      return res.status(200).json({ ok: true, alreadyDone: true })
    }
  } catch { /* treat as not found */ }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
             req.socket?.remoteAddress || ''

  try {
    await sbFetch('/age_acknowledgments', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        wallet_address: wallet,
        acknowledged_at: new Date().toISOString(),
        ip_address: ip,
        agreement_version: AGREEMENT_VERSION,
      }),
    })
  } catch (e) {
    console.error('age-acknowledge insert failed:', e.message)
    return res.status(500).json({ error: 'Failed to record acknowledgment' })
  }

  return res.status(200).json({ ok: true })
}
