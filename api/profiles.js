// /api/profiles  — consolidated public game-data endpoint (routes via ?action=)
//   ?action=list    GET ?round=N                 -> { profiles: [...] }  (safe fields only)
//   ?action=submit  GET ?wallet=0x...            -> { usedThisWeek, remaining }
//                   POST { walletAddress, ... }   -> { ok }   (insert submission)
//   ?action=vote    POST { roundId, voterWallet, ttsAmount, txHash } -> { ok }  (record vote)
//
// vercel.json rewrites preserve the original URLs:
//   /api/public-profiles -> /api/profiles?action=list
//   /api/submit-profile  -> /api/profiles?action=submit
//
// All operations use the service key. No PII is ever returned. The submission
// rate-limit (3/week) and the vote-record write are enforced/validated here so
// the browser anon key is no longer needed for `submissions` or `votes`.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_PER_WEEK = 3
const isAddr = (w) => /^0x[0-9a-fA-F]{40}$/.test(w || '')
const isTxHash = (h) => /^0x[0-9a-fA-F]{64}$/.test(h || '')

// Explicit safe-field allowlist for public profile reads.
const SAFE_SELECT = 'select=id,display_name,image_url,link_title,link_url,round_id'

function sb(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
}

function parseBody(req) {
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  return body || {}
}

async function countThisWeek(wallet) {
  const ago = new Date(Date.now() - WEEK_MS).toISOString()
  const r = await sb(`/submissions?wallet_address=eq.${wallet}&created_at=gte.${ago}&select=id`)
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) ? rows.length : 0
}

// ── action=list ────────────────────────────────────────────────────────────
async function handleList(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  let filter = 'status=eq.approved'
  const round = parseInt(req.query.round, 10)
  if (Number.isInteger(round) && round > 0) filter += `&round_id=eq.${round}`
  try {
    const r = await sb(`/submissions?${filter}&${SAFE_SELECT}&order=id.asc`)
    if (!r.ok) { res.status(502).json({ error: 'Upstream error' }); return }
    const rows = await r.json()
    const profiles = (Array.isArray(rows) ? rows : []).map(x => ({
      profileId: x.id,
      display_name: x.display_name || 'Anonymous',
      image_url: x.image_url || '',
      link_title: x.link_title || '',
      link_url: x.link_url || '',
      round_id: x.round_id,
    }))
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30')
    res.status(200).json({ profiles })
  } catch {
    res.status(502).json({ error: 'Failed to load profiles' })
  }
}

// ── action=submit ──────────────────────────────────────────────────────────
async function handleSubmit(req, res) {
  if (req.method === 'GET') {
    const wallet = req.query.wallet
    if (!isAddr(wallet)) { res.status(400).json({ error: 'Invalid wallet address' }); return }
    try {
      const used = await countThisWeek(wallet)
      res.status(200).json({ usedThisWeek: used, remaining: Math.max(0, MAX_PER_WEEK - used) })
    } catch { res.status(502).json({ error: 'Lookup failed' }) }
    return
  }

  if (req.method === 'POST') {
    const body = parseBody(req)
    const { walletAddress, payoutWallet, displayName, linkTitle, linkUrl, imageUrl, referralCode, roundId } = body
    if (!isAddr(walletAddress)) { res.status(400).json({ error: 'Invalid wallet address' }); return }
    const payout = isAddr(payoutWallet) ? payoutWallet : walletAddress
    const name = (displayName || '').trim()
    if (!/^[\p{L}\p{N} '_-]{1,30}$/u.test(name)) { res.status(400).json({ error: 'Invalid display name' }); return }
    const link = (linkUrl || '').trim()
    if (link && !/^https?:\/\/.+/.test(link)) { res.status(400).json({ error: 'Invalid link URL' }); return }
    if (!imageUrl || typeof imageUrl !== 'string') { res.status(400).json({ error: 'Missing image' }); return }
    if (imageUrl.length > 12_000_000) { res.status(413).json({ error: 'Image too large' }); return }
    const round = Number.isInteger(roundId) && roundId > 0 ? roundId : 1

    try {
      if (await countThisWeek(walletAddress) >= MAX_PER_WEEK) {
        res.status(429).json({ error: 'Submission limit reached (3 per week)' })
        return
      }
      const ins = await sb('/submissions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          round_id: round,
          wallet_address: walletAddress,
          payout_wallet: payout,
          display_name: name,
          link_title: (linkTitle || '').trim(),
          link_url: link,
          image_url: imageUrl,
          status: 'pending',
          referral_code: (referralCode || '').trim().toLowerCase() || null,
        }),
      })
      if (!ins.ok) {
        const detail = await ins.text().catch(() => '')
        res.status(502).json({ error: 'Insert failed', detail: detail.slice(0, 200) })
        return
      }
      res.status(200).json({ ok: true })
    } catch { res.status(502).json({ error: 'Submission failed' }) }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}

// ── action=vote ────────────────────────────────────────────────────────────
// Records a vote for dashboard metrics. The vote itself is on-chain; this row is
// non-authoritative analytics. Validated + service-key so the `votes` table no
// longer needs a browser anon-insert policy.
async function handleVote(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const body = parseBody(req)
  const { roundId, voterWallet, ttsAmount, txHash } = body
  if (!isAddr(voterWallet)) { res.status(400).json({ error: 'Invalid wallet address' }); return }
  if (!isTxHash(txHash)) { res.status(400).json({ error: 'Invalid txHash' }); return }
  const amount = Number(ttsAmount)
  if (!Number.isFinite(amount) || amount <= 0) { res.status(400).json({ error: 'Invalid amount' }); return }
  const round = Number.isInteger(roundId) && roundId > 0 ? roundId : 1
  try {
    const ins = await sb('/votes', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        round_id: round,
        voter_wallet: voterWallet,
        tts_amount: amount,
        tx_hash: txHash,
        created_at: new Date().toISOString(),
      }),
    })
    if (!ins.ok) {
      const detail = await ins.text().catch(() => '')
      res.status(502).json({ error: 'Insert failed', detail: detail.slice(0, 200) })
      return
    }
    res.status(200).json({ ok: true })
  } catch { res.status(502).json({ error: 'Vote record failed' }) }
}

export default async function handler(req, res) {
  if (!SERVICE_KEY) { res.status(500).json({ error: 'Server not configured: SUPABASE_SERVICE_KEY missing' }); return }
  const action = req.query.action || ''
  if (action === 'list') return handleList(req, res)
  if (action === 'submit') return handleSubmit(req, res)
  if (action === 'vote') return handleVote(req, res)
  res.status(400).json({ error: 'Unknown action' })
}
