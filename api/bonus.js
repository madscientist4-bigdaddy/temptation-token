// /api/bonus  — consolidated incentive-payout endpoint (routes via ?action=)
//   ?action=signup      POST { walletAddress }                    -> { success, amount, txHash }
//   ?action=vote-match  POST { walletAddress, voteAmount, txHash } -> { success, matchAmount, txHash }
//   ?action=referral    POST { newUserWallet }                     -> { ok, ... }
//
// vercel.json rewrites preserve the original URLs:
//   /api/signup-bonus    -> /api/bonus?action=signup
//   /api/vote-match      -> /api/bonus?action=vote-match
//   /api/referral-credit -> /api/bonus?action=referral
//
// signup + vote-match pay from the Marketing wallet (MARKETING_WALLET_PRIVATE_KEY).
// referral pays from the house/Deployer wallet (DEPLOYER_PRIVATE_KEY).

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const TTS_ADDRESS  = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
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
async function handleReferral(req, res, body) {
  const { newUserWallet } = body
  if (!newUserWallet || !/^0x[0-9a-fA-F]{40}$/.test(newUserWallet)) {
    return res.status(400).json({ error: 'Invalid wallet' })
  }

  // Live referral settings
  let creditAmount = 100n * 10n ** 18n
  let enabled = true
  try {
    const r = await sb('/referral_settings?id=eq.1&select=*&limit=1')
    const d = await r.json()
    if (Array.isArray(d) && d.length > 0) {
      enabled = d[0].referral_enabled !== false
      creditAmount = BigInt(Math.floor((d[0].referrer_bonus || 100) * 1e18))
    }
  } catch {}
  if (!enabled) return res.status(200).json({ ok: true, skipped: 'referral program disabled' })

  const pk = process.env.DEPLOYER_PRIVATE_KEY
  if (!pk) return res.status(500).json({ error: 'DEPLOYER_PRIVATE_KEY not set' })

  const subRes = await sb(`/submissions?wallet_address=eq.${newUserWallet}&select=referral_code&limit=1`)
  const subs = await subRes.json()
  const referralCode = subs?.[0]?.referral_code
  if (!referralCode) return res.status(200).json({ ok: true, skipped: 'no referral code' })

  const refRes = await sb(`/referrals?code=eq.${encodeURIComponent(referralCode)}&select=wallet_address&limit=1`)
  const refs = await refRes.json()
  const referrerWallet = refs?.[0]?.wallet_address
  if (!referrerWallet) return res.status(200).json({ ok: true, skipped: 'referral code not found' })

  const creditCheck = await sb(`/referral_credits?new_user_wallet=eq.${newUserWallet}&select=id&limit=1`)
  const existing = await creditCheck.json()
  if (existing?.length > 0) return res.status(200).json({ ok: true, skipped: 'already credited' })

  let txHash
  try {
    txHash = await sendTTS(pk, referrerWallet, creditAmount, 'referral-credit')
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }

  await sb('/referral_credits', {
    method: 'POST',
    body: JSON.stringify({
      new_user_wallet: newUserWallet,
      referrer_wallet: referrerWallet,
      referral_code: referralCode,
      amount_tts: Number(creditAmount) / 1e18,
      tx_hash: txHash,
      created_at: new Date().toISOString(),
    }),
  }).catch(() => {})

  return res.status(200).json({ ok: true, referrerWallet, txHash, amount: `${Number(creditAmount) / 1e18} TTS` })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const action = req.query.action || ''
  const body = parseBody(req)
  if (action === 'signup') return handleSignup(req, res, body)
  if (action === 'vote-match') return handleVoteMatch(req, res, body)
  if (action === 'referral') return handleReferral(req, res, body)
  return res.status(400).json({ error: 'Unknown action' })
}
