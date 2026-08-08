// Club registration + self-serve partner onboarding.
//
//   POST /api/set-club-wallet                      admin — register/deregister directly
//   POST /api/set-club-wallet?action=apply         PUBLIC — a club applies (no auth, no gas)
//   GET  /api/set-club-wallet?action=status&wallet=0x…   PUBLIC — poll own application
//   GET  /api/set-club-wallet?action=pending       admin — the approval queue
//   POST /api/set-club-wallet?action=approve       admin — approve: on-chain register + unlock kit
//   POST /api/set-club-wallet?action=deny          admin — deny
//
// Everything lives in one file because Vercel Hobby caps us at 12 functions and we are
// exactly at 12. Routed by ?action=, with /api/clubs/* rewritten to it in vercel.json.
//
// Design: a club owner never transacts and never pays gas. They give a name + city and a
// payout address (existing wallet, or one created inline via passkey). The ONLY on-chain
// write is setClubWallet, signed by Bank at approval time. Approval is the one human gate.
//
// Requires: DEPLOYER_PRIVATE_KEY in Vercel env.

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { requireAdmin } from '../lib/adminAuth.js'

const VOTING_ADDRESS = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const SUPABASE_URL   = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

const ABI = parseAbi(['function setClubWallet(string calldata code, address wallet) external'])

// ── Supabase helper ───────────────────────────────────────────────────────────
function sb(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  })
}


// Every abuse check below MUST fail closed. PostgREST returns a JSON *error object* (not
// an exception) for a missing table, a bad filter or an RLS denial — so `await r.json()`
// resolves to `{code, message}` and an `Array.isArray()` guard quietly falls through,
// skipping the check entirely. That is how a dedupe/rate-limit becomes decorative. This
// helper turns any non-2xx or non-array result into a throw, so the caller's catch runs.
async function sbRows(path) {
  const r = await sb(path)
  if (!r.ok) throw new Error(`supabase ${r.status}`)
  const d = await r.json()
  if (!Array.isArray(d)) throw new Error('supabase returned a non-array result')
  return d
}

const isAddr = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a)
const ZERO = '0x0000000000000000000000000000000000000000'

// Club codes are DERIVED, never chosen by the applicant — a code is printed on flyers and
// typed by performers, so it has to be short, lowercase and unambiguous.
function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20)
}

async function uniqueCode(base) {
  for (let i = 0; i < 25; i++) {
    const cand = i === 0 ? base : `${base}${i + 1}`
    // No .catch(() => []) here: swallowing a lookup failure would hand out a code that
    // is already taken, and club codes are the thing that routes a club's 10%.
    const [a, b] = await Promise.all([
      sbRows(`/club_partners?club_code=eq.${cand}&select=club_code`),
      sbRows(`/pending_clubs?club_code=eq.${cand}&select=club_code`),
    ])
    if (!a.length && !b.length) return cand
  }
  return null
}

function clientIp(req) {
  const f = req.headers['x-forwarded-for']
  return (Array.isArray(f) ? f[0] : (f || '')).split(',')[0].trim() || 'unknown'
}

// ── PUBLIC: a club applies ────────────────────────────────────────────────────
async function handleApply(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })
  const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {}

  const clubName = String(b.clubName || '').trim()
  const city     = String(b.city || '').trim()
  const wallet   = String(b.walletAddress || '').trim()

  if (clubName.length < 2 || clubName.length > 80) return res.status(400).json({ ok: false, error: 'Club name must be 2–80 characters.' })
  if (city.length < 2 || city.length > 80)         return res.status(400).json({ ok: false, error: 'City must be 2–80 characters.' })
  if (!isAddr(wallet) || wallet.toLowerCase() === ZERO) return res.status(400).json({ ok: false, error: 'A valid payout wallet is required.' })

  const walletLc = wallet.toLowerCase()

  // Dedupe: one live application per wallet, and never shadow an already-approved club.
  try {
    const existing = await sbRows(`/pending_clubs?wallet_address=eq.${walletLc}&status=in.(pending,approved)&select=club_code,status`)
    if (existing.length) {
      return res.status(200).json({ ok: true, duplicate: true, clubCode: existing[0].club_code, status: existing[0].status })
    }
    const already = await sbRows(`/club_partners?wallet_address=eq.${walletLc}&active=is.true&select=club_code`)
    if (already.length) {
      return res.status(200).json({ ok: true, duplicate: true, clubCode: already[0].club_code, status: 'approved' })
    }
  } catch (e) {
    console.error('club apply: dedupe check failed —', e.message)
    return res.status(503).json({ ok: false, error: 'Applications are temporarily unavailable. Please try again shortly.' })
  }

  // Abuse limit: cap applications per IP per day. Fail CLOSED — if we cannot count, we
  // do not accept, rather than leave the public queue open to flooding.
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const recent = await sbRows(`/pending_clubs?created_at=gte.${since}&applicant_ip=eq.${encodeURIComponent(clientIp(req))}&select=id`)
    if (recent.length >= 3) {
      return res.status(429).json({ ok: false, error: 'Too many applications from this connection today. Try again tomorrow.' })
    }
  } catch (e) {
    console.error('club apply: rate-limit check failed —', e.message)
    return res.status(503).json({ ok: false, error: 'Applications are temporarily unavailable. Please try again shortly.' })
  }

  const base = slugify(clubName)
  if (!base) return res.status(400).json({ ok: false, error: 'Club name must contain letters or numbers.' })
  let code
  try {
    code = await uniqueCode(base)
  } catch (e) {
    console.error('club apply: code allocation failed —', e.message)
    return res.status(503).json({ ok: false, error: 'Applications are temporarily unavailable. Please try again shortly.' })
  }
  if (!code) return res.status(409).json({ ok: false, error: 'Could not generate a unique code for that name — try a more specific name.' })

  const r = await sb('/pending_clubs', {
    method: 'POST',
    body: JSON.stringify({
      club_code: code, club_name: clubName, city,
      wallet_address: walletLc, status: 'pending',
      applicant_ip: clientIp(req), created_at: new Date().toISOString(),
    }),
  })
  if (!r.ok) {
    // Log the real reason; never return it. A public endpoint echoing PostgREST errors
    // discloses table names and schema state to anyone who can POST.
    console.error('club apply: insert failed —', (await r.text().catch(() => '')).slice(0, 300))
    return res.status(503).json({ ok: false, error: 'Applications are temporarily unavailable. Please try again shortly.' })
  }
  return res.status(200).json({ ok: true, clubCode: code, status: 'pending' })
}

// ── PUBLIC: poll your own application ─────────────────────────────────────────
// Keyed by wallet, which the applicant demonstrably controls. Returns only their own row.
async function handleStatus(req, res) {
  const wallet = String(req.query?.wallet || '').trim().toLowerCase()
  if (!isAddr(wallet)) return res.status(400).json({ ok: false, error: 'wallet required' })
  try {
    const rows = await sb(`/pending_clubs?wallet_address=eq.${wallet}&select=club_code,club_name,city,status,created_at&order=created_at.desc&limit=1`).then(r => r.json())
    if (!Array.isArray(rows) || !rows.length) return res.status(200).json({ ok: true, found: false })
    const row = rows[0]
    return res.status(200).json({ ok: true, found: true, clubCode: row.club_code, clubName: row.club_name, city: row.city, status: row.status })
  } catch {
    return res.status(503).json({ ok: false, error: 'status unavailable' })
  }
}

// ── ADMIN: pending queue ──────────────────────────────────────────────────────
async function handlePending(req, res) {
  if (!requireAdmin(req, res, req.body || {})) return
  try {
    const rows = await sb('/pending_clubs?status=eq.pending&select=*&order=created_at.asc').then(r => r.json())
    return res.status(200).json({ ok: true, pending: Array.isArray(rows) ? rows : [] })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message })
  }
}

// ── ADMIN: deny ───────────────────────────────────────────────────────────────
async function handleDeny(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })
  if (!requireAdmin(req, res, req.body || {})) return
  const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {}
  const code = String(b.clubCode || '').trim().toLowerCase()
  if (!code) return res.status(400).json({ ok: false, error: 'clubCode required' })
  await sb(`/pending_clubs?club_code=eq.${code}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'denied', decided_at: new Date().toISOString() }),
  })
  return res.status(200).json({ ok: true, clubCode: code, status: 'denied' })
}



// ── ADMIN: approve → the one human gate ───────────────────────────────────────
// Fires the on-chain registration from Bank, flips the club live, and unlocks the kit.
// Ordering matters: the chain write happens FIRST and is receipt-checked. We only mark
// the application approved once the club is genuinely registered, so a failed tx can
// never leave a club "approved" in the UI with no on-chain payout route.
async function handleApprove(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })
  if (!requireAdmin(req, res, req.body || {})) return
  const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {}
  const code = String(b.clubCode || '').trim().toLowerCase()
  if (!code) return res.status(400).json({ ok: false, error: 'clubCode required' })

  let row
  try {
    const rows = await sb(`/pending_clubs?club_code=eq.${code}&select=*`).then(r => r.json())
    if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ ok: false, error: 'application not found' })
    row = rows[0]
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message })
  }
  if (row.status === 'approved') {
    return res.status(200).json({ ok: true, alreadyApproved: true, clubCode: code })
  }
  if (!isAddr(row.wallet_address) || row.wallet_address.toLowerCase() === ZERO) {
    return res.status(400).json({ ok: false, error: 'application has no valid payout wallet' })
  }

  const txHash = await registerOnChain(code, row.wallet_address)
  if (txHash.error) return res.status(500).json({ ok: false, error: txHash.error })

  await sb('/club_partners', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({
      club_code: code, club_name: row.club_name, wallet_address: row.wallet_address,
      active: true, updated_at: new Date().toISOString(),
    }),
  }).catch(() => {})

  await sb(`/pending_clubs?club_code=eq.${code}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved', decided_at: new Date().toISOString(), tx_hash: txHash.hash }),
  }).catch(() => {})

  return res.status(200).json({ ok: true, clubCode: code, walletAddress: row.wallet_address, txHash: txHash.hash })
}

// Shared on-chain registration. Simulated implicitly by viem, sent from Bank, and the
// receipt status is checked explicitly — viem does NOT throw on an on-chain revert.
async function registerOnChain(code, walletAddress) {
  const pk = process.env.DEPLOYER_PRIVATE_KEY
  if (!pk) return { error: 'DEPLOYER_PRIVATE_KEY not set' }
  try {
    const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`)
    const walletClient = createWalletClient({ account, chain: base, transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org') })
    const publicClient = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org') })
    const hash = await walletClient.writeContract({ address: VOTING_ADDRESS, abi: ABI, functionName: 'setClubWallet', args: [code, walletAddress] })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') return { error: 'setClubWallet reverted on-chain', hash }
    return { hash }
  } catch (e) {
    return { error: e.message }
  }
}

export default async function handler(req, res) {
  const action = (req.query && req.query.action) || ''
  if (action === 'apply')   return handleApply(req, res)
  if (action === 'status')  return handleStatus(req, res)
  if (action === 'pending') return handlePending(req, res)
  if (action === 'approve') return handleApprove(req, res)
  if (action === 'deny')    return handleDeny(req, res)

  if (req.method !== 'POST') return res.status(405).end()
  // Admin-only: this endpoint signs a Bank-wallet (DEPLOYER_PRIVATE_KEY) tx that
  // sets a club's on-chain payout wallet. Without this gate anyone could hijack a
  // club code's 10% payout. Requires a valid admin session token.
  if (!requireAdmin(req, res, req.body || {})) return

  const { clubName, clubCode, walletAddress } = req.body || {}
  if (!clubCode || typeof clubCode !== 'string' || !clubCode.trim()) {
    return res.status(400).json({ ok: false, error: 'clubCode required' })
  }
  if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return res.status(400).json({ ok: false, error: 'Invalid walletAddress' })
  }

  const pk = process.env.DEPLOYER_PRIVATE_KEY
  if (!pk) return res.status(500).json({ ok: false, error: 'DEPLOYER_PRIVATE_KEY not set' })

  const code = clubCode.trim().toLowerCase()

  // 1. Call setClubWallet on-chain
  let txHash
  try {
    const pkHex   = pk.startsWith('0x') ? pk : `0x${pk}`
    const account = privateKeyToAccount(pkHex)
    const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') })
    const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })

    txHash = await walletClient.writeContract({
      address: VOTING_ADDRESS,
      abi: ABI,
      functionName: 'setClubWallet',
      args: [code, walletAddress],
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    // viem does NOT throw on an on-chain revert — check status explicitly so we
    // never report a reverted tx as success.
    if (receipt.status !== 'success') {
      return res.status(500).json({ ok: false, error: 'setClubWallet reverted on-chain', txHash })
    }
  } catch (e) {
    console.error('setClubWallet tx failed:', e)
    return res.status(500).json({ ok: false, error: e.message })
  }

  // 2. Upsert into Supabase club_partners table
  const isDeregistered = walletAddress === '0x0000000000000000000000000000000000000000'
  await fetch(`${SUPABASE_URL}/rest/v1/club_partners`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify({
      club_code:      code,
      club_name:      clubName?.trim() || code,
      wallet_address: walletAddress,
      active:         !isDeregistered,
      updated_at:     new Date().toISOString(),
    }),
  }).catch(() => {})

  return res.status(200).json({ ok: true, clubCode: code, walletAddress, txHash })
}
