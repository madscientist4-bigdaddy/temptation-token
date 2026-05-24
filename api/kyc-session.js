// POST /api/kyc-session
// Body: { walletAddress }
// Creates a Persona inquiry for identity + liveness verification.
// Returns { inquiryId, personaUrl } or { alreadyVerified: true }.
// Upserts a pending row in verified_submitters.
//
// Required Vercel env vars:
//   PERSONA_API_KEY       — API key from app.withpersona.com → API keys
//   PERSONA_TEMPLATE_ID   — Government ID + selfie template ID (itmpl_...)
//   PERSONA_WEBHOOK_SECRET — from Persona webhook config (used in kyc-webhook.js)

const PERSONA_API = 'https://withpersona.com/api/v1'
const PERSONA_VERSION = '2023-01-05'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

const REDIRECT_URI = 'https://app.temptationtoken.io?kyc_complete=1'

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
  if (req.method !== 'POST') return res.status(405).end()

  const { walletAddress } = req.body || {}
  if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/i.test(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' })
  }

  const wallet = walletAddress.toLowerCase()
  const apiKey = process.env.PERSONA_API_KEY
  const templateId = process.env.PERSONA_TEMPLATE_ID

  if (!apiKey || !templateId) {
    return res.status(503).json({ error: 'KYC service not configured — contact admin' })
  }

  // If already approved, no new session needed
  try {
    const r = await sbFetch(`/verified_submitters?wallet_address=eq.${wallet}&select=status,reference_id`)
    const rows = await r.json()
    if (Array.isArray(rows) && rows.length > 0 && rows[0].status === 'approved') {
      return res.status(200).json({ alreadyVerified: true })
    }
  } catch { /* fall through — treat as not_started */ }

  // Create Persona inquiry
  let inquiryId, sessionToken
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
      const body = await r.text()
      console.error('Persona inquiry creation failed:', r.status, body)
      return res.status(502).json({ error: 'Failed to create verification session' })
    }
    const data = await r.json()
    inquiryId = data.data?.id
    sessionToken = data.data?.attributes?.['session-token']
  } catch (e) {
    console.error('Persona API error:', e.message)
    return res.status(502).json({ error: 'KYC provider unreachable' })
  }

  if (!inquiryId || !sessionToken) {
    return res.status(502).json({ error: 'Invalid response from KYC provider' })
  }

  // Upsert pending record — overwrites any previous declined/expired attempt
  await sbFetch('/verified_submitters', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      wallet_address: wallet,
      provider: 'persona',
      reference_id: inquiryId,
      status: 'pending',
      rejection_reason: null,
      verified_at: null,
      created_at: new Date().toISOString(),
    }),
  }).catch(e => console.error('Supabase upsert failed:', e.message))

  const personaUrl = `https://withpersona.com/verify?inquiry-id=${inquiryId}&session-token=${sessionToken}`
  return res.status(200).json({ inquiryId, personaUrl })
}
