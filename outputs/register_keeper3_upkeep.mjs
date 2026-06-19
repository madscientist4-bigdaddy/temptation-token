#!/usr/bin/env node
/**
 * outputs/register_keeper3_upkeep.mjs
 *
 * Registers TTSKeeper3 as a new Classic v2.3 Custom Logic upkeep on Base mainnet.
 *
 * CALLING CONVENTION (v2.3):
 *   LINK.transferAndCall(registrar, amount, abi.encode(RegistrationParams))
 *   — NOT approve + registerUpkeep. Direct registerUpkeep does not work on v2.3.
 *
 * v2.3 RegistrationParams struct (decoded from actual Keeper2V2 registration TX):
 *   { upkeepContract, amount, adminAddress, gasLimit, triggerType, billingToken,
 *     name, encryptedEmail, checkData, triggerConfig, offchainConfig }
 *   billingToken = LINK token address (NEW v2.3 field absent from old docs)
 *
 * Prerequisites:
 *   - Bank wallet must hold >= 10 LINK (currently 10.87 LINK — sufficient)
 *   - Do NOT cancel Keeper2V2 upkeep — V3c Round 1 still running (~Jun 23 settle)
 *
 * Run:
 *   BASE_RPC_URL=https://... DEPLOYER_PRIVATE_KEY=0x<bank_key> node outputs/register_keeper3_upkeep.mjs
 *
 * Exit codes:
 *   0 = success
 *   1 = hard error (wrong signer, insufficient LINK, bad Keeper3 state, tx reverted)
 *   2 = transferAndCall simulation reverted (registration blocked — investigate or pivot to CRE)
 */

import { createPublicClient, createWalletClient, http, parseAbi, formatEther, encodeAbiParameters } from '../node_modules/viem/_esm/index.js'
import { privateKeyToAccount } from '../node_modules/viem/_esm/accounts/index.js'

// ── Addresses ─────────────────────────────────────────────────────────────────

const LINK_ADDR  = '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196'
const REGISTRAR  = '0xe28adc50c7551cff69fcf32d45d037e5f6554264'
const REGISTRY   = '0xf4bab6a129164aba9b113cb96ba4266df49f8743'
const KEEPER3    = '0x363ce4960e3b459f5892587a37ae1ff2ed04442c'
const V3D        = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const BANK       = '0xb1e991bf617459b58964eef7756b350e675c53b5'

const LINK_AMOUNT = 10n * 10n ** 18n  // 10 LINK

// ── ABIs ──────────────────────────────────────────────────────────────────────

// LINK token is ERC677 — transferAndCall transfers tokens AND calls onTokenTransfer on recipient
const LINK_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function transferAndCall(address to, uint256 value, bytes calldata data) returns (bool)',
])

const REGISTRY_ABI = parseAbi([
  'function getForwarder(uint256 upkeepID) view returns (address forwarder)',
])

const KEEPER3_ABI = parseAbi([
  'function votingContract() view returns (address)',
  'function owner() view returns (address)',
  'function s_forwarder() view returns (address)',
  'function setForwarder(address _forwarder)',
])

// v2.3 RegistrationParams — field order confirmed by decoding actual Keeper2V2 registration TX
// billingToken is a new field absent from old docs
const PARAMS_ABI = [{
  type: 'tuple',
  components: [
    { name: 'upkeepContract',  type: 'address' },
    { name: 'amount',          type: 'uint96'  },
    { name: 'adminAddress',    type: 'address' },
    { name: 'gasLimit',        type: 'uint32'  },
    { name: 'triggerType',     type: 'uint8'   },
    { name: 'billingToken',    type: 'address' },
    { name: 'name',            type: 'string'  },
    { name: 'encryptedEmail',  type: 'bytes'   },
    { name: 'checkData',       type: 'bytes'   },
    { name: 'triggerConfig',   type: 'bytes'   },
    { name: 'offchainConfig',  type: 'bytes'   },
  ],
}]

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms))
const fmt   = wei => parseFloat(formatEther(wei)).toFixed(4) + ' LINK'
const addr  = a   => a.toLowerCase()
const eq    = (a, b) => addr(a) === addr(b)
const zero  = '0x0000000000000000000000000000000000000000'

async function withRetry(fn, label) {
  const MAX = 6
  for (let i = 0; i < MAX; i++) {
    try { return await fn() } catch (e) {
      const is429 = e?.status === 429 || /429|rate.?limit|over_rate_limit/i.test(String(e))
      if (!is429 || i === MAX - 1) throw e
      const delay = 1000 * Math.pow(2, i)
      console.warn(`  429 on ${label} — retry ${i + 1}/${MAX - 1} in ${delay}ms`)
      await sleep(delay)
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const RPC_URL = process.env.BASE_RPC_URL
  const rawKey  = process.env.DEPLOYER_PRIVATE_KEY
  if (!RPC_URL) { console.error('BASE_RPC_URL not set'); process.exit(1) }
  if (!rawKey)  { console.error('DEPLOYER_PRIVATE_KEY not set'); process.exit(1) }

  const key     = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key)

  const BASE = {
    id: 8453, name: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  }
  const transport    = http(RPC_URL, { retryCount: 3, retryDelay: 1000 })
  const publicClient = createPublicClient({ chain: BASE, transport })
  const walletClient = createWalletClient({ account, chain: BASE, transport })

  const txHashes = {}

  // ── STEP 1: Pre-flight ────────────────────────────────────────────────────
  console.log('\n══ STEP 1: PRE-FLIGHT ═══════════════════════════════════════════')

  if (!eq(account.address, BANK)) {
    console.error(`ABORT: key maps to ${account.address}, expected Bank ${BANK}`); process.exit(1)
  }
  console.log(`  ✓ Signer: ${account.address} (Bank)`)

  const linkBal = await withRetry(
    () => publicClient.readContract({ address: LINK_ADDR, abi: LINK_ABI, functionName: 'balanceOf', args: [BANK] }),
    'LINK balance'
  )
  console.log(`  Bank LINK: ${fmt(linkBal)}`)
  if (linkBal < LINK_AMOUNT) {
    console.error(`\n🚨 INSUFFICIENT LINK: Bank has ${fmt(linkBal)}, need 10 LINK.`)
    process.exit(1)
  }
  console.log(`  ✓ Sufficient LINK`)

  const [k3Voting, k3Owner] = await Promise.all([
    withRetry(() => publicClient.readContract({ address: KEEPER3, abi: KEEPER3_ABI, functionName: 'votingContract' }), 'Keeper3.votingContract'),
    withRetry(() => publicClient.readContract({ address: KEEPER3, abi: KEEPER3_ABI, functionName: 'owner' }),          'Keeper3.owner'),
  ])
  if (!eq(k3Voting, V3D))  { console.error(`ABORT: Keeper3.votingContract() = ${k3Voting}`); process.exit(1) }
  if (!eq(k3Owner, BANK))  { console.error(`ABORT: Keeper3.owner() = ${k3Owner}`); process.exit(1) }
  console.log(`  ✓ Keeper3.votingContract() = V3d`)
  console.log(`  ✓ Keeper3.owner() = Bank`)

  // ── STEP 2: Encode RegistrationParams ────────────────────────────────────
  console.log('\n══ STEP 2: Encode v2.3 RegistrationParams ══════════════════════')

  const regParams = {
    upkeepContract:  KEEPER3,
    amount:          LINK_AMOUNT,
    adminAddress:    BANK,
    gasLimit:        500000,
    triggerType:     0,          // 0 = custom logic (checkUpkeep)
    billingToken:    LINK_ADDR,  // v2.3 required field — LINK token address
    name:            'TTS Game Keeper V3',
    encryptedEmail:  '0x',
    checkData:       '0x',
    triggerConfig:   '0x',
    offchainConfig:  '0x',
  }

  // abi.encode(RegistrationParams) — the data payload for transferAndCall
  const encodedParams = encodeAbiParameters(PARAMS_ABI, [regParams])
  console.log(`  Encoded params: ${encodedParams.length / 2 - 1} bytes`)
  console.log(`  upkeepContract:  ${regParams.upkeepContract} (Keeper3)`)
  console.log(`  amount:          10 LINK`)
  console.log(`  adminAddress:    ${regParams.adminAddress} (Bank)`)
  console.log(`  gasLimit:        ${regParams.gasLimit}`)
  console.log(`  triggerType:     0 (custom logic)`)
  console.log(`  billingToken:    ${regParams.billingToken} (LINK)`)

  // ── STEP 3: Simulate transferAndCall ─────────────────────────────────────
  console.log('\n══ STEP 3: Simulate LINK.transferAndCall (pre-flight) ══════════')
  try {
    await publicClient.simulateContract({
      address:      LINK_ADDR,
      abi:          LINK_ABI,
      functionName: 'transferAndCall',
      args:         [REGISTRAR, LINK_AMOUNT, encodedParams],
      account,
    })
    console.log('  ✓ Simulation succeeded — registration is live')
  } catch (simErr) {
    const msg = simErr?.shortMessage || simErr?.message || String(simErr)
    console.error('\n🚨 SIMULATION REVERTED:')
    console.error('  ', msg)
    console.error('\n  If this is a registration-guard error, pivot to CRE:')
    console.error('  Apply at https://chain.link/cre-early-access')
    process.exit(2)
  }

  // ── STEP 4: Send LINK.transferAndCall ────────────────────────────────────
  console.log('\n══ STEP 4: LINK.transferAndCall(registrar, 10 LINK, params) ════')
  console.log('  LINK token:  ', LINK_ADDR)
  console.log('  Registrar:   ', REGISTRAR)
  console.log('  Amount:      10 LINK')

  const registerTx = await withRetry(
    () => walletClient.writeContract({
      address:      LINK_ADDR,
      abi:          LINK_ABI,
      functionName: 'transferAndCall',
      args:         [REGISTRAR, LINK_AMOUNT, encodedParams],
    }),
    'transferAndCall'
  )
  console.log(`  TX: ${registerTx}`)
  txHashes.register = registerTx

  const receipt = await publicClient.waitForTransactionReceipt({ hash: registerTx, timeout: 120_000 })
  if (receipt.status !== 'success') {
    console.error(`\n🚨 transferAndCall TX REVERTED: ${registerTx}`)
    process.exit(1)
  }
  console.log(`  ✓ Confirmed block: ${receipt.blockNumber}`)

  // Parse upkeepId from registry logs — UpkeepRegistered event has indexed upkeepId in topic[1]
  let upkeepId = null
  for (const log of receipt.logs) {
    if (addr(log.address) === addr(REGISTRY) && log.topics.length >= 2) {
      const candidate = BigInt(log.topics[1])
      if (candidate > 0n) { upkeepId = candidate; break }
    }
  }
  if (!upkeepId) {
    console.error('  Could not parse upkeepId from receipt logs. Check TX on BaseScan:')
    console.error('  ', registerTx)
    process.exit(1)
  }
  console.log(`  ✓ upkeepId (decimal): ${upkeepId.toString()}`)
  console.log(`  ✓ Upkeep UI: https://automation.chain.link/base/${upkeepId.toString()}`)

  // ── STEP 5: Get forwarder from registry ───────────────────────────────────
  console.log('\n══ STEP 5: Get forwarder ════════════════════════════════════════')
  console.log('  Waiting 5s for RPC sync...')
  await sleep(5000)

  let forwarder = null
  try {
    forwarder = await withRetry(
      () => publicClient.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: 'getForwarder', args: [upkeepId] }),
      'getForwarder'
    )
    if (!forwarder || eq(forwarder, zero)) {
      console.warn('  ⚠️  getForwarder returned zero — forwarder not yet deployed; set manually after first performUpkeep')
      forwarder = null
    } else {
      const code = await publicClient.getBytecode({ address: forwarder }).catch(() => '0x')
      const codeSize = code ? (code.length - 2) / 2 : 0
      if (codeSize === 0) {
        console.warn(`  ⚠️  Forwarder ${forwarder} has no bytecode yet — set manually after first performUpkeep`)
        forwarder = null
      } else {
        console.log(`  ✓ Forwarder: ${forwarder} (${codeSize} bytes)`)
      }
    }
  } catch (e) {
    console.warn(`  getForwarder() failed: ${e?.shortMessage || e?.message}`)
    console.warn('  Set forwarder manually after first performUpkeep fires')
  }

  // ── STEP 6: Keeper3.setForwarder ─────────────────────────────────────────
  if (forwarder) {
    console.log(`\n══ STEP 6: Keeper3.setForwarder(${forwarder}) ══`)
    const setFwdTx = await withRetry(
      () => walletClient.writeContract({
        address: KEEPER3, abi: KEEPER3_ABI, functionName: 'setForwarder', args: [forwarder],
      }),
      'setForwarder'
    )
    console.log(`  TX: ${setFwdTx}`)
    txHashes.setForwarder = setFwdTx

    const setFwdReceipt = await publicClient.waitForTransactionReceipt({ hash: setFwdTx, timeout: 60_000 })
    if (setFwdReceipt.status !== 'success') { console.error('ABORT: setForwarder reverted'); process.exit(1) }
    console.log(`  Confirmed block: ${setFwdReceipt.blockNumber}`)

    console.log('  Waiting 5s for RPC sync...')
    await sleep(5000)

    const sForwarder = await withRetry(
      () => publicClient.readContract({ address: KEEPER3, abi: KEEPER3_ABI, functionName: 's_forwarder' }),
      's_forwarder'
    )
    if (!eq(sForwarder, forwarder)) {
      console.error(`ABORT: s_forwarder mismatch: got ${sForwarder}`); process.exit(1)
    }
    console.log(`  ✓ Keeper3.s_forwarder() = ${sForwarder}`)
  } else {
    console.log('\n══ STEP 6: setForwarder DEFERRED ════════════════════════════════')
    console.log('  Forwarder not yet available — set manually after first performUpkeep:')
    console.log('    read: Registry.getForwarder(' + upkeepId.toString().slice(0,16) + '...) ')
    console.log('    then: Bank wallet → Keeper3.setForwarder(<addr>)')
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  const finalFwd = await withRetry(
    () => publicClient.readContract({ address: KEEPER3, abi: KEEPER3_ABI, functionName: 's_forwarder' }),
    's_forwarder final'
  ).catch(() => '(read failed)')

  console.log(`
══ REGISTRATION COMPLETE ════════════════════════════════════

  New upkeepId:        ${upkeepId.toString()}
  Forwarder:           ${forwarder ?? '(set after first performUpkeep)'}
  Keeper3 s_forwarder: ${finalFwd}

  TX hashes:
    transferAndCall:   ${txHashes.register}
${txHashes.setForwarder ? `    setForwarder:      ${txHashes.setForwarder}` : '    setForwarder:      (deferred)'}

  View upkeep: https://automation.chain.link/base/${upkeepId.toString()}

══ NEXT STEPS ═══════════════════════════════════════════════

  ✅ DO NOW (no Bank tx required):
  1. Add V3d 0x783b8cd80b586b723188c93ef94ee1beede617b4 as VRF consumer
       vrf.chain.link/base → Sub 58222014484560539249027457203866883376041731162442592604288474822166186263722
  2. Gnosis Safe: setTaxExempt(0x783b8cd80b586b723188c93ef94ee1beede617b4, true)

  ⏳ AFTER V3c Round 1 settles (~Jun 23):
  3. Cancel Keeper2V2 upkeep ID 107234397534438678165344999422920520488294344698573062791612853656108534823641
       → 33.12 LINK returned to Bank

  🔧 IF forwarder was deferred:
  4. After first performUpkeep fires: Bank → Keeper3.setForwarder(<forwarder>)

  🖥️  FRONTEND CUTOVER (after V3d first round starts):
  5. Replace V3c address with V3d in: src/App.jsx, src/TTAdminDashboard.jsx, api/approve-profile.js

══════════════════════════════════════════════════════════════
`)
}

main().catch(e => {
  console.error('\n🚨 FATAL:', e?.shortMessage || e?.message || e)
  if (e?.cause) console.error('  cause:', e.cause?.shortMessage || e.cause?.message)
  process.exit(1)
})
