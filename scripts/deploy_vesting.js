#!/usr/bin/env node
/**
 * TTSVestingWallet deployment helper
 *
 * Run: node scripts/deploy_vesting.js
 *
 * Outputs:
 *   - Constructor params for each of the 5 VestingWallet instances (paste into Remix)
 *   - TTS transfer amounts (fill in allocations before funding)
 *   - Tax-exempt update calldata for Gnosis Safe
 *   - Full deployment sequence
 *
 * DOES NOT EXECUTE TRANSACTIONS. Output is for human review only.
 *
 * Before deploying:
 *   1. Replace placeholder beneficiary addresses with real wallets in BENEFICIARIES below.
 *   2. Set TTS allocation per beneficiary in ALLOCATIONS.
 *   3. Run this script again to get updated params.
 *   4. Follow the step-by-step sequence printed below.
 */

import { createPublicClient, http, parseAbi, formatUnits } from '../node_modules/viem/_esm/index.js'

// ── CONFIG ────────────────────────────────────────────────────────────────────

const TTS_TOKEN   = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const BANK_WALLET = '0xb1e991bf617459b58964eef7756b350e675c53b5'
const GNOSIS_SAFE = '0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86'

// Placeholder addresses — replace with real wallets before deploying.
// Keep this list private; the script does not expose beneficiary labels on-chain.
const BENEFICIARIES = [
  '0xDeAd000000000000000000000000000000000001',  // Beneficiary 1 — replace
  '0xDeAd000000000000000000000000000000000002',  // Beneficiary 2 — replace
  '0xDeAd000000000000000000000000000000000003',  // Beneficiary 3 — replace
  '0xDeAd000000000000000000000000000000000004',  // Beneficiary 4 — replace
  '0xDeAd000000000000000000000000000000000005',  // Beneficiary 5 — replace
]

// TTS allocation per beneficiary (18 decimals — fill in before deploying).
// These are the amounts to transfer to each contract after deployment.
// Account for TTS 1% transfer tax: actual received = amount × 0.99 (unless tax-exempt).
// Recommended: add all 5 contracts to tax-exempt list first (see Step 3 below).
const ALLOCATIONS_TTS = [
  0n,   // Beneficiary 1 — set allocation in TTS tokens (e.g. 1_000_000n * 10n**18n)
  0n,   // Beneficiary 2
  0n,   // Beneficiary 3
  0n,   // Beneficiary 4
  0n,   // Beneficiary 5
]

// ── VESTING SCHEDULE ─────────────────────────────────────────────────────────
// 4-year total, 1-year cliff, 3-year linear release after cliff.
//
// Implementation: start = deployTimestamp + CLIFF_SECONDS (so nothing vests during cliff).
//                 duration = RELEASE_SECONDS (linear from cliff end to full vest).
//
// When calling the constructor, startTimestamp is computed at deploy time.
// This script computes it based on now + 1 year. Adjust if deploying later.

const CLIFF_DAYS    = 365                          // 1-year cliff
const RELEASE_DAYS  = 3 * 365                      // 3-year linear release (= 1095 days)
const TOTAL_DAYS    = CLIFF_DAYS + RELEASE_DAYS    // 4 years

const SECONDS_PER_DAY   = 86_400n
const CLIFF_SECONDS      = BigInt(CLIFF_DAYS)   * SECONDS_PER_DAY
const RELEASE_SECONDS    = BigInt(RELEASE_DAYS) * SECONDS_PER_DAY
const TOTAL_SECONDS      = BigInt(TOTAL_DAYS)   * SECONDS_PER_DAY

// ── COMPUTED TIMESTAMPS (based on current time) ───────────────────────────────

const nowTs           = BigInt(Math.floor(Date.now() / 1000))
const cliffEndTs      = nowTs + CLIFF_SECONDS
const fullVestTs      = nowTs + TOTAL_SECONDS

function tsToDate(ts) {
  return new Date(Number(ts) * 1000).toISOString().split('T')[0]
}

// ── READ LIVE BANK BALANCE ────────────────────────────────────────────────────

const client = createPublicClient({
  chain: {
    id: 8453, name: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://mainnet.base.org'] } }
  },
  transport: http('https://mainnet.base.org')
})

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
])

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  const sep  = '═'.repeat(68)
  const sep2 = '─'.repeat(68)

  // ── 1. Header ──────────────────────────────────────────────────────────────
  console.log('\n' + sep)
  console.log('  TTSVestingWallet — Deployment Parameter Sheet')
  console.log(sep)
  console.log(`  Generated:   ${new Date().toISOString()}`)
  console.log(`  Deployer:    ${BANK_WALLET} (Bank wallet)`)
  console.log(`  Network:     Base mainnet (chainId 8453)`)
  console.log(`  Compiler:    Solidity 0.8.20  ·  optimizer ON (200 runs)  ·  via IR ✓`)
  console.log(`  Contract:    contracts/TTSVestingWallet.sol → TTSVestingWallet`)
  console.log(sep2)
  console.log(`  Schedule:    ${CLIFF_DAYS}-day cliff + ${RELEASE_DAYS}-day linear = ${TOTAL_DAYS} days (4 years)`)
  console.log(`  Deploy now:  ${tsToDate(nowTs)}`)
  console.log(`  Cliff ends:  ${tsToDate(cliffEndTs)}  (nothing vests until this date)`)
  console.log(`  Full vest:   ${tsToDate(fullVestTs)}`)
  console.log(sep)

  // ── 2. Bank wallet TTS balance check ──────────────────────────────────────
  let bankTTS = 0n
  try {
    bankTTS = await client.readContract({
      address: TTS_TOKEN, abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [BANK_WALLET],
    })
    console.log(`\n  Bank wallet TTS balance: ${formatUnits(bankTTS, 18)} TTS`)
  } catch (e) {
    console.log(`\n  Bank wallet TTS balance: (could not read — ${e.message})`)
  }

  const totalAlloc = ALLOCATIONS_TTS.reduce((a, b) => a + b, 0n)
  if (totalAlloc > 0n) {
    console.log(`  Total allocation:        ${formatUnits(totalAlloc, 18)} TTS`)
    console.log(`  Remaining after vest:    ${formatUnits(bankTTS - totalAlloc, 18)} TTS`)
    if (bankTTS < totalAlloc) {
      console.log(`  ⚠ INSUFFICIENT BALANCE — top up Bank wallet before funding contracts`)
    }
  } else {
    console.log(`  Total allocation:        (not set — edit ALLOCATIONS_TTS in this script)`)
  }

  // ── 3. Constructor params per beneficiary ──────────────────────────────────
  console.log('\n' + sep)
  console.log('  CONSTRUCTOR PARAMS — Deploy each in Remix (5 transactions from Bank wallet)')
  console.log(sep)
  console.log('  Arguments are identical for all instances except the beneficiary address.\n')

  const placeholder = BENEFICIARIES.some(a => a.toLowerCase().startsWith('0xdead'))

  for (let i = 0; i < BENEFICIARIES.length; i++) {
    const addr = BENEFICIARIES[i]
    const alloc = ALLOCATIONS_TTS[i]
    console.log(`  ── Instance ${i + 1} / 5${placeholder ? '  ⚠ PLACEHOLDER' : ''} ──────────────`)
    console.log(`  beneficiaryAddress:  "${addr}"`)
    console.log(`  startTimestamp:       ${cliffEndTs}  (${tsToDate(cliffEndTs)})`)
    console.log(`  durationSeconds:      ${RELEASE_SECONDS}  (${RELEASE_DAYS} days)`)
    if (alloc > 0n) {
      console.log(`  TTS to send:          ${formatUnits(alloc, 18)} TTS`)
    } else {
      console.log(`  TTS to send:          (not set)`)
    }
    console.log()
  }

  if (placeholder) {
    console.log('  ⚠  PLACEHOLDER ADDRESSES DETECTED — do NOT deploy until replaced.')
    console.log('     Edit BENEFICIARIES array in this script with real wallet addresses.\n')
  }

  // ── 4. Tax-exempt calldata (Gnosis Safe) ──────────────────────────────────
  console.log(sep)
  console.log('  GNOSIS SAFE — TAX-EXEMPT BATCH (recommended before funding)')
  console.log(sep)
  console.log('  Add all 5 VestingWallet contracts to TTS tax-exempt list.')
  console.log('  This eliminates 1% tax on inbound funding AND outbound releases.')
  console.log('  Skip this step only if you accept ~2% loss per beneficiary.\n')
  console.log('  After deploying all 5 instances, note their addresses and:')
  console.log('  1. Go to app.safe.global → Gnosis Safe')
  console.log(`  2. Import outputs/gnosis_setTaxExempt_CLEAN.json as a batch`)
  console.log('  3. Add 5 new entries: { "to": TTS_TOKEN, "data": setTaxExempt(contractAddr, true) }')
  console.log('  4. Both signers approve and execute\n')
  console.log('  setTaxExempt selector: 0x1dc61040')
  console.log('  Example calldata for one address:')
  console.log('    0x1dc61040')
  console.log('    000000000000000000000000<contractAddress_32bytes>')
  console.log('    0000000000000000000000000000000000000000000000000000000000000001')

  // ── 5. TTS transfer sequence ───────────────────────────────────────────────
  console.log('\n' + sep)
  console.log('  FUNDING SEQUENCE — Bank wallet transfers TTS to each contract')
  console.log(sep)
  console.log('  Call after: contracts deployed + tax-exempt batch executed.\n')
  console.log('  On the TTS token contract (via BaseScan → Write → transfer):')
  console.log(`  TTS token: ${TTS_TOKEN}\n`)

  for (let i = 0; i < BENEFICIARIES.length; i++) {
    const alloc = ALLOCATIONS_TTS[i]
    console.log(`  Transfer ${i + 1} — to VestingWallet_${i + 1}`)
    console.log(`    transfer(`)
    console.log(`      to:     <VestingWallet_${i + 1}_ADDRESS>,`)
    console.log(`      amount: ${alloc > 0n ? alloc.toString() + ' (' + formatUnits(alloc, 18) + ' TTS)' : '(set ALLOCATIONS_TTS[' + i + '])'}`)
    console.log(`    )`)
    console.log()
  }

  // ── 6. Deployment sequence summary ────────────────────────────────────────
  console.log(sep)
  console.log('  DEPLOYMENT SEQUENCE SUMMARY')
  console.log(sep)
  console.log(`
  Step 1 — Replace placeholder addresses
    Edit BENEFICIARIES in scripts/deploy_vesting.js.
    Set ALLOCATIONS_TTS for each beneficiary.
    Re-run: node scripts/deploy_vesting.js

  Step 2 — Compile TTSVestingWallet in Remix
    File:     contracts/TTSVestingWallet.sol
    Compiler: 0.8.20  ·  optimizer ON (200 runs)  ·  via IR ✓
    Network:  Base mainnet (chainId 8453)

  Step 3 — Deploy 5 instances (Bank wallet, separate transactions)
    For each beneficiary, paste constructor params from Section 3 above.
    Record each deployed contract address.

  Step 4 — Verify all 5 on BaseScan
    Contract: TTSVestingWallet
    Source:   contracts/TTSVestingWallet.sol (no imports, single file)

  Step 5 — Tax-exempt batch (Gnosis Safe, 2/2 sign)
    Add all 5 VestingWallet addresses to TTS tax-exempt list.
    See Section 4 above for calldata format.

  Step 6 — Fund each VestingWallet (Bank wallet)
    Transfer TTS allocation to each contract address.
    Confirm balanceOf(contractAddress) > 0 on BaseScan.

  Step 7 — Verify vesting via releasable()
    Call releasable(TTS_TOKEN) on each contract.
    Should return 0 until cliff ends on ${tsToDate(cliffEndTs)}.

  See outputs/vesting_setup_guide.md for full instructions.
  See outputs/vesting_runbook.md for signed transaction runbook.
`)
}

main().catch(e => { console.error(e); process.exit(1) })
