// Referral-wallet auto-funder decision core — PURE, side-effect-free, testable.
//
// Tops up the dedicated referral wallet from the MARKETING wallet (never Bank).
// The scheduler gathers real data (balances, 7-day burn) and calls
// evaluateAutoFund(); only on { topUp:true } does it send — and only with
// MARKETING_WALLET_PRIVATE_KEY. _lib/ prefix keeps Vercel from routing this.

export const AUTOFUND_DEFAULTS = {
  dailyCapTts: 10000,              // program daily cap → target floor
  maxDailyTopupTts: 25000,         // HARD ceiling per single top-up
  maxWalletBalanceTts: 50000,      // never push the referral wallet above this
  marketingReserveFloorTts: 100000,// never drop Marketing below this
  halfTargetTrigger: 0.5,          // hysteresis: act only below half-target
}
const D = AUTOFUND_DEFAULTS
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d }
const no = (reason) => ({ topUp: false, amount: 0, reason })

/**
 * Decide whether/how much to top up. Pure: same inputs → same output.
 * Inputs:
 *   enabled               auto_fund_enabled (kill switch)
 *   hasMarketingKey       !!process.env.MARKETING_WALLET_PRIVATE_KEY
 *   refWalletBalance      referral wallet TTS balance
 *   dailyAvgPayout        avg referral TTS/day over trailing 7 days
 *   dailyCapTts           program daily cap (target floor; default 10000)
 *   maxDailyTopupTts      per-top-up ceiling (default 25000)
 *   maxWalletBalanceTts   referral-wallet ceiling (default 50000)
 *   marketingBalance      Marketing wallet TTS balance
 *   marketingReserveFloorTts  do-not-drop-below floor (default 100000)
 * Returns { topUp:boolean, amount:number, target?:number, reason:string }.
 */
export function evaluateAutoFund(i = {}) {
  // 0. KILL SWITCH
  if (!i.enabled) return no('auto-funder disabled')
  // 1. MARKETING key required — NEVER fall back to the Bank/DEPLOYER key
  if (!i.hasMarketingKey) return no('MARKETING_WALLET_PRIVATE_KEY not set — refusing (no Bank-key fallback)')

  // Target = cover the program daily cap AND ~a week of real usage.
  const dailyCap = num(i.dailyCapTts, D.dailyCapTts)
  const dailyAvg = Math.max(0, num(i.dailyAvgPayout, 0))
  const target = Math.max(dailyCap, 7 * dailyAvg)
  const bal = num(i.refWalletBalance, 0)

  // 2. HYSTERESIS — only top up once balance falls below half-target.
  if (bal >= target * D.halfTargetTrigger) return no('balance above half-target — no top-up needed')

  // 3. Bring to target, then clamp by the two hard ceilings.
  let amount = target - bal
  const maxDaily = num(i.maxDailyTopupTts, D.maxDailyTopupTts)
  if (amount > maxDaily) amount = maxDaily                         // per-top-up ceiling
  const maxWallet = num(i.maxWalletBalanceTts, D.maxWalletBalanceTts)
  if (bal + amount > maxWallet) amount = maxWallet - bal           // wallet ceiling
  amount = Math.floor(amount)
  if (amount <= 0) return no('at/near wallet ceiling — no top-up')

  // 4. SOLVENCY — refuse if Marketing would drop below its reserve floor.
  const mkt = num(i.marketingBalance, 0)
  const floor = num(i.marketingReserveFloorTts, D.marketingReserveFloorTts)
  if (mkt - amount < floor) return no('marketing reserve floor would be breached — refusing')

  return { topUp: true, amount, target, reason: 'top-up' }
}
