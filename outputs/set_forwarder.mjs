#!/usr/bin/env node
/**
 * set_forwarder.mjs — One-shot: call Keeper2V2.setForwarder() then verify.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x<key> node outputs/set_forwarder.mjs
 *
 * Optional override:
 *   BASE_RPC_URL=https://... DEPLOYER_PRIVATE_KEY=0x<key> node outputs/set_forwarder.mjs
 */

import { createPublicClient, createWalletClient, http, parseAbi } from '../node_modules/viem/_esm/index.js'
import { privateKeyToAccount } from '../node_modules/viem/_esm/accounts/index.js'

const RPC       = process.env.BASE_RPC_URL || 'https://rpc.ankr.com/base'
const KEEPER    = '0x24107a47D24443D263bc4B06d11C61fCE98C3964'
const FORWARDER = '0x68Ae2a7d8c9Ec360EFe2FeD40763D4F353C2fd71'
const BANK_ADDR = '0xb1e991bf617459b58964eef7756b350e675c53b5'
const BASE      = { id: 8453, name: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } }

const ABI = parseAbi([
  'function setForwarder(address _forwarder) external',
  'function s_forwarder() external view returns (address)',
  'function owner() external view returns (address)',
])

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function withRetry(fn, label, max = 5) {
  for (let i = 0; i < max; i++) {
    try { return await fn() } catch (e) {
      const is429 = /429|rate.?limit/i.test(String(e))
      if (!is429 || i === max - 1) throw e
      const d = 1000 * Math.pow(2, i)
      console.warn(`  429 on ${label} — retry ${i + 1} in ${d}ms`)
      await sleep(d)
    }
  }
}

async function main() {
  console.log(`\n  RPC:      ${RPC}`)
  console.log(`  Keeper:   ${KEEPER}`)
  console.log(`  Forwarder: ${FORWARDER}`)

  const transport   = http(RPC, { retryCount: 3, retryDelay: 1000 })
  const publicClient = createPublicClient({ chain: BASE, transport })

  // ── Signer check ─────────────────────────────────────────────────────────
  const rawKey = process.env.DEPLOYER_PRIVATE_KEY
  if (!rawKey) { console.error('DEPLOYER_PRIVATE_KEY not set'); process.exit(1) }
  const key     = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key)
  if (account.address.toLowerCase() !== BANK_ADDR.toLowerCase()) {
    console.error(`ABORT: key maps to ${account.address}, expected ${BANK_ADDR}`)
    process.exit(1)
  }
  console.log(`  Signer:   ${account.address} ✓`)

  // ── Pre-flight: already set? ──────────────────────────────────────────────
  const current = await withRetry(() => publicClient.readContract({ address: KEEPER, abi: ABI, functionName: 's_forwarder' }), 's_forwarder pre')
  if (current.toLowerCase() === FORWARDER.toLowerCase()) {
    console.log('\n  Already set — no transaction needed.')
  } else {
    // ── Send setForwarder ─────────────────────────────────────────────────
    const walletClient = createWalletClient({ account, chain: BASE, transport })
    console.log('\n  Sending setForwarder()...')
    const tx = await withRetry(() => walletClient.writeContract({
      address: KEEPER, abi: ABI, functionName: 'setForwarder', args: [FORWARDER],
    }), 'setForwarder')
    console.log(`  TX: ${tx}`)
    await publicClient.waitForTransactionReceipt({ hash: tx })
    console.log('  Confirmed.')
    await sleep(500)
  }

  // ── Verify 1: s_forwarder readback ────────────────────────────────────────
  const fwd = await withRetry(() => publicClient.readContract({ address: KEEPER, abi: ABI, functionName: 's_forwarder' }), 's_forwarder post')
  const fwdOk = fwd.toLowerCase() === FORWARDER.toLowerCase()
  console.log(`\n── Verify 1: s_forwarder() ─────────────────────────────────────`)
  console.log(`  ${fwd}`)
  console.log(`  ${fwdOk ? '✅ matches expected forwarder' : '❌ MISMATCH'}`)
  if (!fwdOk) process.exit(1)

  // ── Verify 2: forwarder bytecode > 0 ─────────────────────────────────────
  await sleep(250)
  const code = await withRetry(() => publicClient.getBytecode({ address: FORWARDER }), 'forwarder bytecode')
  const codeSize = code ? (code.length - 2) / 2 : 0   // hex chars minus '0x', div 2
  const hasCode  = codeSize > 0
  console.log(`\n── Verify 2: forwarder bytecode ────────────────────────────────`)
  console.log(`  Code size: ${codeSize} bytes`)
  console.log(`  ${hasCode ? '✅ live contract — Chainlink forwarder confirmed' : '❌ NO CODE — dead address, do not use'}`)
  if (!hasCode) process.exit(1)

  console.log('\n  ✅ setForwarder complete. Chainlink automation is now fully wired.')
}

main().catch(e => { console.error(e); process.exit(1) })
