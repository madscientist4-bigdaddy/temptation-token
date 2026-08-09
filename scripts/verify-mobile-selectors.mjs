#!/usr/bin/env node
/**
 * Guards the hard-coded function selectors in mobile/src/lib/chain.ts.
 *
 * The mobile app cannot ship viem (native/bundle weight in Expo Go), so it encodes calls
 * by hand against a table of selectors. This repo has already lost a day to a wrong
 * hard-coded selector once (`getProfile` on the admin dashboard), so the table is
 * machine-checked instead of trusted: every entry is re-derived from its signature and,
 * with a BASE_RPC_URL present, actually called on mainnet.
 *
 * Run: node scripts/verify-mobile-selectors.mjs
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { toFunctionSelector } from 'viem'

// name in the SEL table → the real signature it must encode.
const EXPECTED = {
  totalStaked: 'totalStaked()',
  rewardSurplus: 'rewardSurplus()',
  paused: 'paused()',
  tierBronze: 'tierThresholdBronze()',
  tierSilver: 'tierThresholdSilver()',
  tierGold: 'tierThresholdGold()',
  tierDiamond: 'tierThresholdDiamond()',
  tierVIP: 'tierThresholdVIP()',
  aprBronze: 'aprBronze()',
  aprSilver: 'aprSilver()',
  aprGold: 'aprGold()',
  aprDiamond: 'aprDiamond()',
  aprVip: 'aprVip()',
  getStakeDetails: 'getStakeDetails(address)',
  balanceOf: 'balanceOf(address)',
  currentRoundId: 'currentRoundId()',
}

const STAKING = '0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d'
const TTS = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const VOTING = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const TARGET = { balanceOf: TTS, currentRoundId: VOTING }

const src = readFileSync(new URL('../mobile/src/lib/chain.ts', import.meta.url), 'utf8')
const table = {}
for (const m of src.matchAll(/^\s*(\w+):\s*'(0x[0-9a-f]{8})',/gim)) table[m[1]] = m[2]

let bad = 0
const check = (ok, msg) => { console.log(`${ok ? '  ok  ' : ' FAIL '} ${msg}`); if (!ok) bad++ }

console.log('Derived-selector check (mobile/src/lib/chain.ts):')
for (const [name, sig] of Object.entries(EXPECTED)) {
  const want = toFunctionSelector('function ' + sig)
  const got = table[name]
  check(got === want, `${name.padEnd(16)} ${sig.padEnd(26)} ${got || '(missing)'}${got === want ? '' : ` != ${want}`}`)
}
const extra = Object.keys(table).filter((k) => !(k in EXPECTED))
check(extra.length === 0, `no unchecked entries in SEL (${extra.length ? extra.join(', ') : 'none'})`)

// Live check — a correct-looking selector that reverts on the deployed contract is still
// wrong, which is exactly how the getProfile bug survived review.
const RPC = process.env.BASE_RPC_URL
if (!RPC) {
  console.log('\nBASE_RPC_URL not set — skipping the live mainnet check.')
} else {
  console.log('\nLive eth_call check against Base mainnet:')
  const call = async (to, data) => {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    })
    const j = await r.json()
    return j.error ? null : j.result
  }
  const ADDR_ARG = '0'.repeat(24) + 'b1e991bf617459b58964eef7756b350e675c53b5'
  for (const [name, sig] of Object.entries(EXPECTED)) {
    const to = TARGET[name] || STAKING
    const data = table[name] + (sig.includes('address') ? ADDR_ARG : '')
    const res = await call(to, data)
    check(res != null && res !== '0x', `${name.padEnd(16)} → ${res == null ? 'reverted' : res.slice(0, 26) + '…'}`)
  }
}

console.log(bad === 0 ? '\nPASS  mobile selector table verified.' : `\nFAIL  ${bad} problem(s).`)
process.exit(bad === 0 ? 0 : 1)
