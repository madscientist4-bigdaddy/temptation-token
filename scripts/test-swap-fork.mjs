#!/usr/bin/env node
/**
 * Swap-path test against an anvil fork of Base mainnet. No real funds move.
 *
 *   anvil --fork-url $BASE_RPC_URL --port 8546 --silent &
 *   node scripts/test-swap-fork.mjs
 *
 * Proves the things that are expensive to get wrong: that the impact guard actually
 * refuses, that a permitted swap really lands $TTS in the wallet, that the 1% transfer
 * tax does not revert the swap, and that minOut protects the user.
 */
import 'dotenv/config'
import { createPublicClient, createWalletClient, http, parseEther, formatUnits, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import {
  quote, executeSwap, reserves, impactBps, maxSpendUnderCeiling,
  MAX_IMPACT_BPS, TTS, ERC20_ABI, V2_ROUTER,
} from '../src/lib/swap.js'

const RPC = 'http://127.0.0.1:8546'
// anvil's first default account, funded with 10000 ETH on the fork.
const PK = '0xac0975bf2179a3f2a3f9b0e3f1e0b1e5e6b1f3e2d1c0b9a8978695a4b3c2d1e0f'
const ANVIL_PK = '0xac0dfb43e1a4f2a1f1e2c3d4b5a6978869504132a3b4c5d6e7f8091a2b3c4d5e'

const pub = createPublicClient({ chain: base, transport: http(RPC) })

let pass = 0, fail = 0
const ok = (c, m) => { console.log((c ? '  \x1b[32mPASS\x1b[0m  ' : '  \x1b[31mFAIL\x1b[0m  ') + m); c ? pass++ : fail++ }

// Grab a funded anvil account rather than hardcoding a key that may not exist.
const accounts = await pub.request({ method: 'eth_accounts' })
const who = accounts[0]

const ethUsd = 1882 // matches the measurement in swap.js's header comment
const usdToEth = (usd) => parseEther((usd / ethUsd).toFixed(18))

console.log('\n\x1b[1mSWAP PATH — anvil fork of Base mainnet\x1b[0m')
console.log(`  block ${await pub.getBlockNumber()}  ·  account ${who}\n`)

const res = await reserves(pub)
console.log(`  pool: ${formatUnits(res.tts, 18)} TTS / ${formatUnits(res.weth, 18)} WETH\n`)

// ── 1. the guard refuses what it should ──────────────────────────────────────
console.log('1. impact guard')
for (const usd of [10, 25, 50, 100, 250]) {
  const q = await quote(pub, { from: 'ETH', amountIn: usdToEth(usd) })
  const pct = (q.impact / 100).toFixed(1)
  if (usd <= 25) ok(q.ok, `$${usd} allowed (impact ${pct}%)`)
  else if (usd >= 100) ok(!q.ok && q.reason === 'IMPACT_TOO_HIGH', `$${usd} REFUSED (impact ${pct}%)`)
  else console.log(`  \x1b[2m----\x1b[0m  $${usd} impact ${pct}% (boundary, either verdict acceptable)`)
}

// ── 2. the refusal message is usable by a human ──────────────────────────────
console.log('\n2. refusal message')
const big = await quote(pub, { from: 'ETH', amountIn: usdToEth(250) })
ok(!big.ok, 'large buy refused')
ok(/won't let that through/i.test(big.message || ''), 'says we blocked it')
ok(/try a smaller amount/i.test(big.message || ''), 'tells the user what to do')
ok(!/slippage|bps|constant product|AMM/i.test(big.message || ''), 'no jargon in the message')
console.log(`  \x1b[2m"${(big.message || '').slice(0, 120)}…"\x1b[0m`)

// ── 3. maxSpendUnderCeiling is self-consistent ───────────────────────────────
console.log('\n3. maxSpendUnderCeiling')
const cap = maxSpendUnderCeiling(res)
const atCap = await quote(pub, { from: 'ETH', amountIn: cap })
const overCap = await quote(pub, { from: 'ETH', amountIn: (cap * 12n) / 10n })
ok(atCap.ok, `at the cap (${Number(formatUnits(cap, 18)).toFixed(5)} ETH ≈ $${(Number(formatUnits(cap,18))*ethUsd).toFixed(2)}) is allowed, impact ${(atCap.impact/100).toFixed(2)}%`)
ok(atCap.impact <= MAX_IMPACT_BPS, 'cap really sits at or under the ceiling')
ok(!overCap.ok, '20% above the cap is refused')

// ── 4. a permitted swap actually delivers TTS, through the 1% tax ────────────
console.log('\n4. live swap on the fork')
const wallet = createWalletClient({ chain: base, transport: http(RPC), account: who })
const before = await pub.readContract({ address: TTS, abi: ERC20_ABI, functionName: 'balanceOf', args: [who] })
const spend = usdToEth(15)
const q = await quote(pub, { from: 'ETH', amountIn: spend })
ok(q.ok, `$15 quote ok, expect ~${Number(formatUnits(q.ttsOut, 18)).toFixed(0)} TTS`)
try {
  const r = await executeSwap({ publicClient: pub, walletClient: wallet, account: who, from: 'ETH', amountIn: spend })
  const after = await pub.readContract({ address: TTS, abi: ERC20_ABI, functionName: 'balanceOf', args: [who] })
  const got = after - before
  ok(r.receipt.status === 'success', `swap mined (${r.receipt.status})`)
  ok(got > 0n, `wallet received ${Number(formatUnits(got, 18)).toFixed(0)} TTS`)
  ok(got >= q.minOut, `received >= minOut (${Number(formatUnits(q.minOut,18)).toFixed(0)}) — slippage guard held`)
  // TTS taxes 1% on transfer, so delivered lands just under the router's quote.
  const shortfall = Number((q.ttsOut - got) * 10000n / q.ttsOut) / 100
  ok(shortfall >= 0 && shortfall < 3, `delivered vs quoted shortfall ${shortfall.toFixed(2)}% (1% transfer tax expected)`)
} catch (e) {
  ok(false, `swap threw: ${e.message.slice(0, 120)}`)
}

// ── 5. refusal is enforced at execute, not only at quote ─────────────────────
console.log('\n5. execute re-checks the guard')
try {
  await executeSwap({ publicClient: pub, walletClient: wallet, account: who, from: 'ETH', amountIn: usdToEth(500) })
  ok(false, 'executeSwap should have thrown on a >5% impact trade')
} catch (e) {
  ok(e.reason === 'IMPACT_TOO_HIGH', `executeSwap refused before sending (${e.reason})`)
}

console.log(`\n${fail ? '\x1b[31m' : '\x1b[32m'}${pass} passed, ${fail} failed\x1b[0m\n`)
process.exit(fail ? 1 : 0)
