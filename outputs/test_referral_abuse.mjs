// Referral abuse test suite — proves each defense rejects abuse.
// Pure-logic tests against evaluateReferralPayout() + a mock-DB uniqueness test
// for the double-payout constraint + an assertion that the migration declares it.
// No network, no real funds. Run:  node outputs/test_referral_abuse.mjs
import { evaluateReferralPayout } from '../api/_lib/referral.js'
import { readFileSync } from 'node:fs'

const R = '0x1111111111111111111111111111111111111111' // referrer
const E = '0x2222222222222222222222222222222222222222' // referee
const base = {
  enabled: true,
  hasReferralKey: true,
  referrer: R,
  referee: E,
  qualifyingAmount: 500,
  minQualifying: 500,
  funding: { fromReferrer: false, fromProgram: false, fromSignupBonus: false },
  alreadyPaid: false,
  referrerPaidToday: 0,
  perReferrerDailyCap: 10,
  programPaidTodayTts: 0,
  programDailyCapTts: 10000,
  bonusAmount: 100,
  walletBalanceTts: 10000,
  reserveFloorTts: 1000,
}
const m = (o) => ({ ...base, ...o, funding: { ...base.funding, ...(o.funding || {}) } })

const results = []
// expectAllow: true => must allow; false => must REJECT
function check(name, input, expectAllow) {
  const r = evaluateReferralPayout(input)
  const pass = r.allow === expectAllow
  results.push({ name, pass, got: r.allow ? 'ALLOW' : `REJECT (${r.reason})`, want: expectAllow ? 'ALLOW' : 'REJECT' })
}

// ── sanity: a fully valid referral must be ALLOWED (so we know it's not just rejecting everything)
check('valid referral (sanity) → ALLOW', m({}), true)

// ── the required abuse scenarios (all must REJECT) ──
check('1. self-referral (referrer==referee)', m({ referee: R }), false)
check('2a. referee funded by REFERRER', m({ funding: { fromReferrer: true } }), false)
check('2b. referee funded by PROGRAM wallet', m({ funding: { fromProgram: true } }), false)
check('3. double-payout (already paid)', m({ alreadyPaid: true }), false)
check('4. qualifying vote below 500 TTS', m({ qualifyingAmount: 499 }), false)
check('5. qualifying TTS from SIGNUP/PROGRAM bonus', m({ funding: { fromSignupBonus: true } }), false)
check('6. per-referrer daily cap (>10)', m({ referrerPaidToday: 10 }), false)
check('7. program daily TTS cap (>10k summed)', m({ programPaidTodayTts: 9950 }), false) // 9950+100 > 10000
check('8. wallet balance < reserve floor', m({ walletBalanceTts: 1050, reserveFloorTts: 1000 }), false) // 1050-100 < 1000
check('9. referral_enabled=false kill switch', m({ enabled: false }), false)
// ── requirement 1: never fund from Bank — refuse if dedicated key absent ──
check('1b. REFERRAL_WALLET_PRIVATE_KEY unset → REFUSE', m({ hasReferralKey: false }), false)

// ── double-payout at the DB layer: simulate the UNIQUE(referee) index ──
function mockDbUniquenessTest() {
  const paid = new Set()
  const insertCredit = (referee) => {
    if (paid.has(referee.toLowerCase())) { const e = new Error('duplicate key'); e.code = '23505'; throw e }
    paid.add(referee.toLowerCase())
  }
  let firstOk = false, secondRejected = false
  try { insertCredit(E); firstOk = true } catch { firstOk = false }
  try { insertCredit(E) } catch (e) { secondRejected = e.code === '23505' }
  return { pass: firstOk && secondRejected, got: `first=${firstOk?'inserted':'failed'}, second=${secondRejected?'REJECTED(23505)':'inserted!'}` }
}
const dbu = mockDbUniquenessTest()
results.push({ name: '3b. DB UNIQUE(referee) blocks 2nd payout', pass: dbu.pass, got: dbu.got, want: 'REJECT 2nd' })

// ── assert the migration actually declares the unique index ──
let sql = ''
try { sql = readFileSync(new URL('./referral_setup.sql', import.meta.url), 'utf8') } catch {}
const hasUnique = /CREATE UNIQUE INDEX[^\n]*referral_credits[^\n]*referee_wallet/i.test(sql)
results.push({ name: '3c. migration declares UNIQUE(referee_wallet)', pass: hasUnique, got: hasUnique ? 'present' : 'MISSING', want: 'present' })

// ── print table ──
const w = (s, n) => String(s).padEnd(n)
console.log('\n' + w('SCENARIO', 46) + w('RESULT', 8) + 'DETAIL')
console.log('-'.repeat(110))
let allPass = true
for (const r of results) {
  if (!r.pass) allPass = false
  console.log(w(r.name, 46) + w(r.pass ? 'PASS' : 'FAIL', 8) + `got ${r.got}`)
}
console.log('-'.repeat(110))
console.log(allPass ? '\n✅ ALL DEFENSES PASS' : '\n❌ ONE OR MORE DEFENSES FAILED')
process.exit(allPass ? 0 : 1)
