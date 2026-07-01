// /api/bonus  — consolidated incentive-payout endpoint (routes via ?action=)
//   ?action=signup      POST { walletAddress }                    -> { success, amount, txHash }
//   ?action=vote-match  POST { walletAddress, voteAmount, txHash } -> { success, matchAmount, txHash }
//   ?action=referral      POST { refereeWallet, qualifyingAmount, qualifyingTx } -> { ok, ... }
//   ?action=refer-capture POST { referrerWallet, refereeWallet, source }         -> { ok }
//
// vercel.json rewrites preserve the original URLs:
//   /api/signup-bonus    -> /api/bonus?action=signup
//   /api/vote-match      -> /api/bonus?action=vote-match
//   /api/referral-credit -> /api/bonus?action=referral
//
// signup + vote-match pay from the Marketing wallet (MARKETING_WALLET_PRIVATE_KEY).
// REFERRAL pays ONLY from REFERRAL_WALLET_PRIVATE_KEY — never the Bank/DEPLOYER key.
// Abuse-defense decision logic lives in ./_lib/referral.js (pure + unit-tested).

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { evaluateReferralPayout, REFERRAL_DEFAULTS } from './_lib/referral.js'

const TTS_ADDRESS  = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
// Program/treasury wallets — qualifying TTS must NOT originate here (anti-sybil).
const MARKETING_WALLET = '0x7a9ff2f584248744cBbA32c737D660ED6f077fCB'
const BANK_WALLET      = '0xb1e991bf617459b58964eef7756b350e675c53b5'
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || '')
// Funding checks use the Alchemy endpoint (public RPC can't serve wide log/transfer
// queries). BASE_RPC_URL must be the Alchemy URL in prod; falls back to public.
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const TTS_DEPLOY_BLOCK = 43851235n // first block with TTS code — bounds funding-history scans (no history exists before it)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

const DEFAULT_SIGNUP_BONUS = 500
const DEFAULT_MAX_MATCH    = 1000
const SIGNUP_DAY_LIMIT     = 20
const MATCH_DAY_LIMIT      = 50

const TTS_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
])

function sb(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  })
}

function parseBody(req) {
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  return body || {}
}

async function getAdminConfig(key, defaultValue) {
  try {
    const r = await sb(`/admin_config?key=eq.${key}&select=value`)
    const d = await r.json()
    if (Array.isArray(d) && d.length > 0 && d[0].value) {
      const parsed = parseFloat(d[0].value)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  } catch {}
  return defaultValue
}

async function dailyCount(bonusType) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const r = await sb(`/bonus_claims?bonus_type=eq.${bonusType}&created_at=gte.${today}T00:00:00Z&select=id`)
    const d = await r.json()
    return Array.isArray(d) ? d.length : 0
  } catch { return 0 }
}

// Normalize a hex private key and send a TTS transfer, retrying once.
async function sendTTS(pk, to, amount, label) {
  const pkClean = pk.trim().replace(/^["'`]|["'`]$/g, '').replace(/\s/g, '').trim()
  const pkHex = pkClean.startsWith('0x') ? pkClean : `0x${pkClean}`
  if (!/^[0-9a-fA-F]{64}$/.test(pkHex.slice(2))) {
    const err = new Error('Private key is invalid — must be 64 hex chars (32 bytes).')
    err.badKey = true
    throw err
  }
  const account = privateKeyToAccount(pkHex)
  const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') })
  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
  let lastErr
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 3000))
      const txHash = await walletClient.writeContract({
        address: TTS_ADDRESS, abi: TTS_ABI, functionName: 'transfer', args: [to, amount],
      })
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      return txHash
    } catch (e) {
      lastErr = e
      console.error(`${label} tx attempt ${attempt + 1} failed:`, e.message)
    }
  }
  throw lastErr
}

// ── action=signup ──────────────────────────────────────────────────────────
async function handleSignup(req, res, body) {
  const { walletAddress } = body
  if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return res.status(400).json({ success: false, reason: 'Invalid wallet address' })
  }
  const pk = process.env.MARKETING_WALLET_PRIVATE_KEY
  if (!pk) return res.status(200).json({ success: false, reason: 'Bonus system not yet funded — contact admin' })

  try {
    const r = await sb(`/bonus_claims?wallet_address=eq.${walletAddress}&bonus_type=eq.signup&select=id&limit=1`)
    const d = await r.json()
    if (Array.isArray(d) && d.length > 0) return res.status(200).json({ alreadyClaimed: true })
  } catch {}

  if (await dailyCount('signup') >= SIGNUP_DAY_LIMIT) {
    return res.status(200).json({ success: false, reason: 'Daily bonus limit reached — try again tomorrow' })
  }

  const bonusTTS = await getAdminConfig('signup_bonus_tts', DEFAULT_SIGNUP_BONUS)
  const ttsAmount = BigInt(Math.floor(bonusTTS * 1e18))

  let txHash
  try {
    txHash = await sendTTS(pk, walletAddress, ttsAmount, 'signup-bonus')
  } catch (e) {
    if (e.badKey) return res.status(500).json({ success: false, reason: 'MARKETING_WALLET_PRIVATE_KEY is invalid — must be 64 hex chars. Update in Vercel env vars.' })
    return res.status(500).json({ success: false, reason: e.message })
  }

  await sb('/bonus_claims', {
    method: 'POST',
    body: JSON.stringify({ wallet_address: walletAddress, bonus_type: 'signup', tts_amount: bonusTTS, tx_hash: txHash, created_at: new Date().toISOString() }),
  }).catch(() => {})
  await sb('/users', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ wallet_address: walletAddress, created_at: new Date().toISOString() }),
  }).catch(() => {})

  return res.status(200).json({ success: true, amount: bonusTTS, txHash })
}

// ── action=vote-match ──────────────────────────────────────────────────────
async function handleVoteMatch(req, res, body) {
  const { walletAddress, voteAmount, txHash } = body
  if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return res.status(400).json({ success: false, reason: 'Invalid wallet address' })
  }
  if (!voteAmount || isNaN(Number(voteAmount)) || Number(voteAmount) <= 0) {
    return res.status(400).json({ success: false, reason: 'Invalid vote amount' })
  }
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return res.status(400).json({ success: false, reason: 'Invalid txHash — must be a valid 64-char hex transaction hash' })
  }
  const pk = process.env.MARKETING_WALLET_PRIVATE_KEY
  if (!pk) return res.status(200).json({ success: false, reason: 'Match system not yet funded — contact admin' })

  try {
    const r = await sb(`/bonus_claims?wallet_address=eq.${walletAddress}&bonus_type=eq.vote_match&select=id&limit=1`)
    const d = await r.json()
    if (Array.isArray(d) && d.length > 0) {
      return res.status(200).json({ success: false, alreadyClaimed: true, reason: 'First-vote match already used' })
    }
  } catch {}

  if (await dailyCount('vote_match') >= MATCH_DAY_LIMIT) {
    return res.status(200).json({ success: false, reason: 'Daily match limit reached — try again tomorrow' })
  }

  const maxMatch = await getAdminConfig('vote_match_cap_tts', DEFAULT_MAX_MATCH)
  const matchAmount = Math.min(Math.max(0, Number(voteAmount)), maxMatch)
  const ttsAmount = BigInt(Math.floor(matchAmount * 1e18))
  if (ttsAmount === 0n) return res.status(400).json({ success: false, reason: 'Vote amount too small to match' })

  let matchTxHash
  try {
    matchTxHash = await sendTTS(pk, walletAddress, ttsAmount, 'vote-match')
  } catch (e) {
    if (e.badKey) return res.status(500).json({ success: false, reason: 'MARKETING_WALLET_PRIVATE_KEY is invalid — must be 64 hex chars. Update in Vercel env vars.' })
    return res.status(500).json({ success: false, reason: e.message })
  }

  await sb('/bonus_claims', {
    method: 'POST',
    body: JSON.stringify({ wallet_address: walletAddress, bonus_type: 'vote_match', tts_amount: matchAmount, usd_value: null, tx_hash: matchTxHash, original_tx: txHash || null, created_at: new Date().toISOString() }),
  }).catch(() => {})

  return res.status(200).json({ success: true, matchAmount, txHash: matchTxHash })
}

// ── action=referral ────────────────────────────────────────────────────────
// ── action=refer-capture ───────────────────────────────────────────────────
// Records a referrer→referee link. No funds move here. Safe to run while the
// program is disabled (just builds the graph). Referee is unique in the table.
async function handleReferCapture(req, res, body) {
  const referrer = (body.referrerWallet || '').trim()
  const referee  = (body.refereeWallet || '').trim()
  const source   = body.source === 'bot' ? 'bot' : 'web'
  if (!isAddr(referrer) || !isAddr(referee)) return res.status(400).json({ ok: false, error: 'invalid wallet(s)' })
  if (referrer.toLowerCase() === referee.toLowerCase()) return res.status(200).json({ ok: false, skipped: 'self-referral' })
  try {
    // Insert only if this referee has never been captured (unique index).
    const r = await sb('/referrals', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify({ referrer_wallet: referrer, referee_wallet: referee, source, status: 'pending', created_at: new Date().toISOString() }),
    })
    if (!r.ok) {
      // 409 = referee already captured (bound to its original referrer — anti-hijack). Benign.
      if (r.status === 409) return res.status(200).json({ ok: false, skipped: 'referee already referred' })
      return res.status(200).json({ ok: false, error: 'capture failed' })
    }
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(502).json({ ok: false, error: 'capture failed' })
  }
}

// ── action=referral ────────────────────────────────────────────────────────
// Qualify + pay a referral. Pays ONLY from REFERRAL_WALLET_PRIVATE_KEY. Every
// abuse defense is evaluated by evaluateReferralPayout() before any send.
async function handleReferral(req, res, body) {
  const referee = (body.refereeWallet || body.newUserWallet || '').trim()
  const qualifyingAmount = Number(body.qualifyingAmount || 0)
  const qualifyingTx = body.qualifyingTx || null
  if (!isAddr(referee)) return res.status(400).json({ ok: false, error: 'invalid referee wallet' })

  // Settings (defaults are safe-OFF; see referral_setup.sql)
  let s = {}
  try {
    const r = await sb('/referral_settings?id=eq.1&select=*&limit=1')
    const d = await r.json()
    if (Array.isArray(d) && d.length > 0) s = d[0]
  } catch {}
  const enabled       = s.referral_enabled === true
  const bonusAmount   = num(s.referrer_bonus_tts, REFERRAL_DEFAULTS.referrerBonusTts)
  const minQualifying = num(s.min_qualifying_vote_tts, REFERRAL_DEFAULTS.minQualifyingVoteTts)
  const perCap        = num(s.per_referrer_daily_cap, REFERRAL_DEFAULTS.perReferrerDailyCap)
  const progCap       = num(s.program_daily_cap_tts, REFERRAL_DEFAULTS.programDailyCapTts)
  const reserveFloor  = num(s.reserve_floor_tts, REFERRAL_DEFAULTS.reserveFloorTts)

  // CRITICAL: dedicated wallet only — NEVER the Bank/DEPLOYER key.
  const pk = process.env.REFERRAL_WALLET_PRIVATE_KEY
  const hasReferralKey = !!pk

  // Find the referrer for this referee.
  let referrer = null
  try {
    const r = await sb(`/referrals?referee_wallet=eq.${referee}&select=referrer_wallet&limit=1`)
    const d = await r.json()
    referrer = d?.[0]?.referrer_wallet || null
  } catch {}

  // Gather decision inputs (only meaningful once enabled + key + referrer exist;
  // evaluate() still short-circuits correctly on disabled/no-key first).
  let alreadyPaid = false, referrerPaidToday = 0, programPaidTodayTts = 0
  let walletBalanceTts = 0
  let funding = { fromReferrer: false, fromProgram: false, fromSignupBonus: false }
  let fundingUnverified = false
  const fundingDiag = {}

  if (enabled && hasReferralKey && referrer) {
    const today = new Date().toISOString().split('T')[0]

    // 1) Ledger + bonus checks. Fail CLOSED on a non-2xx (e.g. referral_credits
    //    schema mismatch) instead of silently passing — a silent pass here would
    //    break the double-pay / daily-cap guards.
    try {
      const [paidRes, refTodayRes, progTodayRes, bonusRes] = await Promise.all([
        sb(`/referral_credits?referee_wallet=eq.${referee}&select=id&limit=1`),
        sb(`/referral_credits?referrer_wallet=eq.${referrer}&created_at=gte.${today}T00:00:00Z&select=id`),
        sb(`/referral_credits?created_at=gte.${today}T00:00:00Z&select=amount_tts`),
        sb(`/bonus_claims?wallet_address=eq.${referee}&select=id&limit=1`),
      ])
      const bad = [['referral_credits', paidRes], ['referral_credits', refTodayRes], ['referral_credits', progTodayRes], ['bonus_claims', bonusRes]].find(([, r]) => !r.ok)
      if (bad) { fundingUnverified = true; fundingDiag.ledger = `${bad[0]} HTTP ${bad[1].status}` }
      const paidJson = await paidRes.json(); alreadyPaid = Array.isArray(paidJson) && paidJson.length > 0
      const refJson = await refTodayRes.json(); referrerPaidToday = Array.isArray(refJson) ? refJson.length : 0
      const prog = await progTodayRes.json(); programPaidTodayTts = Array.isArray(prog) ? prog.reduce((a, x) => a + (Number(x.amount_tts) || 0), 0) : 0
      const bonusJson = await bonusRes.json(); funding.fromSignupBonus = Array.isArray(bonusJson) && bonusJson.length > 0
    } catch (e) { fundingUnverified = true; fundingDiag.ledger = 'throw: ' + String(e.message || e).slice(0, 80) }

    // 2) On-chain funding source — full TTS transfer history to the referee via
    //    Alchemy getAssetTransfers, bounded at the TTS deploy block (NOT 'earliest';
    //    no TTS transfer can predate it, so nothing is missed — no anti-sybil
    //    weakening). If ANY inbound TTS came from the referrer or a program wallet,
    //    the referee is not self-funded → disqualified. Fail CLOSED on error.
    try {
      let pageKey, guard = 0
      do {
        const params = { fromBlock: '0x' + TTS_DEPLOY_BLOCK.toString(16), toBlock: 'latest', toAddress: referee, contractAddresses: [TTS_ADDRESS], category: ['erc20'], withMetadata: false, excludeZeroValue: false, maxCount: '0x3e8' }
        if (pageKey) params.pageKey = pageKey
        const r = await fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'alchemy_getAssetTransfers', params: [params] }) })
        const j = await r.json()
        if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 80))
        for (const t of (j.result?.transfers || [])) {
          const from = (t.from || '').toLowerCase()
          if (from === referrer.toLowerCase()) funding.fromReferrer = true
          if (from === MARKETING_WALLET.toLowerCase() || from === BANK_WALLET.toLowerCase()) funding.fromProgram = true
        }
        pageKey = j.result?.pageKey
      } while (pageKey && ++guard < 20)
    } catch (e) { fundingUnverified = true; fundingDiag.assetTransfers = String(e.message || e).slice(0, 100) }

    // 3) Referral wallet balance vs reserve floor.
    try {
      const acct = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`)
      const pub = createPublicClient({ chain: base, transport: http(RPC_URL) })
      const bal = await pub.readContract({ address: TTS_ADDRESS, abi: TTS_ABI, functionName: 'balanceOf', args: [acct.address] })
      walletBalanceTts = Number(bal) / 1e18
    } catch (e) { fundingUnverified = true; fundingDiag.balance = String(e.message || e).slice(0, 80) }
  }

  // Fail CLOSED if we couldn't verify funding/balance (only matters when we'd otherwise pay).
  if (enabled && hasReferralKey && referrer && fundingUnverified) {
    return res.status(200).json({ ok: false, skipped: 'could not verify funding source / balance — refusing', diag: fundingDiag })
  }
  if ((enabled && hasReferralKey) && !referrer) {
    return res.status(200).json({ ok: false, skipped: 'no referral on record for this wallet' })
  }

  const decision = evaluateReferralPayout({
    enabled, hasReferralKey, referrer, referee,
    qualifyingAmount, minQualifying,
    funding, alreadyPaid,
    referrerPaidToday, perReferrerDailyCap: perCap,
    programPaidTodayTts, programDailyCapTts: progCap,
    bonusAmount, walletBalanceTts, reserveFloorTts: reserveFloor,
  })
  if (!decision.allow) return res.status(200).json({ ok: false, skipped: decision.reason })

  // PAY — from the dedicated referral wallet only.
  let txHash
  try {
    txHash = await sendTTS(pk, referrer, BigInt(Math.floor(bonusAmount * 1e18)), 'referral')
  } catch (e) {
    if (e.badKey) return res.status(500).json({ ok: false, error: 'REFERRAL_WALLET_PRIVATE_KEY invalid — must be 64 hex chars' })
    return res.status(500).json({ ok: false, error: e.message })
  }

  // Ledger insert (UNIQUE(referee) is the hard double-payout guarantee).
  await sb('/referral_credits', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ referee_wallet: referee, referrer_wallet: referrer, amount_tts: bonusAmount, qualifying_tx: qualifyingTx, tx_hash: txHash, created_at: new Date().toISOString() }),
  }).catch(() => {})
  await sb(`/referrals?referee_wallet=eq.${referee}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString() }),
  }).catch(() => {})

  return res.status(200).json({ ok: true, referrer, amount: bonusAmount, txHash })
}

function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const action = req.query.action || ''
  const body = parseBody(req)
  if (action === 'signup') return handleSignup(req, res, body)
  if (action === 'vote-match') return handleVoteMatch(req, res, body)
  if (action === 'refer-capture') return handleReferCapture(req, res, body)
  if (action === 'referral') return handleReferral(req, res, body)
  return res.status(400).json({ error: 'Unknown action' })
}
