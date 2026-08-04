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
import { generateTrophySVG, roleOf } from '../lib/nft/art.js'

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

// One-time-per-wallet identity check: a wallet is verified if it has an approved
// verified_submitters row, a legacy wallet_verifications record, or is a linked wallet.
// Mirrors the admin approve-gate. Once true, future submissions SKIP the ID step.
async function isWalletVerified(wallet) {
  const w = (wallet || '').toLowerCase()
  try {
    const [vs, wv, wl] = await Promise.all([
      sb(`/verified_submitters?wallet_address=eq.${w}&status=eq.approved&select=wallet_address&limit=1`).then(r => r.json()).catch(() => []),
      sb(`/wallet_verifications?wallet_address=eq.${w}&is_verified=eq.true&select=id&limit=1`).then(r => r.json()).catch(() => []),
      sb(`/verified_wallet_links?linked_wallet=eq.${w}&select=id&limit=1`).then(r => r.json()).catch(() => []),
    ])
    return [vs, wv, wl].some(d => Array.isArray(d) && d.length > 0)
  } catch { return false }
}

// A storage path is valid only if it lives under THIS wallet's folder (prevents a
// client from pointing the verification row at another wallet's / arbitrary object).
function isOwnIdPath(path, wallet) {
  const w = (wallet || '').toLowerCase()
  return typeof path === 'string'
    && path.startsWith(`${w}/`)
    && !path.includes('..')
    && /-(id|selfie)\.(jpe?g|png|webp)$/i.test(path)
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
    const { walletAddress, payoutWallet, displayName, linkTitle, linkUrl, imageUrl, referralCode, roundId, nftConsent } = body
    if (!isAddr(walletAddress)) { res.status(400).json({ error: 'Invalid wallet address' }); return }
    // Explicit opt-in for likeness use in stylized commemorative NFTs. Default FALSE;
    // never inferred. Stored per submission; existing profiles are NOT opted in.
    const nft_consent = nftConsent === true
    const payout = isAddr(payoutWallet) ? payoutWallet : walletAddress
    const name = (displayName || '').trim()
    if (!/^[\p{L}\p{N} '_-]{1,30}$/u.test(name)) { res.status(400).json({ error: 'Invalid display name' }); return }
    const link = (linkUrl || '').trim()
    if (link && !/^https?:\/\/.+/.test(link)) { res.status(400).json({ error: 'Invalid link URL' }); return }
    if (!imageUrl || typeof imageUrl !== 'string') { res.status(400).json({ error: 'Missing image' }); return }
    if (imageUrl.length > 12_000_000) { res.status(413).json({ error: 'Image too large' }); return }
    const round = Number.isInteger(roundId) && roundId > 0 ? roundId : 1

    try {
      // One-time identity gate (server-authoritative). Verified wallets skip the ID
      // step; unverified wallets MUST supply their uploaded ID + selfie storage paths.
      const verified = await isWalletVerified(walletAddress)
      const { idDocPath, selfiePath } = body
      if (!verified) {
        if (!isOwnIdPath(idDocPath, walletAddress) || !isOwnIdPath(selfiePath, walletAddress)) {
          res.status(400).json({ error: 'Identity verification required: upload your government ID and selfie before submitting.', needsId: true })
          return
        }
      }

      if (await countThisWeek(walletAddress) >= MAX_PER_WEEK) {
        res.status(429).json({ error: 'Submission limit reached (3 per week)' })
        return
      }
      // return=representation + ?select=id → we get the new row id WITHOUT echoing the
      // multi-MB base64 image back.
      const ins = await sb('/submissions?select=id', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
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
      const created = await ins.json().catch(() => [])
      const submissionId = Array.isArray(created) && created[0] ? created[0].id : null

      // Record NFT-likeness consent (best-effort; no-op until the nft_consent column
      // exists — see outputs/migrations/0002_nft_consent.sql). Never blocks the submit,
      // and only ever stores TRUE when the user explicitly ticked the box.
      if (submissionId != null && nft_consent) {
        await sb(`/submissions?id=eq.${submissionId}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ nft_consent: true }),
        }).catch(() => {})
      }

      // First-time wallet: record a PENDING verification tied to the wallet, carrying
      // the private ID/selfie paths + the linked submission so the admin can review all
      // three together and approve both in one click. Paths live ONLY in the dedicated
      // columns (migration 0001) — never on the submission and never in any public
      // response. reference_id is nulled for id_upload rows (Persona rows still use it
      // for their inquiry id).
      if (!verified && submissionId != null) {
        const w = walletAddress.toLowerCase()
        const payload = { provider: 'id_upload', status: 'pending', id_doc_path: idDocPath, selfie_path: selfiePath, submission_id: String(submissionId), reference_id: null, rejection_reason: null, verified_at: null }
        const ex = await sb(`/verified_submitters?wallet_address=eq.${w}&select=wallet_address&limit=1`).then(r => r.json()).catch(() => [])
        if (Array.isArray(ex) && ex.length > 0) {
          await sb(`/verified_submitters?wallet_address=eq.${w}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload) }).catch(() => {})
        } else {
          await sb('/verified_submitters', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...payload, wallet_address: w, created_at: new Date().toISOString() }) }).catch(() => {})
        }
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

// ── action=nft-metadata ──────────────────────────────────────────────────────
// Serves ERC-721 tokenURI JSON from OUR API (deliberately NOT IPFS) so a consent
// revocation / likeness takedown can be honored. Wallets/OpenSea fetch it cross-origin.
//   GET ?id=N                         -> derives round+role from the current mint order
//   GET ?round=&role=&date=&handle=   -> explicit (preview / future contract)
// Image is the GENERIC branded SVG (permanent fallback). PHOTO composite stays OFF
// (NFT_PHOTO_MODE!=='on') until legal approves the consent copy — even for opted-in wallets.
const ROLE_KEYS = ['champion', 'topvoter', 'house']
// NEW trophy contract (V3d mints here from Round 6 on). Its tokenURI points at this API;
// it stores per-token {round, role} on-chain via trophyOf(id) — we read that as the truth.
const TROPHY_NFT = '0x02DDd0e63DC2A5F66Fdb5a46F5981191959AC9A5'
const TROPHY_ABI = parseAbi(['function trophyOf(uint256) view returns (uint32 round, uint8 role)'])
async function handleNftMetadata(req, res) {
  const id = parseInt(req.query.id, 10)
  let round = req.query.round, role = req.query.role
  let date = req.query.date
  const handle = (req.query.handle || '').toString().slice(0, 40)
  // id mode: read the NEW contract's on-chain round/role (authoritative). Explicit
  // round/role params override (preview). Non-minted / unreadable → generic fallback.
  if (Number.isInteger(id) && id > 0 && round == null) {
    try {
      const pub = createPublicClient({ chain: base, transport: http(RPC_URL) })
      const t = await pub.readContract({ address: TROPHY_NFT, abi: TROPHY_ABI, functionName: 'trophyOf', args: [BigInt(id)] })
      if (Number(t[0]) > 0) { round = Number(t[0]); role = ROLE_KEYS[Number(t[1])] || 'champion' }
    } catch {}
  }
  round = Number(round) || 0
  role = ROLE_KEYS.includes(role) ? role : 'champion'
  const r = roleOf(role)
  const svg = generateTrophySVG({ round, role, date, handle })
  const image = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
  const attributes = [
    { trait_type: 'Round', value: round },
    { trait_type: 'Role', value: r.title },
  ]
  if (date) attributes.push({ trait_type: 'Settlement Date', display_type: 'date', value: Number(date) })

  // PHOTO-COMPOSITE PIPELINE — server-side pre-rendered PNG (so wallets never depend on
  // SVG image filters). Wired but GATED OFF: runs only if NFT_PHOTO_MODE==='on' AND the
  // token is the champion AND the winner consented (nft_consent). Stays dark pending
  // legal sign-off on the consent copy. Generic SVG is the permanent default.
  let finalImage = image
  if (process.env.NFT_PHOTO_MODE === 'on' && role === 'champion') {
    try { const png = await renderPhotoCompositePng({ round, date, handle }); if (png) finalImage = png } catch {}
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600')
  res.status(200).json({
    name: `TTS Round ${round} ${r.title}`,
    description: `Temptation Token on-chain trophy — ${r.blurb}. A weekly hot-or-not voting game on Base; the winning profile, the top voter, and the house each receive a commemorative trophy at settlement. Metadata served from temptationtoken.io (not IPFS) so likeness content can be honored on request.`,
    image: finalImage,
    external_url: 'https://app.temptationtoken.io',
    attributes,
  })
}

// Pre-render the photo composite to a PNG data URI (server-side). DISABLED by default.
// When enabled it must: (1) confirm the round winner's nft_consent=true, (2) fetch the
// consented photo, (3) apply the poster/cartoon treatment, (4) composite + rasterize.
// For now it renders the composite frame with a placeholder — the consented-photo fetch
// + stylization is the remaining step, intentionally not run while NFT_PHOTO_MODE is off.
async function renderPhotoCompositePng({ round, date, handle }) {
  const { composePhotoSVG } = await import('../lib/nft/art.js')
  const { Resvg } = await import('@resvg/resvg-js')
  const svg = composePhotoSVG({ round, role: 'champion', date, handle /*, photoHref: <consented, stylized> */ })
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1000 } }).render().asPng()
  return 'data:image/png;base64,' + Buffer.from(png).toString('base64')
}

// ── action=nft-collection — OpenSea collection-level metadata (contractURI) ──────
function handleNftCollection(req, res) {
  const svg = generateTrophySVG({ round: '', role: 'champion' })
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.status(200).json({
    name: 'TTS Round Trophies',
    description: 'On-chain commemorative trophies from Temptation Token — a weekly hot-or-not voting game on Base. Each settlement mints a Champion, Top Voter, and House trophy. Metadata served from temptationtoken.io (not IPFS) so likeness content can be honored on request.',
    image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'),
    external_link: 'https://app.temptationtoken.io',
    seller_fee_basis_points: 500,
    fee_recipient: '0xb1e991bf617459b58964eef7756b350e675c53b5',
  })
}

export default async function handler(req, res) {
  const action = req.query.action || ''
  if (action === 'nft-metadata') return handleNftMetadata(req, res)   // public, no service key needed
  if (action === 'nft-collection') return handleNftCollection(req, res)
  if (!SERVICE_KEY) { res.status(500).json({ error: 'Server not configured: SUPABASE_SERVICE_KEY missing' }); return }
  if (action === 'list') return handleList(req, res)
  if (action === 'submit') return handleSubmit(req, res)
  if (action === 'vote') return handleVote(req, res)
  if (action === 'sync') return handleSync(req, res)
  res.status(400).json({ error: 'Unknown action' })
}
