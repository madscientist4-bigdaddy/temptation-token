// ── Uniswap V2 swap: quote, price impact, slippage guard, execute ────────────
//
// This is the leg that turns ETH/USDC into $TTS. It is deliberately conservative,
// because the $TTS pool is thin enough that a routine purchase moves the price a long
// way, and a user who pays a card fee and then eats 20% slippage has been harmed by us.
//
// The impact ceiling is not decoration. Measured on Base mainnet 2026-08-11 the pool held
// 107,000 TTS / 0.50 WETH (~$1,880 total), which puts price impact at roughly:
//     $10 -> 1.3%      $25 -> 2.9%      $50 -> 5.3%      $100 -> 9.9%      $250 -> 21.2%
// So MAX_IMPACT_BPS = 500 refuses anything much over ~$47 at that depth. That is the
// correct behaviour, not a bug to tune away — see maxSpendUnderCeiling(), which is what
// the UI should use to cap what it offers BEFORE sending anyone to a card checkout.

import { parseAbi, formatUnits, parseUnits } from 'viem'

// Base mainnet.
export const WETH = '0x4200000000000000000000000000000000000006'
export const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const TTS = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
export const V2_ROUTER = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' // Uniswap V2 router02
export const V2_PAIR_TTS_WETH = '0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68'

export const MAX_IMPACT_BPS = 500 // 5.00% — hard refuse above this
export const DEFAULT_SLIPPAGE_BPS = 100 // 1.00% tolerance on minOut
export const DEADLINE_SECONDS = 900 // 15 min

export const ROUTER_ABI = parseAbi([
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
])
export const PAIR_ABI = parseAbi([
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
])
export const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
])

export const pathFor = (from) =>
  from === 'ETH' ? [WETH, TTS] : [USDC, WETH, TTS]

/** Reserves oriented as { tts, weth } regardless of pair token ordering. */
export async function reserves(publicClient) {
  const [r, t0] = await Promise.all([
    publicClient.readContract({ address: V2_PAIR_TTS_WETH, abi: PAIR_ABI, functionName: 'getReserves' }),
    publicClient.readContract({ address: V2_PAIR_TTS_WETH, abi: PAIR_ABI, functionName: 'token0' }),
  ])
  const ttsIsToken0 = t0.toLowerCase() === TTS.toLowerCase()
  return { tts: ttsIsToken0 ? r[0] : r[1], weth: ttsIsToken0 ? r[1] : r[0] }
}

/**
 * Price impact in basis points.
 *
 * Measured against the SPOT price of the TTS/WETH pool, not against the router's own
 * output — comparing the router to itself would always report ~0 and hide exactly the
 * cost we are trying to show. For the USDC route only the TTS/WETH hop is charged here;
 * the USDC/WETH leg is deep and its impact is negligible by comparison.
 */
export function impactBps({ wethIn, ttsOut, res }) {
  if (wethIn <= 0n || ttsOut <= 0n || res.weth === 0n) return 0
  // spotOut = wethIn * (ttsReserve / wethReserve), in wei-precision integer math
  const spotOut = (wethIn * res.tts) / res.weth
  if (spotOut === 0n) return 0
  const lost = spotOut > ttsOut ? spotOut - ttsOut : 0n
  return Number((lost * 10_000n) / spotOut)
}

/** Largest WETH spend that keeps impact at or under `ceilingBps`. Binary search. */
export function maxSpendUnderCeiling(res, ceilingBps = MAX_IMPACT_BPS) {
  if (res.weth === 0n || res.tts === 0n) return 0n
  const out = (dw) => {
    const inWithFee = (dw * 997n) / 1000n
    return (inWithFee * res.tts) / (res.weth + inWithFee)
  }
  let lo = 0n
  let hi = res.weth // spending a full reserve is far past any sane ceiling
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2n
    if (mid === lo) break
    const bps = impactBps({ wethIn: mid, ttsOut: out(mid), res })
    if (bps <= ceilingBps) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * Quote a purchase.
 * @returns {{ok, amountsOut, ttsOut, impact, minOut, reason, maxSpendWeth}}
 */
export async function quote(publicClient, { from, amountIn }) {
  const path = pathFor(from)
  const res = await reserves(publicClient)

  let amounts
  try {
    amounts = await publicClient.readContract({
      address: V2_ROUTER, abi: ROUTER_ABI, functionName: 'getAmountsOut',
      args: [amountIn, path],
    })
  } catch (e) {
    return { ok: false, reason: 'NO_ROUTE', message: 'No route to $TTS right now. Try again shortly.' }
  }

  const ttsOut = amounts[amounts.length - 1]
  const wethIn = from === 'ETH' ? amountIn : amounts[1]
  const impact = impactBps({ wethIn, ttsOut, res })
  const minOut = (ttsOut * BigInt(10_000 - DEFAULT_SLIPPAGE_BPS)) / 10_000n
  const maxSpendWeth = maxSpendUnderCeiling(res)

  if (ttsOut === 0n) {
    return { ok: false, reason: 'ZERO_OUT', impact, maxSpendWeth,
             message: 'That amount is too small to return any $TTS after fees.' }
  }

  if (impact > MAX_IMPACT_BPS) {
    return {
      ok: false, reason: 'IMPACT_TOO_HIGH', impact, ttsOut, minOut, amounts, maxSpendWeth,
      // Plain English. No jargon, and it says what to DO, not just what went wrong.
      message:
        `This purchase would move the $TTS price by about ${(impact / 100).toFixed(1)}%, ` +
        `so you'd get noticeably less $TTS than the headline price. We won't let that ` +
        `through. Try a smaller amount — around ${formatUnits(maxSpendWeth, 18)} ETH ` +
        `or less is currently within our 5% limit.`,
    }
  }

  return { ok: true, amounts, ttsOut, minOut, impact, maxSpendWeth, path }
}

/** Execute. Caller must have quoted first; we re-quote and re-check before sending. */
export async function executeSwap({ publicClient, walletClient, account, from, amountIn }) {
  const q = await quote(publicClient, { from, amountIn })
  if (!q.ok) throw Object.assign(new Error(q.message), { reason: q.reason, impact: q.impact })

  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS)
  const path = pathFor(from)

  if (from !== 'ETH') {
    const allowance = await publicClient.readContract({
      address: USDC, abi: ERC20_ABI, functionName: 'allowance', args: [account, V2_ROUTER],
    })
    if (allowance < amountIn) {
      const hash = await walletClient.writeContract({
        address: USDC, abi: ERC20_ABI, functionName: 'approve',
        args: [V2_ROUTER, amountIn], account,
      })
      await publicClient.waitForTransactionReceipt({ hash })
    }
  }

  // The SupportingFeeOnTransferTokens variants are required, not optional: $TTS charges
  // a 1% transfer tax, and the plain swapExact* functions revert on any token whose
  // received amount differs from the amount sent.
  const hash = from === 'ETH'
    ? await walletClient.writeContract({
        address: V2_ROUTER, abi: ROUTER_ABI,
        functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
        args: [q.minOut, path, account, deadline], value: amountIn, account,
      })
    : await walletClient.writeContract({
        address: V2_ROUTER, abi: ROUTER_ABI,
        functionName: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
        args: [amountIn, q.minOut, path, account, deadline], account,
      })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, receipt, quote: q }
}

export const fmtTTS = (wei, dp = 0) =>
  Number(formatUnits(wei, 18)).toLocaleString(undefined, { maximumFractionDigits: dp })
export const parseETH = (s) => parseUnits(String(s || '0'), 18)
export const parseUSDC = (s) => parseUnits(String(s || '0'), 6)
