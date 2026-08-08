#!/usr/bin/env node
// Circulating supply for listing applications. Reads live balances so the number you
// submit is defensible on the day you submit it.
//   BASE_RPC_URL=... node outputs/listings/circulating.mjs
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { base } from 'viem/chains'

const TTS = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const ABI = parseAbi(['function totalSupply() view returns (uint256)','function balanceOf(address) view returns (uint256)'])

// Excluded from circulating: treasury, admin multisig, founder/team/dev/ecosystem, and the
// staking reward pool (contract-held, not on the market).
const EXCLUDED = [
  ['TTS Treasury',            '0xC3A3858A3777E4C9B542e60298c3161086c5Faae'],
  ['Gnosis Safe (2/2 admin)', '0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86'],
  ['Founder',                 '0xe5c3b6480164c20253c21928c699ab7fdb8a60e5'],
  ['Staking reward pool',     '0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d'],
  ['Ecosystem',               '0xc17c1b5f653d66dc3324a0dc09d5500500f24ade'],
  ['Development',             '0x95607DcF6c815e6A7cb79eb6199174DFADC78758'],
  ['Team',                    '0xb1c9868d4bfb10d2d7e51cd625889f2b9e1d4887'],
  ['Burned (dead address)',   '0x000000000000000000000000000000000000dEaD'],
]

const pub = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org') })
const total = await pub.readContract({ address: TTS, abi: ABI, functionName: 'totalSupply' })
const fmt = (v) => Number(formatUnits(v, 18)).toLocaleString('en-US', { maximumFractionDigits: 0 })

let excluded = 0n
console.log(`\nTemptation Token ($TTS) — circulating supply as of ${new Date().toISOString().slice(0,10)}\n`)
console.log(`Total supply:            ${fmt(total)} TTS\n`)
console.log('Excluded from circulating:')
for (const [label, addr] of EXCLUDED) {
  const b = await pub.readContract({ address: TTS, abi: ABI, functionName: 'balanceOf', args: [addr] })
  excluded += b
  console.log(`  ${label.padEnd(26)} ${fmt(b).padStart(18)} TTS   ${addr}`)
}
console.log(`  ${''.padEnd(26)} ${'—'.padStart(18)}`)
console.log(`  ${'TOTAL EXCLUDED'.padEnd(26)} ${fmt(excluded).padStart(18)} TTS\n`)
console.log(`CIRCULATING SUPPLY:      ${fmt(total - excluded)} TTS`)
console.log(`(= total ${fmt(total)} − excluded ${fmt(excluded)})\n`)
