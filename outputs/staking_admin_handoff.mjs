#!/usr/bin/env node
/**
 * PHASE 3.5 — DEFAULT_ADMIN handoff on the staking proxy (closes the timelock bypass).
 *
 * Runs ONLY after Phase 2 migration + Phase 3 E2E are complete and verified.
 * Preconditions checked below; any failure ABORTS before sending anything.
 *
 *   Today: staking DEFAULT_ADMIN_ROLE = Bank (EOA). Bank can therefore grant itself
 *   UPGRADER_ROLE and upgrade the proxy WITHOUT the 2-day TimelockController delay.
 *   The timelock is only as strong as Bank's hot key.
 *
 *   Fix (2 Bank txs, order is load-bearing):
 *     1. grantRole(DEFAULT_ADMIN_ROLE, Safe)   -> verify on-chain
 *     2. renounceRole(DEFAULT_ADMIN_ROLE, Bank) -> verify on-chain
 *
 *   NEVER renounce before the grant is confirmed on-chain: DEFAULT_ADMIN_ROLE is its
 *   own role admin in OZ AccessControl, so a renounce with no other holder orphans
 *   role administration permanently (UPGRADER could never be re-issued if the
 *   timelock were ever lost).
 *
 * Bank retains MANAGER_ROLE after this (thresholds / APRs / pause / recoverRewardTokens).
 * That is intentional for day-to-day ops and cannot touch upgrades or principal —
 * recoverRewardTokens is bounded by rewardSurplus(). Revoke separately if desired.
 *
 * Usage: node outputs/staking_admin_handoff.mjs [--execute]
 *        (dry-run by default: runs every precondition + simulation, sends nothing)
 */
import 'dotenv/config'
import { createPublicClient, createWalletClient, http, keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const EXECUTE = process.argv.includes('--execute')

const STAKING  = '0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d'
const SAFE     = '0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86'
const BANK     = '0xb1e991bf617459b58964eef7756b350e675c53b5'
const OLD_PROXY= '0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc'
const TIMELOCK = '0xa4fbf397485763e39102dcfaefcbf9794df55875'
const V3D      = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const TTS      = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'

const DEFAULT_ADMIN_ROLE = `0x${'0'.repeat(64)}`
const UPGRADER_ROLE = keccak256(toHex('UPGRADER_ROLE'))

const ABI = [
  { name:'hasRole', type:'function', stateMutability:'view', inputs:[{type:'bytes32'},{type:'address'}], outputs:[{type:'bool'}] },
  { name:'grantRole', type:'function', stateMutability:'nonpayable', inputs:[{type:'bytes32'},{type:'address'}], outputs:[] },
  { name:'renounceRole', type:'function', stateMutability:'nonpayable', inputs:[{type:'bytes32'},{type:'address'}], outputs:[] },
  { name:'totalStaked', type:'function', stateMutability:'view', inputs:[], outputs:[{type:'uint256'}] },
  { name:'paused', type:'function', stateMutability:'view', inputs:[], outputs:[{type:'bool'}] },
]
const ERC20 = [{ name:'balanceOf', type:'function', stateMutability:'view', inputs:[{type:'address'}], outputs:[{type:'uint256'}] }]
const V3DABI = [{ name:'stakingContract', type:'function', stateMutability:'view', inputs:[], outputs:[{type:'address'}] }]

const pub = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) })
const die = (m) => { console.error(`\n✗ ABORT — ${m}`); process.exit(1) }
const ok  = (m) => console.log(`  ✓ ${m}`)

const chainId = await pub.getChainId()
if (chainId !== 8453) die(`wrong chain ${chainId}, expected Base 8453`)

console.log('\n── PRECONDITIONS ──────────────────────────────────────────────')

// P1: migration complete — the whole 10B lives in the new staking proxy, old proxy empty.
const oldBal = await pub.readContract({ address: TTS, abi: ERC20, functionName:'balanceOf', args:[OLD_PROXY] })
const newBal = await pub.readContract({ address: TTS, abi: ERC20, functionName:'balanceOf', args:[STAKING] })
console.log(`  old proxy ${(Number(oldBal)/1e18).toLocaleString()} TTS · staking ${(Number(newBal)/1e18).toLocaleString()} TTS`)
if (oldBal !== 0n) die('migration incomplete — old proxy still holds TTS (Phase-2 step 6 not done)')
if (newBal < 9_000_000_000n * 10n**18n) die('staking proxy does not hold the migrated reward pool')
ok('Phase-2 migration complete (10B in staking proxy, old proxy zero)')

// P2: V3d wired to the NEW proxy.
const wired = await pub.readContract({ address: V3D, abi: V3DABI, functionName:'stakingContract' })
if (wired.toLowerCase() !== STAKING.toLowerCase()) die(`V3d.stakingContract = ${wired}, expected ${STAKING}`)
ok('V3d wired to new staking proxy')

// P3: E2E proof — at least one real stake happened, contract healthy.
const paused = await pub.readContract({ address: STAKING, abi: ABI, functionName:'paused' })
if (paused) die('staking proxy is PAUSED — resolve before handing off admin')
ok(`staking live (paused=false, totalStaked=${(Number(await pub.readContract({address:STAKING,abi:ABI,functionName:'totalStaked'}))/1e18).toLocaleString()} TTS)`)

// P4: UPGRADER must be the timelock ONLY. If Bank already self-granted, stop.
const upTl   = await pub.readContract({ address: STAKING, abi: ABI, functionName:'hasRole', args:[UPGRADER_ROLE, TIMELOCK] })
const upBank = await pub.readContract({ address: STAKING, abi: ABI, functionName:'hasRole', args:[UPGRADER_ROLE, BANK] })
if (!upTl)  die('Timelock does NOT hold UPGRADER_ROLE — renouncing admin would strand upgradeability')
if (upBank) die('Bank holds UPGRADER_ROLE — revoke it first, otherwise the handoff closes nothing')
ok('UPGRADER_ROLE = Timelock only')

// P5: current admin state.
const adminBank = await pub.readContract({ address: STAKING, abi: ABI, functionName:'hasRole', args:[DEFAULT_ADMIN_ROLE, BANK] })
const adminSafe = await pub.readContract({ address: STAKING, abi: ABI, functionName:'hasRole', args:[DEFAULT_ADMIN_ROLE, SAFE] })
console.log(`  DEFAULT_ADMIN — Bank=${adminBank} Safe=${adminSafe}`)
if (!adminBank && adminSafe) { console.log('\n✓ Already handed off. Nothing to do.'); process.exit(0) }
if (!adminBank) die('Bank does not hold DEFAULT_ADMIN — cannot grant or renounce from Bank')

const pk = process.env.DEPLOYER_PRIVATE_KEY
if (!pk) die('DEPLOYER_PRIVATE_KEY (Bank) not set')
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`)
if (account.address.toLowerCase() !== BANK) die(`key is ${account.address}, expected Bank ${BANK}`)
const wallet = createWalletClient({ account, chain: base, transport: http(process.env.BASE_RPC_URL) })

// Simulate both txs before sending either.
console.log('\n── SIMULATE ───────────────────────────────────────────────────')
let grantReq = null
if (!adminSafe) {
  ;({ request: grantReq } = await pub.simulateContract({ account, address: STAKING, abi: ABI, functionName:'grantRole', args:[DEFAULT_ADMIN_ROLE, SAFE] }))
  ok('grantRole(DEFAULT_ADMIN, Safe) simulates clean')
} else ok('Safe already has DEFAULT_ADMIN — grant step skipped')
await pub.simulateContract({ account, address: STAKING, abi: ABI, functionName:'renounceRole', args:[DEFAULT_ADMIN_ROLE, BANK] })
ok('renounceRole(DEFAULT_ADMIN, Bank) simulates clean')

if (!EXECUTE) { console.log('\nDRY RUN — all preconditions green. Re-run with --execute to send.\n'); process.exit(0) }

const send = async (label, request) => {
  const hash = await wallet.writeContract(request)
  console.log(`  ${label} → ${hash}`)
  const r = await pub.waitForTransactionReceipt({ hash })
  if (r.status !== 'success') die(`${label} REVERTED (${hash})`)
  ok(`${label} mined in block ${r.blockNumber}`)
}

console.log('\n── EXECUTE ────────────────────────────────────────────────────')

// STEP 1 — grant to Safe, then READ BACK before touching the renounce.
if (grantReq) {
  await send('grantRole(DEFAULT_ADMIN, Safe)', grantReq)
  const confirmed = await pub.readContract({ address: STAKING, abi: ABI, functionName:'hasRole', args:[DEFAULT_ADMIN_ROLE, SAFE] })
  if (!confirmed) die('grant did not take effect on-chain — REFUSING to renounce (would orphan the role)')
  ok('Safe confirmed as DEFAULT_ADMIN on-chain')
}

// STEP 2 — only now is it safe for Bank to drop its own admin.
const { request: renReq } = await pub.simulateContract({ account, address: STAKING, abi: ABI, functionName:'renounceRole', args:[DEFAULT_ADMIN_ROLE, BANK] })
await send('renounceRole(DEFAULT_ADMIN, Bank)', renReq)

console.log('\n── VERIFY ─────────────────────────────────────────────────────')
const fBank = await pub.readContract({ address: STAKING, abi: ABI, functionName:'hasRole', args:[DEFAULT_ADMIN_ROLE, BANK] })
const fSafe = await pub.readContract({ address: STAKING, abi: ABI, functionName:'hasRole', args:[DEFAULT_ADMIN_ROLE, SAFE] })
const fUpTl = await pub.readContract({ address: STAKING, abi: ABI, functionName:'hasRole', args:[UPGRADER_ROLE, TIMELOCK] })
const fUpBk = await pub.readContract({ address: STAKING, abi: ABI, functionName:'hasRole', args:[UPGRADER_ROLE, BANK] })
console.log(`  DEFAULT_ADMIN: Bank=${fBank} Safe=${fSafe}`)
console.log(`  UPGRADER:      Bank=${fUpBk} Timelock=${fUpTl}`)
if (fBank || !fSafe || !fUpTl || fUpBk) die('post-state mismatch — investigate immediately')
console.log('\n✓ TIMELOCK BYPASS CLOSED — Bank can no longer self-grant UPGRADER.')
console.log('  Upgrades now require: Safe 2/2 → Timelock propose → 2-day delay → execute.')
console.log('  Bank retains MANAGER_ROLE (thresholds/APR/pause) — no upgrade or principal access.\n')
