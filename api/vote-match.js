// POST /api/vote-match
// Body: { walletAddress, voteAmount, txHash }
// First-vote match: matches up to 1,000 TTS on wallet's first ever vote.
// Records in bonus_claims table. Uses MARKETING_WALLET_PRIVATE_KEY.

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const TTS_ADDRESS      = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const MARKETING_WALLET = '0x7a9ff2f584248744cBbA32c737D660ED6f077fCB'
const SUPABASE_URL     = process.env.SUPABASE_URL    || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const MAX_MATCH        = 1000   // TTS cap on first-vote match
const DAY_LIMIT        = 50     // max vote-match bonuses per day

const TTS_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
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

async function getDailyCount() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const r = await sb(`/bonus_claims?bonus_type=eq.vote_match&created_at=gte.${today}T00:00:00Z&select=id`)
    const d = await r.json()
    return Array.isArray(d) ? d.length : 0
  } catch { return 0 }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { walletAddress, voteAmount, txHash } = req.body || {}
  if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return res.status(400).json({ success: false, reason: 'Invalid wallet address' })
  }
  if (!voteAmount || isNaN(Number(voteAmount)) || Number(voteAmount) <= 0) {
    return res.status(400).json({ success: false, reason: 'Invalid vote amount' })
  }

  const pk = process.env.MARKETING_WALLET_PRIVATE_KEY
  if (!pk) {
    return res.status(200).json({ success: false, reason: 'Match system not yet funded — contact admin' })
  }

  // Check already received a vote match
  try {
    const r = await sb(`/bonus_claims?wallet_address=eq.${walletAddress}&bonus_type=eq.vote_match&select=id&limit=1`)
    const d = await r.json()
    if (Array.isArray(d) && d.length > 0) {
      return res.status(200).json({ success: false, alreadyClaimed: true, reason: 'First-vote match already used' })
    }
  } catch {}

  // Rate limit
  const dailyCount = await getDailyCount()
  if (dailyCount >= DAY_LIMIT) {
    return res.status(200).json({ success: false, reason: 'Daily match limit reached — try again tomorrow' })
  }

  // Match amount: min(voteAmount, MAX_MATCH)
  const voteAmountNum = Math.max(0, Number(voteAmount))
  const matchAmount   = Math.min(voteAmountNum, MAX_MATCH)
  const ttsAmount     = BigInt(Math.floor(matchAmount * 1e18))

  if (ttsAmount === 0n) {
    return res.status(400).json({ success: false, reason: 'Vote amount too small to match' })
  }

  // Send TTS from Marketing wallet
  const pkClean = pk.trim().replace(/^["']|["']$/g, '').trim()
  const pkHex = pkClean.startsWith('0x') ? pkClean : `0x${pkClean}`
  let matchTxHash
  try {
    const account      = privateKeyToAccount(pkHex)
    const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') })
    const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
    matchTxHash = await walletClient.writeContract({
      address: TTS_ADDRESS, abi: TTS_ABI, functionName: 'transfer',
      args: [walletAddress, ttsAmount],
    })
    await publicClient.waitForTransactionReceipt({ hash: matchTxHash })
  } catch (e) {
    console.error('vote-match tx failed:', e)
    return res.status(500).json({ success: false, reason: e.message })
  }

  // Record in bonus_claims
  await sb('/bonus_claims', {
    method: 'POST',
    body: JSON.stringify({
      wallet_address: walletAddress,
      bonus_type:    'vote_match',
      tts_amount:    matchAmount,
      usd_value:     null,
      tx_hash:       matchTxHash,
      original_tx:   txHash || null,
      created_at:    new Date().toISOString(),
    }),
  }).catch(() => {})

  return res.status(200).json({
    success:     true,
    matchAmount,
    txHash:      matchTxHash,
  })
}
