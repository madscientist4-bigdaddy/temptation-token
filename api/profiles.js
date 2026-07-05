// /api/profiles  — consolidated public game-data endpoint (routes via ?action=)
//   ?action=list    GET                          -> { profiles: [...] }  (ALL approved, safe fields)
//   ?action=submit  GET ?wallet=0x...            -> { usedThisWeek, remaining }
//                   POST { walletAddress, ... }   -> { ok }   (insert submission)
//   ?action=vote    POST { roundId, voterWallet, ttsAmount, txHash } -> { ok }  (record vote)
//   ?action=sync    POST                         -> { round, approved, added }  (carry approved profiles onto currentRound on-chain)
//
// vercel.json rewrites preserve the original URLs:
//   /api/public-profiles -> /api/profiles?action=list
//   /api/submit-profile  -> /api/profiles?action=submit
//
// All operations use the service key. No PII is ever returned. The submission
// rate-limit (3/week) and the vote-record write are enforced/validated here so
// the browser anon key is no longer needed for `submissions` or `votes`.

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const V3_ADDRESS = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const MAX_PROFILES_PER_ROUND = 50
const V3_ABI = parseAbi([
  'function currentRoundId() view returns (uint256)',
  'function getProfiles(uint256 roundId) view returns (string[])',
  'function batchApproveProfiles(string[] profileIds, address[] wallets) external',
])

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
// Returns ALL approved profiles regardless of round. Rounds roll over weekly
// (calendar-pinned via Chainlink), but approved profiles PERSIST into the current
// round's display — a `?round=` param is intentionally ignored so a stale cached
// client cannot re-introduce the "empty play screen after rollover" bug. The
// on-chain re-approval that makes them votable in the new round is done by
// action=sync (called by the play screen on load).
async function handleList(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  const filter = 'status=eq.approved'
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

// ── action=sync ──────────────────────────────────────────────────────────────
// Carry all DB-approved profiles onto the CURRENT on-chain round so they are
// votable after a weekly rollover. Idempotent + self-healing:
//   • reads currentRoundId + getProfiles(currentRound) on-chain
//   • diffs against DB approved submissions
//   • batchApproveProfiles() only the ones missing on-chain (skips if none)
// A `profiles_synced_round` marker in admin_config fast-paths repeat calls within
// the same round (avoids on-chain reads on every play-screen load). The contract's
// batchApproveProfiles skips already-approved ids, so a rare concurrent double-call
// is harmless. Uses DEPLOYER_PRIVATE_KEY (= on-chain admin). Never moves funds.
async function getSyncedRound() {
  try {
    const r = await sb('/admin_config?key=eq.profiles_synced_round&select=value')
    const d = await r.json()
    if (Array.isArray(d) && d.length > 0) return parseInt(d[0].value, 10)
  } catch {}
  return null
}
async function setSyncedRound(round) {
  // upsert marker
  await sb('/admin_config?key=eq.profiles_synced_round', {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ value: String(round) }),
  }).then(async r => {
    // If no row existed the PATCH is a no-op (0 rows) — insert it.
    if (r.status === 404 || r.headers.get('content-range') === '*/0') {
      await sb('/admin_config', {
        method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
        body: JSON.stringify({ key: 'profiles_synced_round', value: String(round) }),
      }).catch(() => {})
    }
  }).catch(() => {})
}

async function handleSync(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const pk = process.env.DEPLOYER_PRIVATE_KEY
  if (!pk) { res.status(200).json({ ok: false, reason: 'sync unavailable (no key)' }); return }

  const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })
  let round
  try {
    round = Number(await publicClient.readContract({ address: V3_ADDRESS, abi: V3_ABI, functionName: 'currentRoundId' }))
  } catch (e) {
    res.status(200).json({ ok: false, reason: 'could not read currentRoundId' }); return
  }
  if (!round || round < 1) { res.status(200).json({ ok: false, reason: 'no active round' }); return }

  // Fast path: already fully synced for this round.
  if (await getSyncedRound() === round) { res.status(200).json({ ok: true, round, added: 0, cached: true }); return }

  // On-chain approved set for the current round.
  let onchain = []
  try {
    onchain = await publicClient.readContract({ address: V3_ADDRESS, abi: V3_ABI, functionName: 'getProfiles', args: [BigInt(round)] })
  } catch {}
  const onchainSet = new Set(onchain.map(String))

  // DB approved submissions. (wallet_address is the column approve-profile.js registers
  // on-chain — keep this select in lockstep with it; a non-existent column 400s the query.)
  let rows = []
  try {
    const r = await sb('/submissions?status=eq.approved&select=id,wallet_address&order=id.asc')
    rows = await r.json().catch(() => [])
  } catch {}
  if (!Array.isArray(rows)) rows = []

  const missing = rows
    .filter(x => !onchainSet.has(String(x.id)))
    .map(x => ({ id: String(x.id), wallet: x.wallet_address }))
    .filter(x => /^0x[0-9a-fA-F]{40}$/.test(x.wallet || ''))

  if (missing.length === 0) {
    // Nothing to add — everything approved is already on-chain for this round.
    await setSyncedRound(round)
    res.status(200).json({ ok: true, round, added: 0, approved: rows.length }); return
  }

  // Respect the on-chain per-round cap.
  const room = MAX_PROFILES_PER_ROUND - onchainSet.size
  const batch = missing.slice(0, Math.max(0, room))
  if (batch.length === 0) { res.status(200).json({ ok: false, round, reason: 'round profile cap reached', approved: rows.length }); return }

  const pkHex = pk.startsWith('0x') ? pk : `0x${pk}`
  const account = privateKeyToAccount(pkHex)
  const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) })
  let txHash
  try {
    txHash = await walletClient.writeContract({
      address: V3_ADDRESS, abi: V3_ABI, functionName: 'batchApproveProfiles',
      args: [batch.map(b => b.id), batch.map(b => b.wallet)],
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash })
  } catch (e) {
    res.status(200).json({ ok: false, round, error: `batchApproveProfiles failed: ${String(e.message || e).slice(0, 160)}` }); return
  }

  // Only mark fully synced when the whole approved set is now covered.
  if (batch.length === missing.length) await setSyncedRound(round)
  res.status(200).json({ ok: true, round, added: batch.length, approved: rows.length, txHash })
}

export default async function handler(req, res) {
  if (!SERVICE_KEY) { res.status(500).json({ error: 'Server not configured: SUPABASE_SERVICE_KEY missing' }); return }
  const action = req.query.action || ''
  if (action === 'list') return handleList(req, res)
  if (action === 'submit') return handleSubmit(req, res)
  if (action === 'vote') return handleVote(req, res)
  if (action === 'sync') return handleSync(req, res)
  res.status(400).json({ error: 'Unknown action' })
}
