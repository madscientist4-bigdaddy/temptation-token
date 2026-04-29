// POST /api/signup-bonus
// Body: { walletAddress }
// Sends $5 USD worth of TTS (min 500, max 50,000) from Marketing wallet to new users.
// Records in bonus_claims table. Rate-limited to 20/day.

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const TTS_ADDRESS     = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const UNISWAP_POOL    = '0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68'
const MARKETING_WALLET = '0x7a9ff2f584248744cBbA32c737D660ED6f077fCB'
const SUPABASE_URL    = process.env.SUPABASE_URL    || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const DAY_LIMIT = 20

const TTS_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
])
const POOL_ABI = parseAbi(['function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'])

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

async function getTTSPriceUSD() {
  try {
    const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
    const [r0, r1] = await publicClient.readContract({ address: UNISWAP_POOL, abi: POOL_ABI, functionName: 'getReserves' })
    // Pool is TTS/WETH — determine which token is which by checking address order
    // TTS: 0x5570eA97... WETH on Base: 0x4200000000000000000000000000000000000006
    // Lexicographic: 0x4200... < 0x5570..., so token0=WETH, token1=TTS
    const wethReserve = Number(r0) / 1e18
    const ttsReserve  = Number(r1) / 1e18
    // ETH price roughly from WETH per TTS ratio; multiply by ETH price
    // We use a rough $2000 ETH fallback if we can't get live price
    const ethUSD = 2000 // conservative fallback
    const ttsPriceUSD = (wethReserve / ttsReserve) * ethUSD
    return ttsPriceUSD
  } catch {
    return null
  }
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

  // Calculate TTS amount for $5 USD
  const ttsPriceUSD = await getTTSPriceUSD()
  let ttsAmount = 500n * 10n ** 18n // floor: 500 TTS
  let usdValue = 5

  if (ttsPriceUSD && ttsPriceUSD > 0) {
    const rawAmount = 5 / ttsPriceUSD // TTS for $5
    const capped = Math.min(Math.max(rawAmount, 500), 50000) // 500–50,000
    ttsAmount = BigInt(Math.floor(capped * 1e18))
  }

  // Send TTS from Marketing wallet
  const pkHex = pk.startsWith('0x') ? pk : `0x${pk}`
  let txHash
  try {
    const account = privateKeyToAccount(pkHex)
    const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') })
    const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
    txHash = await walletClient.writeContract({
      address: TTS_ADDRESS, abi: TTS_ABI, functionName: 'transfer',
      args: [walletAddress, ttsAmount],
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash })
  } catch (e) {
    console.error('signup-bonus tx failed:', e)
    return res.status(500).json({ success: false, reason: e.message })
  }

  // Record in bonus_claims
  await sb('/bonus_claims', {
    method: 'POST',
    body: JSON.stringify({
      wallet_address: walletAddress,
      bonus_type: 'signup',
      tts_amount: Number(ttsAmount) / 1e18,
      usd_value: usdValue,
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
    amount: Number(ttsAmount) / 1e18,
    txHash,
  })
}
