// POST /api/referral-credit
// Called after a new user submits a profile to credit their referrer.
// Body: { newUserWallet: "0x..." }
//
// Flow:
//   1. Look up which referral_code the new user used (submissions table)
//   2. Find the referrer wallet from referrals table
//   3. Transfer 100 TTS from house wallet to referrer via on-chain tx
//   4. Log to referral_credits table
//
// Required env vars:
//   DEPLOYER_PRIVATE_KEY — hex private key of house wallet (0xb1e991...)
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const TTS_ADDRESS = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'

const TTS_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
])

async function getReferralSettings() {
  try {
    const url = (process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co') + '/rest/v1/referral_settings?id=eq.1&select=*&limit=1'
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
    const r = await fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key } })
    const d = await r.json()
    if (Array.isArray(d) && d.length > 0 && d[0].referral_enabled !== false) {
      return { creditAmount: BigInt(Math.floor((d[0].referrer_bonus || 100) * 1e18)), enabled: d[0].referral_enabled !== false }
    }
  } catch(_) {}
  return { creditAmount: 100n * 10n ** 18n, enabled: true }
}

function supaFetch(path, opts = {}) {
  const url = process.env.SUPABASE_URL + '/rest/v1' + path
  return fetch(url, {
    ...opts,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { newUserWallet } = req.body || {}
  if (!newUserWallet || !/^0x[0-9a-fA-F]{40}$/.test(newUserWallet)) {
    return res.status(400).json({ error: 'Invalid wallet' })
  }

  // Load live settings from Supabase
  const { creditAmount, enabled } = await getReferralSettings()
  if (!enabled) return res.status(200).json({ ok: true, skipped: 'referral program disabled' })

  const pk = process.env.DEPLOYER_PRIVATE_KEY
  if (!pk) return res.status(500).json({ error: 'DEPLOYER_PRIVATE_KEY not set' })

  // 1. Find referral_code used by new user
  const subRes = await supaFetch(
    `/submissions?wallet_address=eq.${newUserWallet}&select=referral_code&limit=1`
  )
  const subs = await subRes.json()
  const referralCode = subs?.[0]?.referral_code
  if (!referralCode) return res.status(200).json({ ok: true, skipped: 'no referral code' })

  // 2. Find referrer wallet
  const refRes = await supaFetch(
    `/referrals?code=eq.${encodeURIComponent(referralCode)}&select=wallet_address&limit=1`
  )
  const refs = await refRes.json()
  const referrerWallet = refs?.[0]?.wallet_address
  if (!referrerWallet) return res.status(200).json({ ok: true, skipped: 'referral code not found' })

  // 3. Check not already credited
  const creditCheck = await supaFetch(
    `/referral_credits?new_user_wallet=eq.${newUserWallet}&select=id&limit=1`
  )
  const existing = await creditCheck.json()
  if (existing?.length > 0) return res.status(200).json({ ok: true, skipped: 'already credited' })

  // 4. Send on-chain transfer
  const pkHex = pk.startsWith('0x') ? pk : `0x${pk}`
  const account = privateKeyToAccount(pkHex)

  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
  const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') })

  let txHash
  try {
    txHash = await walletClient.writeContract({
      address: TTS_ADDRESS,
      abi: TTS_ABI,
      functionName: 'transfer',
      args: [referrerWallet, creditAmount],
    })
    // wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash })
  } catch (e) {
    console.error('referral-credit tx failed:', e)
    return res.status(500).json({ error: e.message })
  }

  // 5. Log to referral_credits table
  await supaFetch('/referral_credits', {
    method: 'POST',
    body: JSON.stringify({
      new_user_wallet: newUserWallet,
      referrer_wallet: referrerWallet,
      referral_code: referralCode,
      amount_tts: Number(creditAmount) / 1e18,
      tx_hash: txHash,
      created_at: new Date().toISOString(),
    }),
  })

  return res.status(200).json({ ok: true, referrerWallet, txHash, amount: '100 TTS' })
}
