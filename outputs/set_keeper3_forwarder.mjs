#!/usr/bin/env node
/**
 * set_keeper3_forwarder.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE PURPOSE: wire the DON-assigned Chainlink forwarder into TTSKeeper3 by
 * calling Keeper3.setForwarder(<forwarder>) from the Bank wallet (Keeper3 owner).
 *
 * This script does ONE on-chain write — setForwarder — and NOTHING else.
 * It NEVER calls transferAndCall, registerUpkeep, or registers anything.
 * It is intentionally separate from register_keeper3_upkeep.mjs (do not merge).
 *
 * Confirmed facts (verified on-chain 2026-06-20):
 *   Upkeep ID (decimal): 113446314522587151772280129999432062856069985411437977877707978564657748455208
 *   Upkeep ID (hex):     0xfad056ac000000000000000000000000beb8c51eb230bfb387eb031c4b252f28
 *     (decoded from UpkeepRegistered event in registration tx
 *      0x1183793582033432a03d1aae93ee96e1b83db6941953085de8275da6c3c8caa3)
 *   Registry.getForwarder(ID) = 0x1af4b2284bda534a54b6e9979dca250fe05ddd82 (has bytecode)
 *   getUpkeep target = TTSKeeper3, balance 10 LINK, paused=false, not cancelled.
 *
 * Pre-flight (aborts on any failure):
 *   1. signer address == Bank 0xb1e991bf617459b58964eef7756b350e675c53b5
 *   2. Keeper3.owner() == signer
 *   3. Keeper3.s_forwarder() == 0x0  (abort if already set — idempotent guard)
 *
 * Run:
 *   BASE_RPC_URL=https://... DEPLOYER_PRIVATE_KEY=0x<bank_key> \
 *     node outputs/set_keeper3_forwarder.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  createPublicClient, createWalletClient, http, getAddress,
} from '../node_modules/viem/_esm/index.js'
import { privateKeyToAccount } from '../node_modules/viem/_esm/accounts/index.js'
import { base } from '../node_modules/viem/_esm/chains/index.js'

// ── Constants ───────────────────────────────────────────────────────────────
const KEEPER3   = getAddress('0x363ce4960e3b459f5892587a37ae1ff2ed04442c')
const FORWARDER = getAddress('0x1af4b2284bda534a54b6e9979dca250fe05ddd82')
const BANK      = getAddress('0xb1e991bf617459b58964eef7756b350e675c53b5')
const ZERO      = '0x0000000000000000000000000000000000000000'

const KEEPER3_ABI = [
  { name: 'owner',        type: 'function', stateMutability: 'view',        inputs: [], outputs: [{ type: 'address' }] },
  { name: 's_forwarder',  type: 'function', stateMutability: 'view',        inputs: [], outputs: [{ type: 'address' }] },
  { name: 'setForwarder', type: 'function', stateMutability: 'nonpayable',  inputs: [{ name: '_forwarder', type: 'address' }], outputs: [] },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const eq = (a, b) => a.toLowerCase() === b.toLowerCase()
const die = (msg) => { console.error(`\n❌ ABORT: ${msg}`); process.exit(1) }

async function main() {
  // ── Env ───────────────────────────────────────────────────────────────────
  const rpc = process.env.BASE_RPC_URL
  const rawKey = process.env.DEPLOYER_PRIVATE_KEY
  if (!rpc)    die('BASE_RPC_URL not set (required)')
  if (!rawKey) die('DEPLOYER_PRIVATE_KEY not set (Bank wallet key, required)')
  const key = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`

  const account = privateKeyToAccount(key)
  const transport = http(rpc)
  const publicClient = createPublicClient({ chain: base, transport })
  const walletClient = createWalletClient({ account, chain: base, transport })

  console.log('══ set_keeper3_forwarder ════════════════════════════════════════')
  console.log('  Keeper3   :', KEEPER3)
  console.log('  Forwarder :', FORWARDER)
  console.log('  Signer    :', account.address)

  // ── Pre-flight 1: signer == Bank ────────────────────────────────────────────
  if (!eq(account.address, BANK)) {
    die(`signer ${account.address} is not the Bank wallet ${BANK}`)
  }
  console.log('  ✓ signer == Bank')

  // ── Pre-flight 2: Keeper3.owner() == signer ────────────────────────────────
  const owner = await publicClient.readContract({ address: KEEPER3, abi: KEEPER3_ABI, functionName: 'owner' })
  if (!eq(owner, account.address)) {
    die(`Keeper3.owner() = ${owner}, not signer ${account.address}`)
  }
  console.log('  ✓ Keeper3.owner() == signer')

  // ── Pre-flight 3: s_forwarder() == 0x0 (idempotent guard) ──────────────────
  const current = await publicClient.readContract({ address: KEEPER3, abi: KEEPER3_ABI, functionName: 's_forwarder' })
  if (!eq(current, ZERO)) {
    if (eq(current, FORWARDER)) {
      console.log(`\n✓ ALREADY SET: Keeper3.s_forwarder() == ${current}. Nothing to do.`)
      process.exit(0)
    }
    die(`Keeper3.s_forwarder() already set to ${current} (expected 0x0). Refusing to overwrite.`)
  }
  console.log('  ✓ Keeper3.s_forwarder() == 0x0 (unset)')

  // ── Forwarder sanity: must have bytecode ───────────────────────────────────
  const fwdCode = await publicClient.getBytecode({ address: FORWARDER })
  if (!fwdCode || fwdCode === '0x') die(`forwarder ${FORWARDER} has no bytecode`)
  console.log(`  ✓ forwarder has bytecode (${(fwdCode.length - 2) / 2} bytes)`)

  // ── Send setForwarder ──────────────────────────────────────────────────────
  console.log('\n── Sending Keeper3.setForwarder(forwarder) from Bank ──')
  const hash = await walletClient.writeContract({
    address: KEEPER3, abi: KEEPER3_ABI, functionName: 'setForwarder', args: [FORWARDER],
  })
  console.log('  tx hash:', hash)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') die(`setForwarder tx reverted (${hash})`)
  console.log('  ✓ mined in block', receipt.blockNumber.toString(), '| status:', receipt.status)

  // ── 5s pause + read-back ───────────────────────────────────────────────────
  console.log('\n── Waiting 5s before read-back ──')
  await sleep(5000)

  const after = await publicClient.readContract({ address: KEEPER3, abi: KEEPER3_ABI, functionName: 's_forwarder' })
  console.log('  Keeper3.s_forwarder() =', after)
  if (!eq(after, FORWARDER)) {
    die(`read-back mismatch: s_forwarder() = ${after}, expected ${FORWARDER}`)
  }

  console.log('\n✅ SUCCESS')
  console.log('  tx:           ', hash)
  console.log('  s_forwarder:  ', after)
  console.log('  Next: confirm V3d upkeep fires on next performUpkeep, then cancel old V3c upkeep.')
}

main().catch((e) => { console.error('\n❌ ERROR:', e?.shortMessage || e?.message || e); process.exit(1) })
