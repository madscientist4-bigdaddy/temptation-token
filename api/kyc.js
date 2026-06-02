// Combined KYC + age-verification endpoint
// Routing via ?action= query param (mapped by vercel.json rewrites from original URLs)
//
// action=session  POST { walletAddress } → creates Persona inquiry
// action=webhook  POST (Persona webhook) → updates verified_submitters
// action=status   GET ?wallet=0x...     → returns KYC status
// action=age      GET ?wallet=0x...     → returns age acknowledgment status
//                 POST { walletAddress } → records 18+ acknowledgment
//
// Original paths still work via vercel.json rewrites:
//   /api/kyc-session     → /api/kyc?action=session
//   /api/kyc-webhook     → /api/kyc?action=webhook
//   /api/kyc-status      → /api/kyc?action=status
//   /api/age-acknowledge → /api/kyc?action=age

import crypto from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

const PERSONA_API     = 'https://withpersona.com/api/v1'
const PERSONA_VERSION = '2023-01-05'
const REDIRECT_URI    = 'https://app.temptationtoken.io?kyc_complete=1'
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

// ── Persona signature verification ─────────────────────────────────────────
function verifyPersonaSignature(rawBody, signatureHeader, secret) {
  if (!secret) return true
  if (!signatureHeader) return false
  const parts = {}
  signatureHeader.split(',').forEach(part => {
    const [k, v] = part.split('=')
    parts[k] = v
  })
  if (!parts.t || !parts.v1) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody}`)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(parts.v1, 'hex'), Buffer.from(expected, 'hex'))
  } catch { return false }
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export const config = { api: { bodyParser: false } }

// ── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Manual body parsing (required for kyc-webhook signature verification)
  const rawBody = await readRawBody(req)
  let body = {}
  try { body = rawBody ? JSON.parse(rawBody) : {} } catch {}

  const action = req.query.action || ''

  // ── /api/kyc-session ─────────────────────────────────────────────────────
  if (action === 'session') {
    if (req.method !== 'POST') return res.status(405).end()

    const { walletAddress } = body
    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/i.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' })
    }

    const wallet     = walletAddress.toLowerCase()
    const apiKey     = process.env.PERSONA_API_KEY
    const templateId = process.env.PERSONA_TEMPLATE_ID

    if (!apiKey || !templateId) {
      return res.status(503).json({ error: 'KYC service not configured — contact admin' })
    }

    let existingRow = null
    try {
      const r = await sbFetch(`/verified_submitters?wallet_address=eq.${wallet}&select=status,reference_id`)
      const rows = await r.json()
      if (Array.isArray(rows) && rows.length > 0) {
        existingRow = rows[0]
        if (existingRow.status === 'approved') {
          return res.status(200).json({ alreadyVerified: true })
        }
      }
    } catch {}

    let inquiryId, personaUrl
    try {
      const r = await fetch(`${PERSONA_API}/inquiries`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Persona-Version': PERSONA_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            type: 'inquiry',
            attributes: {
              'inquiry-template-id': templateId,
              'reference-id': wallet,
              'redirect-uri': REDIRECT_URI,
            },
          },
        }),
      })
      if (!r.ok) {
        const errBody = await r.text()
        console.error('Persona inquiry creation failed:', r.status, errBody)
        return res.status(502).json({ error: 'Failed to create verification session' })
      }
      const data = await r.json()
      inquiryId = data.data?.id

      // session-token lives in data.meta (not data.data.attributes) per Persona API v1
      const sessionToken = data.meta?.['session-token']

      if (sessionToken) {
        // Session token present — use hosted-flow URL directly
        personaUrl = `https://withpersona.com/verify?inquiry-id=${inquiryId}&session-token=${sessionToken}`
      } else if (inquiryId) {
        // Session token null (common for API-created inquiries) — generate a one-time-link
        try {
          const linkR = await fetch(`${PERSONA_API}/inquiries/${inquiryId}/generate-one-time-link`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Persona-Version': PERSONA_VERSION,
              'Content-Type': 'application/json',
            },
          })
          const linkData = await linkR.json()
          personaUrl = linkData.meta?.['one-time-link'] ||
                       linkData.data?.attributes?.['one-time-link']
        } catch (e) {
          console.error('Persona generate-one-time-link error:', e.message)
        }
      }
    } catch (e) {
      console.error('Persona API error:', e.message)
      return res.status(502).json({ error: 'KYC provider unreachable' })
    }

    if (!inquiryId || !personaUrl) {
      return res.status(502).json({ error: 'Failed to generate verification URL' })
    }

    // Use PATCH for existing wallets (reliable regardless of UNIQUE constraint state),
    // POST insert for new wallets. This avoids silent merge-duplicates failures.
    const sbPayload = {
      provider: 'persona',
      reference_id: inquiryId,
      status: 'pending',
      rejection_reason: null,
      verified_at: null,
    }
    if (existingRow) {
      await sbFetch(`/verified_submitters?wallet_address=eq.${wallet}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(sbPayload),
      }).catch(e => console.error('Supabase patch failed:', e.message))
    } else {
      await sbFetch('/verified_submitters', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ...sbPayload, wallet_address: wallet, created_at: new Date().toISOString() }),
      }).catch(e => console.error('Supabase insert failed:', e.message))
    }

    return res.status(200).json({ inquiryId, personaUrl })
  }

  // ── /api/kyc-webhook ─────────────────────────────────────────────────────
  if (action === 'webhook') {
    if (req.method !== 'POST') return res.status(405).end()

    const secret = process.env.PERSONA_WEBHOOK_SECRET
    if (!verifyPersonaSignature(rawBody, req.headers['persona-signature'], secret)) {
      console.error('Persona webhook: invalid signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    let event
    try { event = JSON.parse(rawBody) } catch {
      return res.status(400).json({ error: 'Invalid JSON' })
    }

    const eventName = event?.data?.attributes?.name
    const inquiry   = event?.data?.attributes?.payload?.data
    if (!inquiry || inquiry.type !== 'inquiry') {
      return res.status(200).json({ ok: true, skipped: 'not an inquiry event' })
    }

    const inquiryId  = inquiry.id
    const referenceId = inquiry.attributes?.['reference-id']
    const status     = inquiry.attributes?.status

    if (!inquiryId || !referenceId) {
      return res.status(200).json({ ok: true, skipped: 'missing inquiry id or reference-id' })
    }

    const wallet = referenceId.toLowerCase()

    let storedRow
    try {
      const r = await sbFetch(`/verified_submitters?wallet_address=eq.${wallet}&select=reference_id,status`)
      const rows = await r.json()
      storedRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
    } catch {}

    if (storedRow && storedRow.reference_id !== inquiryId) {
      console.log(`Ignoring stale webhook for inquiry ${inquiryId} (stored: ${storedRow?.reference_id})`)
      return res.status(200).json({ ok: true, skipped: 'stale inquiry' })
    }

    let update
    if (eventName === 'inquiry.approved') {
      update = { status: 'approved', verified_at: new Date().toISOString(), rejection_reason: null }
    } else if (eventName === 'inquiry.declined' || eventName === 'inquiry.failed') {
      const reason = inquiry.attributes?.['failed-reasons']?.join(', ') || status || 'declined'
      update = { status: 'declined', rejection_reason: reason }
    } else if (eventName === 'inquiry.expired') {
      update = { status: 'declined', rejection_reason: 'Session expired — please try again' }
    } else if (eventName === 'inquiry.needs_review') {
      update = { status: 'needs_review' }
    } else {
      return res.status(200).json({ ok: true, skipped: `unhandled event: ${eventName}` })
    }

    try {
      await sbFetch(`/verified_submitters?wallet_address=eq.${wallet}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(update),
      })
    } catch (e) {
      console.error('Supabase update failed:', e.message)
      return res.status(500).json({ error: 'Database update failed' })
    }

    console.log(`KYC webhook: ${eventName} for ${wallet} (inquiry: ${inquiryId})`)
    return res.status(200).json({ ok: true, event: eventName, wallet })
  }

  // ── /api/kyc-status ─────────────────────────────────────────────────────
  if (action === 'status') {
    if (req.method !== 'GET') return res.status(405).end()

    const wallet = (req.query.wallet || '').toLowerCase()
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/i.test(wallet)) {
      return res.status(400).json({ error: 'Invalid wallet address' })
    }

    const [vsRows, wvRows, wlRows] = await Promise.all([
      sbFetch(`/verified_submitters?wallet_address=eq.${wallet}&select=status,reference_id,verified_at`).then(r=>r.json()).catch(()=>[]),
      sbFetch(`/wallet_verifications?wallet_address=eq.${wallet}&is_verified=eq.true&select=id`).then(r=>r.json()).catch(()=>[]),
      sbFetch(`/verified_wallet_links?linked_wallet=eq.${wallet}&select=primary_wallet`).then(r=>r.json()).catch(()=>[]),
    ])

    if (Array.isArray(wvRows) && wvRows.length > 0) {
      return res.status(200).json({ status: 'approved', source: 'legacy' })
    }
    if (Array.isArray(wlRows) && wlRows.length > 0) {
      return res.status(200).json({ status: 'approved', source: 'linked', primaryWallet: wlRows[0].primary_wallet })
    }
    if (Array.isArray(vsRows) && vsRows.length > 0) {
      const row = vsRows[0]
      return res.status(200).json({ status: row.status, reference_id: row.reference_id, verified_at: row.verified_at, source: 'persona' })
    }
    return res.status(200).json({ status: 'not_started' })
  }

  // ── /api/age-acknowledge ────────────────────────────────────────────────
  if (action === 'age') {
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

    if (req.method === 'POST') {
      const { walletAddress } = body
      if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/i.test(walletAddress)) {
        return res.status(400).json({ error: 'Invalid wallet address' })
      }
      const wallet = walletAddress.toLowerCase()

      try {
        const r = await sbFetch(`/age_acknowledgments?wallet_address=eq.${wallet}&select=id`)
        const rows = await r.json()
        if (Array.isArray(rows) && rows.length > 0) {
          return res.status(200).json({ ok: true, alreadyDone: true })
        }
      } catch {}

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

    return res.status(405).end()
  }

  // ── /api/kyc?action=account — Persona account status + last webhook ────────
  if (action === 'account') {
    if (req.method !== 'GET') return res.status(405).end()

    // Last webhook received: most recent non-pending row (set by Persona webhooks)
    let lastWebhook = null
    try {
      const r = await sbFetch(
        '/verified_submitters?status=in.(approved,declined,needs_review)' +
        '&select=verified_at,created_at,status&order=created_at.desc&limit=1'
      )
      const rows = await r.json()
      if (Array.isArray(rows) && rows.length > 0) {
        lastWebhook = rows[0].verified_at || rows[0].created_at
      }
    } catch {}

    const apiKey = process.env.PERSONA_API_KEY
    if (!apiKey) {
      return res.status(200).json({ ok: false, configured: false, lastWebhook })
    }

    // Verify API key by fetching inquiry count. GET /api/v1/accounts lists USER accounts
    // (Persona's end-user identity records), not API plan info — use /inquiries instead.
    try {
      const r = await fetch(`${PERSONA_API}/inquiries?page%5Bsize%5D=1`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Persona-Version': PERSONA_VERSION,
          Accept: 'application/json',
        },
      })
      if (!r.ok) {
        const errText = await r.text()
        console.error('Persona GET /inquiries failed:', r.status, errText)
        return res.status(200).json({ ok: false, configured: true, personaError: r.status, lastWebhook })
      }
      const data = await r.json()
      // Determine sandbox vs production from inquiry IDs (sandbox IDs contain known prefix)
      const firstId = data?.data?.[0]?.id || ''
      const isSandbox = firstId.includes('sandbox') || apiKey.includes('sandbox') ||
                        // Persona sandbox account IDs have a distinctive segment
                        (data?.data?.length > 0 && !firstId.startsWith('inq_prod'))
      const totalInquiries = Array.isArray(data?.data) ? (data.data.length > 0 ? '1+' : '0') : 'unknown'
      return res.status(200).json({
        ok: true,
        configured: true,
        environment: isSandbox ? 'sandbox' : 'production',
        totalInquiries,
        templateId: process.env.PERSONA_TEMPLATE_ID || '(not set)',
        lastWebhook,
      })
    } catch (e) {
      console.error('Persona inquiry fetch error:', e.message)
      return res.status(200).json({ ok: false, configured: true, personaError: e.message, lastWebhook })
    }
  }

  return res.status(400).json({ error: 'Missing or unknown action' })
}
