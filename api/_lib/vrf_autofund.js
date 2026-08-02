// VRF-subscription auto-funder decision core — PURE, side-effect-free, testable.
//
// Keeps the Chainlink VRF subscription funded above the per-request reserve so a
// settlement draw can never strand for lack of LINK (the Round-4 failure mode).
// Tops up from the BANK wallet via LINK.transferAndCall(coordinator, amount,
// abi.encode(subId)). LOWER RISK than the referral funder: the destination is the
// coordinator + OUR hard-coded subId, so funds can only ever land in our own sub —
// they cannot be redirected. The scheduler gathers real data and calls
// evaluateVrfAutoFund(); only on { topUp:true } does it send.

export const VRF_AUTOFUND = {
  MIN_THRESHOLD_LINK: 25,   // top up when sub dips below max(25, reserve×1.25)
  TARGET_MIN_LINK:    30,   // bring sub up to max(30, reserve×1.5)
  MAX_PER_TOPUP_LINK: 30,   // HARD cap: single top-up
  MAX_PER_7DAYS_LINK: 60,   // HARD cap: rolling 7-day total
  BANK_LINK_FLOOR:    5,    // SOLVENCY: never take Bank LINK below this
}
const C = VRF_AUTOFUND
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d }
const no = (reason) => ({ topUp: false, amount: 0, reason })
const floor3 = (x) => Math.floor(x * 1000) / 1000   // avoid LINK dust / fp noise

/**
 * Decide whether/how much LINK to add to the sub. Pure: same inputs → same output.
 * Inputs:
 *   enabled             vrf_autofund_enabled (kill switch; default TRUE upstream)
 *   hasBankKey          !!process.env.DEPLOYER_PRIVATE_KEY
 *   subBalance          current VRF sub LINK balance
 *   reserveLink         live worst-case per-request reserve, in LINK (monitor math)
 *   bankLinkBalance     Bank wallet LINK balance on Base (the fuel)
 *   sevenDayTopupTotal  LINK auto-funded to the sub in the trailing 7 days
 * Returns { topUp, amount, target?, threshold?, reason }.
 */
export function evaluateVrfAutoFund(i = {}) {
  // 0. KILL SWITCH
  if (!i.enabled) return no('vrf auto-funder disabled')
  // 1. Bank key required to send LINK
  if (!i.hasBankKey) return no('DEPLOYER_PRIVATE_KEY not set — cannot send')

  const reserve = Math.max(0, num(i.reserveLink, 15))
  const sub     = num(i.subBalance, 0)

  // 2. THRESHOLD — only act when the sub dips below max(25, reserve×1.25).
  const threshold = Math.max(C.MIN_THRESHOLD_LINK, reserve * 1.25)
  if (sub >= threshold) return no(`sub ${sub} ≥ threshold ${floor3(threshold)} LINK — no top-up`)

  // 3. Bring up to target = max(30, reserve×1.5).
  const target = Math.max(C.TARGET_MIN_LINK, reserve * 1.5)
  let amount = target - sub

  // 4. HARD CAP — per top-up.
  if (amount > C.MAX_PER_TOPUP_LINK) amount = C.MAX_PER_TOPUP_LINK

  // 5. HARD CAP — rolling 7-day total.
  const spent7d = Math.max(0, num(i.sevenDayTopupTotal, 0))
  const remaining7d = C.MAX_PER_7DAYS_LINK - spent7d
  if (remaining7d <= 0) return no(`7-day cap reached (${spent7d}/${C.MAX_PER_7DAYS_LINK} LINK) — refusing`)
  if (amount > remaining7d) amount = remaining7d

  // 6. SOLVENCY — never take Bank LINK below the floor (partial top-up allowed).
  const bank = num(i.bankLinkBalance, 0)
  const available = bank - C.BANK_LINK_FLOOR
  if (available <= 0) return no(`Bank LINK ${floor3(bank)} at/below ${C.BANK_LINK_FLOOR}-LINK floor — no fuel`)
  if (amount > available) amount = available

  amount = floor3(amount)
  if (amount <= 0) return no('computed top-up ≤ 0 after caps/floor')

  return { topUp: true, amount, target, threshold: floor3(threshold), reason: 'top-up' }
}
