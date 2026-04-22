#!/usr/bin/env node
/**
 * TTSVotingV3 deployment helper
 *
 * Run: node scripts/deployV3.js
 *
 * Outputs:
 *   1. Constructor params to paste into Remix
 *   2. batchApproveProfiles calldata (profileIds + wallets from Supabase)
 *   3. Step-by-step transaction sequence
 */

import { createPublicClient, http, parseAbi } from '../node_modules/viem/_esm/index.js'

// ── Config ─────────────────────────────────────────────────────────────────
const KEEPER_ADDRESS  = '0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48'
const VOTING_V2       = '0x4dE347D547C7Ae2CB38c42A8166d29049C24e9DA'
const TTS_TOKEN       = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const STAKING_ADDRESS = '0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc'
const SUPABASE_URL    = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

const KEEPER_ABI = [
  'function vrfCoordinator() view returns (address)',
  'function keyHash() view returns (bytes32)',
  'function subscriptionId() view returns (uint64)',
]

async function main() {
  const client = createPublicClient({
    chain: {
      id: 8453, name: 'Base',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: ['https://mainnet.base.org'] } }
    },
    transport: http('https://mainnet.base.org')
  })

  // ── 1. Fetch VRF params from keeper ──────────────────────────────────────
  console.log('Fetching VRF params from TTSKeeper2...')

  const abi = parseAbi(KEEPER_ABI)

  let vrfCoordinator, keyHash, subscriptionId
  try {
    vrfCoordinator = await client.readContract({ address: KEEPER_ADDRESS, abi, functionName: 'vrfCoordinator' })
    keyHash        = await client.readContract({ address: KEEPER_ADDRESS, abi, functionName: 'keyHash' })
    subscriptionId = await client.readContract({ address: KEEPER_ADDRESS, abi, functionName: 'subscriptionId' })
  } catch(e) {
    console.error('Could not read keeper VRF params:', e.message)
    console.log('Using fallback: check BaseScan for TTSKeeper2 storage')
    // Confirmed from TTSKeeper2 storage slot 2
    vrfCoordinator = '0x6593c7De001fC8542bB1703532EE1e5aA0D458fD'
    // keyHash is immutable — verify the exact value from TTSVotingV2 on BaseScan or vrf.chain.link
    keyHash        = '0x027f94ff1465b3525f9fc03e9ff7d6d2c0953482246dd6ae07570c45d6631414'
    subscriptionId = 1n
  }

  // ── 2. Fetch approved submissions from Supabase ───────────────────────────
  console.log('\nFetching approved profiles from Supabase...')
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/submissions?status=eq.approved&select=id,payout_wallet,wallet_address,round_id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  )
  const submissions = await res.json()

  if (!Array.isArray(submissions)) {
    console.error('Supabase error:', submissions)
    process.exit(1)
  }

  // Group by round — id is used as profileId on-chain, payout_wallet is payout address
  const byRound = {}
  for (const s of submissions) {
    const roundId = s.round_id || 1
    if (!byRound[roundId]) byRound[roundId] = []
    byRound[roundId].push({
      profileId: s.id,
      wallet: s.payout_wallet || s.wallet_address || '0x0000000000000000000000000000000000000000'
    })
  }

  // ── 3. Print constructor params ───────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('TTSVotingV3 CONSTRUCTOR PARAMS (paste into Remix)')
  console.log('═'.repeat(60))
  console.log(`_ttsToken:         "${TTS_TOKEN}"`)
  console.log(`vrfCoordinator_:   "${vrfCoordinator}"`)
  console.log(`_keyHash:          "${keyHash}"`)
  console.log(`_subscriptionId:   ${subscriptionId}`)
  console.log(`_stakingContract:  "${STAKING_ADDRESS}"`)
  console.log(`_charityWallet:    "<POLARIS_WALLET>"   ← set Polaris Project wallet`)
  console.log(`_houseWallet:      "<DEPLOYER_WALLET>"  ← or dedicated house wallet`)

  // ── 4. Print batchApproveProfiles data ────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('PROFILES TO APPROVE PER ROUND')
  console.log('═'.repeat(60))

  for (const [roundId, profiles] of Object.entries(byRound)) {
    const profileIds = profiles.map(p => p.profileId)
    const wallets    = profiles.map(p => p.wallet || '0x0000000000000000000000000000000000000000')
    console.log(`\nRound ${roundId} — ${profiles.length} profiles`)
    console.log('batchApproveProfiles(')
    console.log('  ' + JSON.stringify(profileIds) + ',')
    console.log('  ' + JSON.stringify(wallets))
    console.log(')')
  }

  // ── 5. Print deployment sequence ─────────────────────────────────────────
  const KEEPER = KEEPER_ADDRESS
  console.log('\n' + '═'.repeat(60))
  console.log('DEPLOYMENT SEQUENCE (all from deployer wallet)')
  console.log('═'.repeat(60))
  console.log(`
Step 1 — Deploy TTSVotingV3 in Remix
  • Open TTSVotingV3.sol in Remix
  • Compiler: 0.8.20, optimizations ON (200 runs)
  • Network: Base mainnet (chainId 8453)
  • Paste constructor params above
  • Deploy → note V3_ADDRESS

Step 2 — Transfer V3 ownership to keeper
  • On V3: transferOwnership("${KEEPER}")

Step 3 — Point keeper at V3
  • On TTSKeeper2 (${KEEPER}): setVotingContract("V3_ADDRESS")

Step 4 — Keeper accepts V3 ownership
  • On TTSKeeper2: acceptVotingOwnership()
  • Owner of V3 is now TTSKeeper2; admin is still deployer

Step 5 — Start Round 2 on V3
  • On TTSKeeper2: manualExecute(1)
  • Round must be active before approveProfile can be called

Step 6 — Approve Round 2 profiles on V3
  • Run this script again after round starts — it will show Round 2 profile data
  • On V3: batchApproveProfiles(profileIds[], wallets[])
  • Profiles appear here once admin approves submissions in the dashboard

Step 7 — Update App.jsx
  • Change VOTING_ADDRESS to V3_ADDRESS
  • npm run build && npx vercel --prod

Step 8 — Add V3 as VRF consumer
  • Go to vrf.chain.link → Subscription ${subscriptionId}
  • Add V3_ADDRESS as a consumer
`)
}

main().catch(e => { console.error(e); process.exit(1) })
