// POST /api/kyc-webhook
// Receives Persona webhook events and updates verified_submitters.
//
// Persona sends: inquiry.approved | inquiry.declined | inquiry.failed | inquiry.expired
// Signature header: Persona-Signature: t=<timestamp>,v1=<HMAC-SHA256(secret, timestamp.body)>
//
// Required Vercel env vars:
//   PERSONA_WEBHOOK_SECRET — from Persona dashboard → Webhooks → signing secret

import crypto from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

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

function verifySignature(rawBody, signatureHeader, secret) {
  if (!secret) return true // skip in dev if secret not set
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
  return crypto.timingSafeEqual(Buffer.from(parts.v1, 'hex'), Buffer.from(expected, 'hex'))
}

export const config = { api: { bodyParser: false } }

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const rawBody = await readRawBody(req)
  const secret = process.env.PERSONA_WEBHOOK_SECRET

  if (!verifySignature(rawBody, req.headers['persona-signature'], secret)) {
    console.error('Persona webhook: invalid signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const eventName = event?.data?.attributes?.name
  const inquiry = event?.data?.attributes?.payload?.data
  if (!inquiry || inquiry.type !== 'inquiry') {
    return res.status(200).json({ ok: true, skipped: 'not an inquiry event' })
  }

  const inquiryId = inquiry.id
  const referenceId = inquiry.attributes?.['reference-id'] // wallet address
  const status = inquiry.attributes?.status

  if (!inquiryId || !referenceId) {
    return res.status(200).json({ ok: true, skipped: 'missing inquiry id or reference-id' })
  }

  const wallet = referenceId.toLowerCase()

  // Only act if this inquiry ID matches the one we stored (prevents stale webhooks from old sessions)
  let storedRow
  try {
    const r = await sbFetch(`/verified_submitters?wallet_address=eq.${wallet}&select=reference_id,status`)
    const rows = await r.json()
    storedRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
  } catch { /* treat as not found */ }

  if (storedRow && storedRow.reference_id !== inquiryId) {
    // Stale webhook for an old inquiry — ignore
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
