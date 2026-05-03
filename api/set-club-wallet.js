// POST /api/set-club-wallet
// Body: { clubName, clubCode, walletAddress }
// Registers or updates a club's payout wallet on the TTSVotingV3b contract.
// Also upserts the club into the club_partners table in Supabase.
// Pass walletAddress: "0x0000000000000000000000000000000000000000" to deregister.
// Requires: DEPLOYER_PRIVATE_KEY in Vercel env.

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const VOTING_ADDRESS = '0xbc54432BB2D1Ef95e940e024dA604dbb9e9846F8'
const SUPABASE_URL   = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

const ABI = parseAbi(['function setClubWallet(string calldata code, address wallet) external'])

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

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
    await publicClient.waitForTransactionReceipt({ hash: txHash })
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
