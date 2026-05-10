// POST /api/signup-bonus
// Body: { walletAddress }
// Sends a fixed TTS amount (default 500, admin-configurable via admin_config table)
// from Marketing wallet to new users on first connect.
// Records in bonus_claims table. Rate-limited to 20/day.

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const TTS_ADDRESS     = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const MARKETING_WALLET = '0x7a9ff2f584248744cBbA32c737D660ED6f077fCB'
const SUPABASE_URL    = process.env.SUPABASE_URL    || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const DEFAULT_BONUS   = 500     // TTS — canonical default, admin-overridable
const DAY_LIMIT       = 20

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

async function getDailyCount() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const r = await sb(`/bonus_claims?bonus_type=eq.signup&created_at=gte.${today}T00:00:00Z&select=id`)
    const d = await r.json()
    return Array.isArray(d) ? d.length : 0
  } catch { return 0 }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { walletAddress } = req.body || {}
  if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return res.status(400).json({ success: false, reason: 'Invalid wallet address' })
  }

  const pk = process.env.MARKETING_WALLET_PRIVATE_KEY
  if (!pk) {
    return res.status(200).json({ success: false, reason: 'Bonus system not yet funded — contact admin' })
  }

  // Check already claimed
  try {
    const r = await sb(`/bonus_claims?wallet_address=eq.${walletAddress}&bonus_type=eq.signup&select=id&limit=1`)
    const d = await r.json()
    if (Array.isArray(d) && d.length > 0) return res.status(200).json({ alreadyClaimed: true })
  } catch {}

  // Rate limit
  const dailyCount = await getDailyCount()
  if (dailyCount >= DAY_LIMIT) {
    return res.status(200).json({ success: false, reason: 'Daily bonus limit reached — try again tomorrow' })
  }

  // Read admin-configurable bonus amount (fixed TTS, not USD-pegged)
  const bonusTTS = await getAdminConfig('signup_bonus_tts', DEFAULT_BONUS)
  const ttsAmount = BigInt(Math.floor(bonusTTS * 1e18))

  // Send TTS from Marketing wallet
  const pkClean = pk.trim().replace(/^["'`]|["'`]$/g, '').replace(/\s/g, '').trim()
  const pkHex = pkClean.startsWith('0x') ? pkClean : `0x${pkClean}`
  const hexBody = pkHex.slice(2)
  if (!/^[0-9a-fA-F]{64}$/.test(hexBody)) {
    return res.status(500).json({
      success: false,
      reason: 'MARKETING_WALLET_PRIVATE_KEY is invalid — must be 64 hex chars (32 bytes). Export the private key from MetaMask and update in Vercel env vars.'
    })
  }
  const account = privateKeyToAccount(pkHex)
  const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') })
  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
  let txHash, lastErr
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 3000))
      txHash = await walletClient.writeContract({
        address: TTS_ADDRESS, abi: TTS_ABI, functionName: 'transfer',
        args: [walletAddress, ttsAmount],
      })
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      lastErr = null
      break
    } catch (e) {
      lastErr = e
      console.error(`signup-bonus tx attempt ${attempt + 1} failed:`, e.message)
    }
  }
  if (lastErr) return res.status(500).json({ success: false, reason: lastErr.message })

  // Record in bonus_claims
  await sb('/bonus_claims', {
    method: 'POST',
    body: JSON.stringify({
      wallet_address: walletAddress,
      bonus_type: 'signup',
      tts_amount: bonusTTS,
      tx_hash: txHash,
      created_at: new Date().toISOString(),
    }),
  }).catch(() => {})

  // Upsert into users table
  await sb('/users', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ wallet_address: walletAddress, created_at: new Date().toISOString() }),
  }).catch(() => {})

  return res.status(200).json({
    success: true,
    amount: bonusTTS,
    txHash,
  })
}
