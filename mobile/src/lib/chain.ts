// Minimal read-only chain access for Expo Go.
//
// The web app uses viem/wagmi, but those pull a large dependency graph and (via the
// wallet SDK) native modules Expo Go cannot load. Everything the mobile app needs is
// `eth_call` against view functions with at most one address argument, so a hand-rolled
// encoder is a few dozen lines and keeps the Expo Go bundle clean. Writes NEVER happen
// here — they live behind WALLET_ENABLED in src/wallet/*.
//
// SELECTORS ARE HARD-CODED, which this repo has been bitten by before: a wrong
// hard-coded getProfile selector silently broke per-profile reads on the admin
// dashboard. Two guards against a repeat:
//   1. Every selector below was derived with viem AND verified with a live eth_call
//      against the deployed contracts on Base mainnet on 2026-08-08.
//   2. `npm run verify:selectors` (scripts/verify-mobile-selectors.mjs at the repo root)
//      re-derives all of them from the signatures and fails on any mismatch. Run it if
//      you touch this table.
import { ADDRESSES, CHAIN_ID } from '../config/contracts'

// Reads only, and the app degrades to "—" if unreachable, so an outage is cosmetic
// rather than blocking.
//
// PRIMARY is our own cached proxy — the same one the web app uses. The public endpoint
// rate-limits under real load, and during the 2026-08-16 device pass it did exactly
// that: the Staking screen showed "Could not reach Base right now" while the identical
// call through the proxy succeeded. FALLBACK keeps the app working if our API is down,
// so this is strictly more available than either endpoint alone.
const RPC_PRIMARY = 'https://app.temptationtoken.io/api/rpc'
const RPC_FALLBACK = 'https://mainnet.base.org'

export const STAKING_ADDRESS = '0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d'

/** selector → the signature it was derived from (kept adjacent so drift is visible). */
export const SEL = {
  // TTSStaking 0x7848cc…
  totalStaked: '0x817b1cd2', //          totalStaked()
  rewardSurplus: '0x6fc6ecd7', //        rewardSurplus()
  paused: '0x5c975abb', //               paused()
  tierBronze: '0x9e2349e1', //           tierThresholdBronze()
  tierSilver: '0xc311e25a', //           tierThresholdSilver()
  tierGold: '0xe92c7a4d', //             tierThresholdGold()
  tierDiamond: '0x6d7eede8', //          tierThresholdDiamond()
  tierVIP: '0x0dbd1c34', //              tierThresholdVIP()
  aprBronze: '0x8273a872', //            aprBronze()
  aprSilver: '0xef128647', //            aprSilver()
  aprGold: '0x71d0d1a3', //              aprGold()
  aprDiamond: '0xe17e94b7', //           aprDiamond()
  aprVip: '0xd1e8072f', //               aprVip()
  getStakeDetails: '0xf41322ac', //      getStakeDetails(address)
  // TTS token 0x5570eA97…
  balanceOf: '0x70a08231', //            balanceOf(address)
  // TTSVotingV3d 0x783b8cd8…
  currentRoundId: '0x9cbe5efd', //       currentRoundId()
} as const

const encodeAddress = (a: string) => a.toLowerCase().replace(/^0x/, '').padStart(64, '0')

async function ethCallVia(url: string, to: string, data: string): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    })
    const j = await r.json()
    // A revert is a legitimate answer here (e.g. getStakingTier on a non-staker), not an
    // error to surface — callers treat null as "no data".
    if (j.error || typeof j.result !== 'string') return null
    return j.result
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * One eth_call, proxy first then public. Returns the raw hex, or null if both fail.
 *
 * A null from the primary is indistinguishable here from a revert, so the fallback runs
 * in both cases. That costs one extra request on a genuine revert, which is rare on these
 * read paths and much cheaper than showing a funded user an empty screen.
 */
export async function ethCall(to: string, data: string): Promise<string | null> {
  const primary = await ethCallVia(RPC_PRIMARY, to, data)
  if (primary != null) return primary
  return ethCallVia(RPC_FALLBACK, to, data)
}

export const word = (hex: string, i: number): bigint => {
  const start = 2 + i * 64
  const slice = hex.slice(start, start + 64)
  if (slice.length < 64) return 0n
  return BigInt('0x' + slice)
}

/** Signed 256-bit word — getStakeDetails returns tierByAmount as int256 (-1 = no tier). */
const wordSigned = (hex: string, i: number): bigint => {
  const v = word(hex, i)
  const MAX = 1n << 255n
  return v >= MAX ? v - (1n << 256n) : v
}

async function callUint(to: string, selector: string): Promise<bigint | null> {
  const r = await ethCall(to, selector)
  return r && r.length >= 66 ? word(r, 0) : null
}

export type StakingStats = {
  totalStaked: bigint
  rewardPool: bigint
  paused: boolean
  thresholds: bigint[] // Bronze, Silver, Gold, Diamond, VIP (wei)
  aprBps: number[] // same order, basis points
}

/** Contract-wide staking numbers. Any individual failure degrades to a null field. */
export async function readStakingStats(): Promise<StakingStats | null> {
  const [total, pool, paused, b, s, g, d, v, ab, as_, ag, ad, av] = await Promise.all([
    callUint(STAKING_ADDRESS, SEL.totalStaked),
    callUint(STAKING_ADDRESS, SEL.rewardSurplus),
    callUint(STAKING_ADDRESS, SEL.paused),
    callUint(STAKING_ADDRESS, SEL.tierBronze),
    callUint(STAKING_ADDRESS, SEL.tierSilver),
    callUint(STAKING_ADDRESS, SEL.tierGold),
    callUint(STAKING_ADDRESS, SEL.tierDiamond),
    callUint(STAKING_ADDRESS, SEL.tierVIP),
    callUint(STAKING_ADDRESS, SEL.aprBronze),
    callUint(STAKING_ADDRESS, SEL.aprSilver),
    callUint(STAKING_ADDRESS, SEL.aprGold),
    callUint(STAKING_ADDRESS, SEL.aprDiamond),
    callUint(STAKING_ADDRESS, SEL.aprVip),
  ])
  if (total == null || b == null || ab == null) return null
  return {
    totalStaked: total,
    rewardPool: pool ?? 0n,
    paused: paused === 1n,
    thresholds: [b, s ?? 0n, g ?? 0n, d ?? 0n, v ?? 0n],
    aprBps: [ab, as_ ?? 0n, ag ?? 0n, ad ?? 0n, av ?? 0n].map(Number),
  }
}

export type StakePosition = {
  principal: bigint
  eligibleAt: number // unix seconds; 0 when not staked
  eligibleNow: boolean
  tierByAmount: number // -1 = below Bronze
  aprBps: number
  pending: bigint
  claimableNow: bigint
}

/**
 * A wallet's staking position.
 * getStakeDetails(address) returns
 *   (uint256 principal, uint256 eligibleAt, bool eligibleNow, int256 tierByAmount,
 *    uint16 aprBps, uint256 pending, uint256 claimableNow)
 * — all static types, so each occupies exactly one 32-byte word in order.
 */
export async function readStakePosition(address: string): Promise<StakePosition | null> {
  const r = await ethCall(STAKING_ADDRESS, SEL.getStakeDetails + encodeAddress(address))
  if (!r || r.length < 2 + 64 * 7) return null
  return {
    principal: word(r, 0),
    eligibleAt: Number(word(r, 1)),
    eligibleNow: word(r, 2) === 1n,
    tierByAmount: Number(wordSigned(r, 3)),
    aprBps: Number(word(r, 4)),
    pending: word(r, 5),
    claimableNow: word(r, 6),
  }
}

/** TTS balance in wei, or null if unreachable. */
export function readTtsBalance(address: string): Promise<bigint | null> {
  return ethCall(ADDRESSES.ttsToken, SEL.balanceOf + encodeAddress(address)).then((r) =>
    r && r.length >= 66 ? word(r, 0) : null
  )
}

/** Current on-chain round id from TTSVotingV3d. */
export function readCurrentRoundId(): Promise<bigint | null> {
  return callUint(ADDRESSES.votingV3d, SEL.currentRoundId)
}

export const isAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test((a || '').trim())

/**
 * Decimal string → wei, with no float in the path.
 *
 * The obvious `BigInt(Math.round(n * 1e6)) * 10n ** 12n` silently loses precision above
 * ~9e9 $TTS, because n * 1e6 passes Number.MAX_SAFE_INTEGER — and 9e9 is a perfectly
 * ordinary balance here (the founder wallet holds 10B). Parsing the digits directly has
 * no such ceiling.
 *
 * Returns null for anything that is not a plain non-negative decimal.
 */
export function parseTts(input: string, decimals = 18): bigint | null {
  const s = (input || '').trim().replace(/,/g, '')
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null
  const [whole = '', frac = ''] = s.split('.')
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  try {
    return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fracPadded || '0')
  } catch {
    return null
  }
}

/** wei → display string. Not for arithmetic — presentation only. */
export function formatTTS(wei: bigint, decimals = 2): string {
  const neg = wei < 0n
  const v = neg ? -wei : wei
  const whole = v / 10n ** 18n
  const frac = ((v % 10n ** 18n) * 10n ** BigInt(decimals)) / 10n ** 18n
  const fracStr = decimals > 0 ? '.' + frac.toString().padStart(decimals, '0') : ''
  return (neg ? '-' : '') + whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + fracStr
}

/** Compact form for headline figures: 10B, 1.2M, 6,000. */
export function compactTTS(wei: bigint): string {
  const whole = wei / 10n ** 18n
  if (whole >= 1_000_000_000n) return (Number(whole / 1_000_000n) / 1000).toFixed(whole % 1_000_000_000n === 0n ? 0 : 2) + 'B'
  if (whole >= 1_000_000n) return (Number(whole / 1_000n) / 1000).toFixed(2) + 'M'
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export { CHAIN_ID }
