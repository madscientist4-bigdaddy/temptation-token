#!/usr/bin/env node
/**
 * outputs/register_keeper3_upkeep.mjs
 *
 * Registers TTSKeeper3 as a new Classic v2.3 Custom Logic upkeep on Base mainnet,
 * then calls Keeper3.setForwarder(<new_forwarder>).
 *
 * Prerequisites:
 *   - Bank wallet must hold >= 10 LINK (classic upkeeps don't allow partial withdrawal
 *     from the Keeper2V2 upkeep — you must fund Bank from an external source)
 *   - Do NOT cancel the Keeper2V2 upkeep before running this — V3c Round 1 still live
 *
 * Run:
 *   BASE_RPC_URL=https://... DEPLOYER_PRIVATE_KEY=0x<bank_key> node outputs/register_keeper3_upkeep.mjs
 *
 * Exit codes:
 *   0 = success
 *   1 = hard error (bad state, tx reverted unexpectedly)
 *   2 = registration blocked by on-chain guard (pivot to CRE)
 *   3 = registerUpkeep tx reverted (pivot to CRE)
 */

import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from '../node_modules/viem/_esm/index.js'
import { privateKeyToAccount } from '../node_modules/viem/_esm/accounts/index.js'

// ── Addresses ─────────────────────────────────────────────────────────────────

const LINK_ADDR  = '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196'
const REGISTRAR  = '0xe28adc50c7551cff69fcf32d45d037e5f6554264'
const REGISTRY   = '0xf4bab6a129164aba9b113cb96ba4266df49f8743'
const KEEPER3    = '0x363ce4960e3b459f5892587a37ae1ff2ed04442c'
const V3D        = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const BANK       = '0xb1e991bf617459b58964eef7756b350e675c53b5'

const LINK_AMOUNT = 10n * 10n ** 18n   // 10 LINK in wei (uint96 fits)

// ── ABIs ──────────────────────────────────────────────────────────────────────

const LINK_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

// Full JSON ABI for registerUpkeep — parseAbi doesn't handle nested tuple structs cleanly
const REGISTRAR_ABI = [
  {
    name: 'registerUpkeep',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{
      name: 'requestParams',
      type: 'tuple',
      components: [
        { name: 'name',           type: 'string'  },
        { name: 'encryptedEmail', type: 'bytes'   },
        { name: 'upkeepContract', type: 'address' },
        { name: 'gasLimit',       type: 'uint32'  },
        { name: 'adminAddress',   type: 'address' },
        { name: 'triggerType',    type: 'uint8'   },
        { name: 'checkData',      type: 'bytes'   },
        { name: 'triggerConfig',  type: 'bytes'   },
        { name: 'offchainConfig', type: 'bytes'   },
        { name: 'amount',         type: 'uint96'  },
      ],
    }],
    outputs: [{ name: 'id', type: 'uint256' }],
  },
]

const REGISTRY_ABI = parseAbi([
  'function getForwarder(uint256 upkeepID) view returns (address forwarder)',
])

const KEEPER3_ABI = parseAbi([
  'function votingContract() view returns (address)',
  'function owner() view returns (address)',
  'function s_forwarder() view returns (address)',
  'function setForwarder(address _forwarder)',
])

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
    console.error(`ABORT: key maps to ${account.address}, expected Bank ${BANK}`)
    process.exit(1)
  }
  console.log(`  ✓ Signer: ${account.address} (Bank)`)

  // LINK balance
  const linkBal = await withRetry(
    () => publicClient.readContract({ address: LINK_ADDR, abi: LINK_ABI, functionName: 'balanceOf', args: [BANK] }),
    'LINK balance'
  )
  console.log(`  Bank LINK balance: ${fmt(linkBal)}`)
  if (linkBal < LINK_AMOUNT) {
    console.error(`\n🚨 INSUFFICIENT LINK`)
    console.error(`   Bank has ${fmt(linkBal)}, need 10 LINK.`)
    console.error(`   Classic upkeeps do NOT support partial withdrawal from the Keeper2V2 upkeep.`)
    console.error(`   You must send 10 LINK to Bank (${BANK}) from an exchange or external source.`)
    process.exit(1)
  }
  console.log(`  ✓ Bank LINK sufficient`)

  // Keeper3 wiring
  const [k3Voting, k3Owner] = await Promise.all([
    withRetry(() => publicClient.readContract({ address: KEEPER3, abi: KEEPER3_ABI, functionName: 'votingContract' }), 'Keeper3.votingContract'),
    withRetry(() => publicClient.readContract({ address: KEEPER3, abi: KEEPER3_ABI, functionName: 'owner' }),          'Keeper3.owner'),
  ])
  console.log(`  Keeper3.votingContract(): ${k3Voting}`)
  console.log(`  Keeper3.owner():          ${k3Owner}`)

  if (!eq(k3Voting, V3D)) {
    console.error(`ABORT: Keeper3.votingContract() = ${k3Voting}, expected V3d ${V3D}`); process.exit(1)
  }
  if (!eq(k3Owner, BANK)) {
    console.error(`ABORT: Keeper3.owner() = ${k3Owner}, expected Bank ${BANK}`); process.exit(1)
  }
  console.log(`  ✓ Keeper3 wiring verified (votingContract=V3d, owner=Bank)`)

  // ── STEP 2: LINK.approve(registrar, 10 LINK) ─────────────────────────────
  console.log('\n══ STEP 2: LINK.approve(registrar, 10 LINK) ════════════════════')

  const allowanceBefore = await withRetry(
    () => publicClient.readContract({ address: LINK_ADDR, abi: LINK_ABI, functionName: 'allowance', args: [BANK, REGISTRAR] }),
    'allowance'
  )
  console.log(`  Current allowance: ${fmt(allowanceBefore)}`)

  if (allowanceBefore >= LINK_AMOUNT) {
    console.log(`  Allowance already sufficient — skipping approve tx`)
  } else {
    const approveTx = await withRetry(
      () => walletClient.writeContract({ address: LINK_ADDR, abi: LINK_ABI, functionName: 'approve', args: [REGISTRAR, LINK_AMOUNT] }),
      'approve'
    )
    console.log(`  TX: ${approveTx}`)
    txHashes.approve = approveTx
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx, timeout: 60_000 })
    if (approveReceipt.status !== 'success') {
      console.error('ABORT: approve TX reverted'); process.exit(1)
    }
    console.log(`  Confirmed block: ${approveReceipt.blockNumber}`)
  }

  console.log('  Waiting 5s for RPC sync...')
  await sleep(5000)

  const allowanceAfter = await withRetry(
    () => publicClient.readContract({ address: LINK_ADDR, abi: LINK_ABI, functionName: 'allowance', args: [BANK, REGISTRAR] }),
    'verify allowance'
  )
  if (allowanceAfter < LINK_AMOUNT) {
    console.error(`ABORT: allowance still insufficient after approve: ${fmt(allowanceAfter)}`); process.exit(1)
  }
  console.log(`  ✓ Allowance verified: ${fmt(allowanceAfter)}`)

  // ── STEP 3: registerUpkeep ────────────────────────────────────────────────
  console.log('\n══ STEP 3: registerUpkeep on v2.3 registrar ════════════════════')
  console.log(`  upkeepContract: ${KEEPER3}`)
  console.log(`  gasLimit:       500000`)
  console.log(`  triggerType:    0 (custom logic)`)
  console.log(`  amount:         10 LINK`)

  const regParams = {
    name:           'TTS Game Keeper V3',
    encryptedEmail: '0x',
    upkeepContract: KEEPER3,
    gasLimit:       500000,
    adminAddress:   BANK,
    triggerType:    0,
    checkData:      '0x',
    triggerConfig:  '0x',
    offchainConfig: '0x',
    amount:         LINK_AMOUNT,
  }

  // Simulate first — catches registration guard / paused errors before spending gas
  console.log('  Simulating registerUpkeep...')
  let simulatedId
  try {
    const { result } = await publicClient.simulateContract({
      address: REGISTRAR, abi: REGISTRAR_ABI, functionName: 'registerUpkeep',
      args: [regParams], account,
    })
    simulatedId = result
    console.log(`  Simulation succeeded. Expected upkeepId: ${simulatedId.toString()}`)
  } catch (simErr) {
    const msg = simErr?.shortMessage || simErr?.message || String(simErr)
    const lower = msg.toLowerCase()
    if (lower.includes('paused') || lower.includes('not allowed') || lower.includes('disabled') ||
        lower.includes('revert') || lower.includes('reverted')) {
      console.error('\n🚨 REGISTRATION BLOCKED — registrar returned a revert/guard error:')
      console.error('  ', msg)
      console.error('\n  VERDICT: Classic v2.3 registration is disabled or paused on this registrar.')
      console.error('  ACTION:  Pivot to CRE. Apply at https://chain.link/cre-early-access')
      console.error('           Then use AutomationReceiver.sol bridge pattern with Keeper3 as target.')
      process.exit(2)
    }
    throw new Error(`registerUpkeep simulation failed unexpectedly: ${msg}`)
  }

  // Send the real tx
  console.log('  Sending registerUpkeep TX...')
  const registerTx = await withRetry(
    () => walletClient.writeContract({
      address: REGISTRAR, abi: REGISTRAR_ABI, functionName: 'registerUpkeep', args: [regParams],
    }),
    'registerUpkeep'
  )
  console.log(`  TX: ${registerTx}`)
  txHashes.registerUpkeep = registerTx

  const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerTx, timeout: 120_000 })
  if (registerReceipt.status !== 'success') {
    console.error('\n🚨 registerUpkeep TX REVERTED')
    console.error(`   TX hash: ${registerTx}`)
    console.error('   Check on BaseScan for the exact revert reason.')
    console.error('   If the error is registration-related, pivot to CRE.')
    process.exit(3)
  }
  console.log(`  ✓ Confirmed block: ${registerReceipt.blockNumber}`)

  // Parse upkeepId from registry logs (UpkeepRegistered event — topic[1] is indexed id)
  let upkeepId = simulatedId
  for (const log of registerReceipt.logs) {
    if (addr(log.address) === addr(REGISTRY) && log.topics.length >= 2) {
      const fromLog = BigInt(log.topics[1])
      if (fromLog > 0n) {
        upkeepId = fromLog
        console.log(`  ✓ upkeepId from registry log: ${upkeepId.toString()}`)
        break
      }
    }
  }
  console.log(`  upkeepId (decimal): ${upkeepId.toString()}`)
  console.log(`  Upkeep UI: https://automation.chain.link/base/${upkeepId.toString()}`)

  // ── STEP 4: Get forwarder from registry ───────────────────────────────────
  console.log('\n══ STEP 4: Get forwarder address ════════════════════════════════')
  console.log('  Waiting 5s for RPC sync...')
  await sleep(5000)

  let forwarder = null
  try {
    forwarder = await withRetry(
      () => publicClient.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: 'getForwarder', args: [upkeepId] }),
      'getForwarder'
    )
    console.log(`  Registry.getForwarder(${upkeepId.toString().slice(0,12)}...): ${forwarder}`)

    if (!forwarder || eq(forwarder, zero)) {
      console.warn('  ⚠️  getForwarder returned zero address')
      console.warn('      The DON may not have deployed the forwarder yet.')
      console.warn('      Re-check after the first performUpkeep fires.')
      forwarder = null
    } else {
      const fwdCode = await publicClient.getBytecode({ address: forwarder }).catch(() => '0x')
      const fwdSize = fwdCode ? (fwdCode.length - 2) / 2 : 0
      if (fwdSize === 0) {
        console.warn(`  ⚠️  Forwarder ${forwarder} has no bytecode yet — run setForwarder manually after first fire`)
        forwarder = null
      } else {
        console.log(`  ✓ Forwarder ${forwarder} — ${fwdSize} bytes bytecode`)
      }
    }
  } catch (e) {
    console.warn(`  getForwarder() failed: ${e?.shortMessage || e?.message}`)
    console.warn('  This is OK — forwarder is set by the DON on first performUpkeep.')
    console.warn('  After first fire: read REGISTRY.getForwarder(upkeepId) then call Keeper3.setForwarder()')
  }

  // ── STEP 5: Keeper3.setForwarder ─────────────────────────────────────────
  if (forwarder) {
    console.log(`\n══ STEP 5: Keeper3.setForwarder(${forwarder}) ═══`)
    const setFwdTx = await withRetry(
      () => walletClient.writeContract({
        address: KEEPER3, abi: KEEPER3_ABI, functionName: 'setForwarder', args: [forwarder],
      }),
      'setForwarder'
    )
    console.log(`  TX: ${setFwdTx}`)
    txHashes.setForwarder = setFwdTx

    const setFwdReceipt = await publicClient.waitForTransactionReceipt({ hash: setFwdTx, timeout: 60_000 })
    if (setFwdReceipt.status !== 'success') {
      console.error('ABORT: setForwarder TX reverted'); process.exit(1)
    }
    console.log(`  Confirmed block: ${setFwdReceipt.blockNumber}`)

    console.log('  Waiting 5s for RPC sync...')
    await sleep(5000)

    const sForwarder = await withRetry(
      () => publicClient.readContract({ address: KEEPER3, abi: KEEPER3_ABI, functionName: 's_forwarder' }),
      'verify s_forwarder'
    )
    if (!eq(sForwarder, forwarder)) {
      console.error(`ABORT: s_forwarder mismatch: got ${sForwarder}, expected ${forwarder}`)
      process.exit(1)
    }
    console.log(`  ✓ Keeper3.s_forwarder() = ${sForwarder}`)
  } else {
    console.log('\n══ STEP 5: setForwarder DEFERRED ════════════════════════════════')
    console.log('  Forwarder address not yet available (zero or no bytecode).')
    console.log('  After the Chainlink DON fires the first performUpkeep:')
    console.log('    1. node -e "...read REGISTRY.getForwarder(' + upkeepId.toString().slice(0,20) + '...)"')
    console.log('    2. Bank wallet → Keeper3.setForwarder(<forwarder>)')
    console.log('  Or re-run this script — it will skip registration if allowance already exists.')
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  const finalFwdState = await withRetry(
    () => publicClient.readContract({ address: KEEPER3, abi: KEEPER3_ABI, functionName: 's_forwarder' }),
    's_forwarder final'
  ).catch(() => '(read failed)')

  console.log(`
══ REGISTRATION COMPLETE ════════════════════════════════════

  New upkeepId:        ${upkeepId.toString()}
  Forwarder:           ${forwarder || '(not yet available — check after first fire)'}
  Keeper3 s_forwarder: ${finalFwdState}

  TX hashes:
${txHashes.approve      ? `    approve:           ${txHashes.approve}` : '    approve:           (skipped — allowance already set)'}
    registerUpkeep:    ${txHashes.registerUpkeep}
${txHashes.setForwarder ? `    setForwarder:      ${txHashes.setForwarder}` : '    setForwarder:      (deferred — run after first performUpkeep)'}

  View upkeep: https://automation.chain.link/base/${upkeepId.toString()}

══ NEXT STEPS ═══════════════════════════════════════════════

  ✅ DO THESE NOW (no Bank tx required):
  1. Add V3d 0x783b8cd80b586b723188c93ef94ee1beede617b4 as VRF consumer
       at vrf.chain.link/base → Sub ID 58222014484560539249027457203866883376041731162442592604288474822166186263722
  2. Gnosis Safe: setTaxExempt(0x783b8cd80b586b723188c93ef94ee1beede617b4, true)

  ⏳ WAIT until V3c Round 1 settles (~Jun 23):
  3. Cancel old Keeper2V2 upkeep ID 107234397534438678165344999422920520488294344698573062791612853656108534823641
       → 33.12 LINK returned to Bank

  🔧 AFTER first performUpkeep fires on new upkeep (if forwarder deferred):
  4. Read Registry.getForwarder(upkeepId) → set on Keeper3

  🖥️  FRONTEND CUTOVER (after V3d round starts):
  5. Replace V3c address with V3d in: src/App.jsx, src/TTAdminDashboard.jsx, api/approve-profile.js

══════════════════════════════════════════════════════════════
`)
}

main().catch(e => {
  console.error('\n🚨 FATAL:', e?.shortMessage || e?.message || e)
  if (e?.cause) console.error('  cause:', e.cause?.shortMessage || e.cause?.message)
  process.exit(1)
})
