// POST /api/approve-profile
// Body: { submissionId: string }
// 1. Updates Supabase submissions row to status=approved
// 2. Reads wallet_address from Supabase row and calls batchApproveProfiles([submissionId], [wallet]) on TTSVotingV3d
// 3. If submission has referral_code, calls setProfileClub(submissionId, referral_code) on contract
// Requires env: DEPLOYER_PRIVATE_KEY

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

const V3_ADDRESS = '0x783b8cd80b586b723188c93ef94ee1beede617b4'

const ABI = parseAbi([
  'function batchApproveProfiles(string[] profileIds, address[] wallets) external',
  'function setProfileClub(string calldata profileId, string calldata clubCode) external',
])

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { submissionId } = req.body || {}
  if (!submissionId) {
    return res.status(400).json({ ok: false, error: 'Missing submissionId' })
  }

  const pk = process.env.DEPLOYER_PRIVATE_KEY
  if (!pk) return res.status(500).json({ ok: false, error: 'DEPLOYER_PRIVATE_KEY not set' })

  // 1. Update Supabase status → approved and fetch referral_code in one step
  const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/submissions?id=eq.${submissionId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ status: 'approved' }),
  })
  if (!supaRes.ok) {
    const text = await supaRes.text()
    return res.status(500).json({ ok: false, error: `Supabase PATCH failed: ${text}` })
  }
  const updated = await supaRes.json().catch(() => [])
  const row = Array.isArray(updated) ? updated[0] : null
  const referralCode = row?.referral_code ? row.referral_code.trim().toLowerCase() : null
  const walletAddress = row?.wallet_address
  if (!walletAddress) {
    return res.status(500).json({ ok: false, error: 'No wallet_address stored in Supabase for this submission — cannot register on-chain' })
  }

  // 2. On-chain calls
  const pkHex        = pk.startsWith('0x') ? pk : `0x${pk}`
  const account      = privateKeyToAccount(pkHex)
  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
  const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') })

  let txHash
  try {
    txHash = await walletClient.writeContract({
      address: V3_ADDRESS,
      abi: ABI,
      functionName: 'batchApproveProfiles',
      args: [[submissionId], [walletAddress]],
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash })
  } catch (e) {
    return res.status(500).json({
      ok: false,
      supabaseUpdated: true,
      error: `batchApproveProfiles failed: ${e.message}`,
    })
  }

  // 3. If submission has a referral code, link the profile to the club on-chain
  let clubTxHash = null
  if (referralCode) {
    try {
      clubTxHash = await walletClient.writeContract({
        address: V3_ADDRESS,
        abi: ABI,
        functionName: 'setProfileClub',
        args: [submissionId, referralCode],
      })
      await publicClient.waitForTransactionReceipt({ hash: clubTxHash })
    } catch (e) {
      // Non-fatal: profile is approved, club link failed (club code may not be registered yet)
      console.error('setProfileClub failed (non-fatal):', e.message)
    }
  }

  return res.status(200).json({ ok: true, txHash, clubTxHash, referralCode })
}
