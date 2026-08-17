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

// Private bucket holding government IDs + verification selfies. NEVER public.
// Access is service-key-only (this file) for upload-signing; admin reads go through
// the gated /api/admin?action=storage-url signed-URL minter. See storage-security design.
const ID_BUCKET = 'id-verifications'
let idBucketEnsured = false
async function ensureIdBucket() {
  if (idBucketEnsured) return
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ID_BUCKET, name: ID_BUCKET, public: false,
        file_size_limit: 15728640, // 15 MB
        allowed_mime_types: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      }),
    }) // 200 = created, 400/409 = already exists — both fine
    idBucketEnsured = true
  } catch { /* leave un-ensured; next call retries */ }
}

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
      sbFetch(`/verified_submitters?wallet_address=eq.${wallet}&select=status,provider,verified_at`).then(r=>r.json()).catch(()=>[]),
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
      // NOTE: this is a PUBLIC endpoint. Only status/provider/verified_at are selected
      // and returned — the private ID columns (id_doc_path/selfie_path/submission_id)
      // and reference_id are never selected here, so they cannot leak.
      return res.status(200).json({ status: row.status, verified_at: row.verified_at, source: row.provider || 'persona' })
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

  // ── /api/kyc?action=request — user submits for MANUAL review ───────────────
  // Persona production was not purchased (business decision), so manual admin approval
  // is the launch KYC mechanism. This records the wallet as `pending` so it surfaces in
  // the admin Verifications queue (where "Override Approve" / the manual-verify box mark
  // it approved). No Persona session, no ID upload, no sandbox flow shown to the user.
  if (action === 'request') {
    if (req.method !== 'POST') return res.status(405).end()
    const { walletAddress } = body
    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/i.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' })
    }
    const wallet = walletAddress.toLowerCase()
    try {
      const r = await sbFetch(`/verified_submitters?wallet_address=eq.${wallet}&select=status`)
      const rows = await r.json()
      const existing = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
      if (existing?.status === 'approved') {
        return res.status(200).json({ ok: true, status: 'approved', alreadyVerified: true })
      }
      const payload = { provider: 'manual', status: 'pending', rejection_reason: null, verified_at: null }
      if (existing) {
        await sbFetch(`/verified_submitters?wallet_address=eq.${wallet}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload),
        })
      } else {
        await sbFetch('/verified_submitters', {
          method: 'POST', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ ...payload, wallet_address: wallet, reference_id: null, created_at: new Date().toISOString() }),
        })
      }
      return res.status(200).json({ ok: true, status: 'pending' })
    } catch (e) {
      console.error('kyc request-manual failed:', e.message)
      return res.status(500).json({ error: 'Could not submit verification request' })
    }
  }

  // ── /api/kyc?action=id-upload-init — mint signed UPLOAD urls for ID + selfie ──
  // Browser uploads government ID + selfie DIRECTLY to the private bucket via these
  // short-lived, single-object signed URLs. The service key never reaches the client;
  // the server chooses wallet-scoped, random paths (client cannot pick the path).
  if (action === 'id-upload-init') {
    if (req.method !== 'POST') return res.status(405).end()
    const { walletAddress } = body
    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/i.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' })
    }
    const wallet = walletAddress.toLowerCase()

    // Already verified → no ID needed (one-time-per-wallet, enforced again at submit).
    try {
      const r = await sbFetch(`/verified_submitters?wallet_address=eq.${wallet}&status=eq.approved&select=wallet_address&limit=1`)
      const rows = await r.json()
      if (Array.isArray(rows) && rows.length > 0) return res.status(200).json({ alreadyVerified: true })
    } catch {}

    await ensureIdBucket()
    const uid = crypto.randomUUID()
    const idPath = `${wallet}/${uid}-id.jpg`
    const selfiePath = `${wallet}/${uid}-selfie.jpg`

    async function signUpload(path) {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${ID_BUCKET}/${path}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // storage rejects an empty JSON body
      })
      if (!r.ok) throw new Error(`sign-upload ${r.status}: ${(await r.text()).slice(0, 140)}`)
      const d = await r.json()
      return d.url // "/object/upload/sign/<bucket>/<path>?token=<jwt>"
    }

    try {
      const [idUrl, selfieUrl] = await Promise.all([signUpload(idPath), signUpload(selfiePath)])
      return res.status(200).json({
        bucketBase: `${SUPABASE_URL}/storage/v1`,
        id: { path: idPath, url: idUrl },
        selfie: { path: selfiePath, url: selfieUrl },
      })
    } catch (e) {
      console.error('id-upload-init failed:', e.message)
      return res.status(502).json({ error: 'Could not start ID upload' })
    }
  }

  // ── ?action=delete-account — user-initiated deletion ───────────────────────
  //
  // App Store Guideline 5.1.1(v): an app with account creation must let the user
  // initiate deletion from inside the app. Wallet address is the account identity here.
  //
  // OWNERSHIP MUST BE PROVEN. Without a signature this endpoint would let anyone delete
  // any wallet's profile and ID documents by typing an address — the address is public
  // information, so it authenticates nothing. The caller signs a dated message and we
  // recover it; a 15-minute freshness window stops a captured signature being replayed
  // later.
  //
  // WHAT IS AND IS NOT DELETED is dictated by the published retention policy
  // (outputs/legal/privacy_policy.md §6), not by convenience:
  //   deleted — profile submissions, the verification row, the government ID + selfie
  //             objects, the 18+ acknowledgement, linked-wallet records
  //   KEPT    — bonus claims ("retained indefinitely for fraud prevention"), and the
  //             on-chain votes/payouts, which are public blockchain facts we cannot erase
  //             and must not pretend to. The receipt says so explicitly, because a
  //             deletion flow that implies it erased the chain is a lie.
  if (action === 'delete-account') {
    const KEPT = [
      { what: 'On-chain votes, payouts and trophies', why: 'Public blockchain records — permanent and outside our control. Cannot be deleted by anyone.' },
      { what: 'Bonus claim records', why: 'Retained indefinitely for fraud prevention, per our published retention policy.' },
    ]
    const DELETED = [
      'Your profile submissions (photo, display name, links)',
      'Your identity verification record',
      'Your government ID and selfie images',
      'Your 18+ acknowledgement',
      'Any linked-wallet records',
    ]
    const messageFor = (wallet, issuedAt) =>
      `Temptation Token — delete my account\n\nWallet: ${wallet}\nIssued: ${issuedAt}\n\n` +
      `I confirm I control this wallet and I am asking Temptation Token to delete my ` +
      `off-chain profile and identity data. On-chain records cannot be deleted.`

    if (req.method === 'GET') {
      const wallet = String(req.query.wallet || '').toLowerCase()
      if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return res.status(400).json({ error: 'Invalid wallet' })
      const issuedAt = new Date().toISOString()
      return res.status(200).json({
        wallet, issuedAt, message: messageFor(wallet, issuedAt),
        willDelete: DELETED, willKeep: KEPT,
        contact: 'support@temptationtoken.io',
      })
    }
    if (req.method !== 'POST') return res.status(405).end()

    const { walletAddress, signature, issuedAt } = body
    const wallet = String(walletAddress || '').toLowerCase()
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return res.status(400).json({ error: 'Invalid wallet address' })
    if (!signature || !issuedAt) return res.status(400).json({ error: 'signature and issuedAt are required' })

    const age = Date.now() - Date.parse(issuedAt)
    if (!Number.isFinite(age) || age < -60_000 || age > 15 * 60_000) {
      return res.status(400).json({ error: 'Request expired — start the deletion again.' })
    }

    try {
      const { verifyMessage } = await import('viem')
      const ok = await verifyMessage({
        address: wallet,
        message: messageFor(wallet, issuedAt),
        signature,
      })
      if (!ok) return res.status(401).json({ error: 'Signature does not match this wallet.' })
    } catch (e) {
      console.error('delete-account signature check failed:', e.message)
      return res.status(401).json({ error: 'Could not verify the signature.' })
    }

    const deleted = {}
    const failures = []

    // Row deletes. Each is independent: a missing table must not abort the rest, or a
    // user's ID images would survive because some unrelated table was renamed.
    const tables = [
      ['submissions', `wallet_address=eq.${wallet}`],
      ['verified_submitters', `wallet_address=eq.${wallet}`],
      ['age_acknowledgments', `wallet_address=eq.${wallet}`],
      ['verified_wallet_links', `linked_wallet=eq.${wallet}`],
    ]
    for (const [table, filter] of tables) {
      try {
        const r = await sbFetch(`/${table}?${filter}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=representation' },
        })
        if (!r.ok) { failures.push(`${table} (${r.status})`); continue }
        const rows = await r.json().catch(() => [])
        deleted[table] = Array.isArray(rows) ? rows.length : 0
      } catch (e) { failures.push(`${table} (${e.message})`) }
    }

    // ID + selfie objects live under `<wallet>/` in a private bucket. List then delete —
    // the filenames contain a random uuid, so they cannot be reconstructed.
    try {
      const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${ID_BUCKET}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: `${wallet}/`, limit: 200 }),
      })
      const objects = listRes.ok ? await listRes.json().catch(() => []) : []
      const names = (Array.isArray(objects) ? objects : []).map(o => `${wallet}/${o.name}`)
      if (names.length) {
        const delRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${ID_BUCKET}`, {
          method: 'DELETE',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: names }),
        })
        if (!delRes.ok) failures.push(`id-images (${delRes.status})`)
        else deleted.id_images = names.length
      } else {
        deleted.id_images = 0
      }
    } catch (e) { failures.push(`id-images (${e.message})`) }

    if (failures.length) {
      // Partial deletion is a real outcome and must not be reported as success — the user
      // needs to know something of theirs may remain, and who to chase.
      console.error('delete-account partial failure', wallet, failures)
      return res.status(207).json({
        ok: false, partial: true, wallet, deleted, failed: failures, kept: KEPT,
        message: 'Some data could not be deleted. Email support@temptationtoken.io and we will finish it manually.',
        contact: 'support@temptationtoken.io',
      })
    }

    return res.status(200).json({
      ok: true, wallet, deleted, kept: KEPT,
      message: 'Your off-chain profile and identity data have been deleted.',
    })
  }

  return res.status(400).json({ error: 'Missing or unknown action' })
}
