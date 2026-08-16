// Guarded swap quoting for the mobile Get-$TTS sheet.
//
// Mirrors the web app's src/lib/swap.js contract in the part that matters most: the TTS
// pool is thin (~$2k), so ANY purchase whose price impact exceeds 5% is refused outright.
// That ceiling is the product decision — we would rather sell nothing than sell someone a
// trade that moves the price against them — so it is enforced at quote time here too,
// not merely displayed.
//
// Reads reuse the hand-rolled eth_call in ./chain (no viem/wagmi), so the quote and the
// refusal work in every build, including the ones with no wallet SDK linked.
import { ethCall, word } from './chain'

/** Uniswap V2 TTS/WETH pair on Base. LP locked → 2027-05-05. */
export const PAIR_ADDRESS = '0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68'
export const WETH_ADDRESS = '0x4200000000000000000000000000000000000006'
export const TTS_ADDRESS = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'

const SEL_GET_RESERVES = '0x0902f1ac' // getReserves()
const SEL_TOKEN0 = '0x0dfe1681' //       token0()

/** The refusal ceiling, in basis points. 500 = 5%. Same number as the web app. */
export const MAX_IMPACT_BPS = 500

export type Reserves = { tts: bigint; weth: bigint }

/**
 * Live pool reserves, oriented so the caller never has to know the token ordering.
 * token0() is read rather than assumed — the ordering is by address and a wrong guess
 * would invert every quote silently.
 */
export async function readReserves(): Promise<Reserves | null> {
  const [res, t0] = await Promise.all([
    ethCall(PAIR_ADDRESS, SEL_GET_RESERVES),
    ethCall(PAIR_ADDRESS, SEL_TOKEN0),
  ])
  if (!res || res.length < 2 + 64 * 3 || !t0) return null
  const r0 = word(res, 0)
  const r1 = word(res, 1)
  const token0 = '0x' + t0.slice(-40)
  const wethIsToken0 = token0.toLowerCase() === WETH_ADDRESS.toLowerCase()
  return wethIsToken0 ? { weth: r0, tts: r1 } : { weth: r1, tts: r0 }
}

export type Quote = {
  /** $TTS received, in wei. */
  out: bigint
  /** Price impact in basis points. */
  impactBps: number
  /** True when the trade is within the 5% ceiling and may be offered. */
  allowed: boolean
}

/**
 * Constant-product quote for spending `ethIn` wei of WETH, including the 0.3% LP fee.
 *
 * Impact is measured against the spot price BEFORE the trade — the honest definition.
 * Quoting against the post-trade price would flatter every large order, which is exactly
 * the order we are trying to refuse.
 */
export function quoteEthForTts(ethIn: bigint, r: Reserves): Quote {
  if (ethIn <= 0n || r.tts <= 0n || r.weth <= 0n) return { out: 0n, impactBps: 0, allowed: false }
  const inWithFee = ethIn * 997n
  const out = (inWithFee * r.tts) / (r.weth * 1000n + inWithFee)
  if (out <= 0n) return { out: 0n, impactBps: 0, allowed: false }

  // spot = tts per weth, scaled by 1e18 to stay in integers.
  const SCALE = 10n ** 18n
  const spotOut = (ethIn * r.tts) / r.weth // what a zero-impact trade would have returned
  const impactBps = spotOut > 0n ? Number(((spotOut - out) * 10000n) / spotOut) : 0
  void SCALE
  return { out, impactBps, allowed: impactBps <= MAX_IMPACT_BPS }
}

/**
 * The largest ETH spend that still sits under the impact ceiling.
 * Solved by bisection rather than algebra: the closed form is easy to get subtly wrong,
 * and this runs once per sheet open on numbers this small.
 */
export function maxSpendUnderCeiling(r: Reserves): bigint {
  if (r.weth <= 0n) return 0n
  let lo = 0n
  let hi = r.weth // spending a full reserve is far beyond the ceiling; a safe upper bound
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2n
    if (mid === lo) break
    if (quoteEthForTts(mid, r).impactBps <= MAX_IMPACT_BPS) lo = mid
    else hi = mid
  }
  return lo
}
