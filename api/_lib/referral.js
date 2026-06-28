// Referral payout decision core — PURE, side-effect-free, unit-testable.
//
// This module NEVER reads env, touches the network, or sends funds. The HTTP
// handler (api/bonus.js ?action=referral) gathers real data (Supabase + on-chain)
// and calls evaluateReferralPayout(); only if it returns { allow:true } does the
// handler send TTS — and only from REFERRAL_WALLET_PRIVATE_KEY (never the Bank /
// DEPLOYER key). The _lib/ prefix keeps Vercel from treating this as a function.
//
// ─────────────────────────────────────────────────────────────────────────────
// ECONOMIC-MOAT REALITY CHECK (required statement, not an assumption):
//
//   The "100-bonus < 500-burn" moat is CONDITIONAL, not absolute.
//   To trigger a 100 TTS referral bonus, the referee must cast a ≥500 TTS vote,
//   and losing-profile votes are burned. A self-referrer therefore appears to
//   risk 500 TTS to gain 100 (net −400). BUT that deterrent only holds while:
//     (a) 500 TTS has real acquisition cost — i.e. TTS price/liquidity are
//         non-trivial. At low price or thin liquidity, 500 TTS is cheap to
//         amass, so the burn stops being a meaningful cost and the moat erodes.
//     (b) The abuser cannot recoup the 500 by WINNING the round (if they are the
//         sole/top voter on the winning profile they reclaim 70% of the pool),
//         which can flip the math positive.
//   CONCLUSION: the economic moat depends on token value holding AND on the vote
//   not being self-recoverable. It must NOT be relied on alone. The real
//   protection is the layered, deterministic defenses below (dedicated-wallet
//   refusal, self-referral block, funding-source check, single-payout uniqueness,
//   per-referrer + program daily caps, reserve floor, kill switch). Treat the
//   economics as a soft backstop only.
// ─────────────────────────────────────────────────────────────────────────────

export const REFERRAL_DEFAULTS = {
  referrerBonusTts: 100,
  minQualifyingVoteTts: 500,
  perReferrerDailyCap: 10,
  programDailyCapTts: 10000,
  reserveFloorTts: 0,
}

const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || '')
const norm = (a) => (a || '').toLowerCase()

/**
 * Decide whether a referral payout may proceed. Pure: same inputs → same output.
 * Returns { allow: boolean, reason: string, amount?: number }.
 *
 * Expected input shape (all values supplied by the caller, never read here):
 *   enabled              referral_settings.referral_enabled (kill switch)
 *   hasReferralKey       !!process.env.REFERRAL_WALLET_PRIVATE_KEY
 *   referrer, referee    wallet addresses
 *   qualifyingAmount     TTS the referee voted (number)
 *   minQualifying        min qualifying vote (default 500)
 *   funding              { fromReferrer, fromProgram, fromSignupBonus } booleans
 *   alreadyPaid          referee already has a referral_credit row
 *   referrerPaidToday    count of this referrer's payouts today
 *   perReferrerDailyCap  default 10
 *   programPaidTodayTts  sum of TTS paid program-wide today
 *   programDailyCapTts   default 10000
 *   bonusAmount          payout size (default 100)
 *   walletBalanceTts     referral wallet TTS balance
 *   reserveFloorTts      do-not-spend-below floor
 */
export function evaluateReferralPayout(i = {}) {
  // 0. KILL SWITCH — admin can disable the whole program instantly.
  if (!i.enabled) return deny('referral program disabled')

  // 1. DEDICATED WALLET REQUIRED — never fall back to the Bank/DEPLOYER key.
  if (!i.hasReferralKey) return deny('REFERRAL_WALLET_PRIVATE_KEY not set — refusing (no Bank-key fallback)')

  // 2. Valid, DISTINCT wallets (blocks self-referral).
  if (!isAddr(i.referrer)) return deny('invalid referrer wallet')
  if (!isAddr(i.referee))  return deny('invalid referee wallet')
  if (norm(i.referrer) === norm(i.referee)) return deny('self-referral')

  // 3. SINGLE PAYOUT per referee (DB unique index is the hard guarantee; this is
  //    the fast-path check).
  if (i.alreadyPaid) return deny('already paid (double-payout blocked)')

  // 4. Qualifying-vote threshold.
  const min = num(i.minQualifying, REFERRAL_DEFAULTS.minQualifyingVoteTts)
  if (!(num(i.qualifyingAmount, 0) >= min)) return deny(`qualifying vote below ${min} TTS`)

  // 5. ANTI-SYBIL funding source — the referee's qualifying TTS must be
  //    self-sourced, not from the referrer, the program wallets, or a bonus.
  if (i.funding?.fromReferrer)    return deny('qualifying TTS funded by referrer')
  if (i.funding?.fromProgram)     return deny('qualifying TTS funded by program wallet')
  if (i.funding?.fromSignupBonus) return deny('qualifying TTS sourced from signup/program bonus')

  // 6. Per-referrer daily cap.
  const perCap = num(i.perReferrerDailyCap, REFERRAL_DEFAULTS.perReferrerDailyCap)
  if (num(i.referrerPaidToday, 0) >= perCap) return deny('per-referrer daily cap reached')

  // 7. Program-wide daily TTS cap.
  const bonus = num(i.bonusAmount, REFERRAL_DEFAULTS.referrerBonusTts)
  const progCap = num(i.programDailyCapTts, REFERRAL_DEFAULTS.programDailyCapTts)
  if (num(i.programPaidTodayTts, 0) + bonus > progCap) return deny('program daily TTS cap reached')

  // 8. Reserve floor — never spend the wallet below its floor.
  if (num(i.walletBalanceTts, 0) - bonus < num(i.reserveFloorTts, 0)) {
    return deny('referral wallet below reserve floor')
  }

  return { allow: true, reason: 'ok', amount: bonus }
}

function deny(reason) { return { allow: false, reason } }
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d }
