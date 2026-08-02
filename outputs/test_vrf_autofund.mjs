// VRF auto-funder test suite — proves the top-up algorithm + every guard.
// Pure-logic tests against evaluateVrfAutoFund(). No network, no funds.
// Run:  node outputs/test_vrf_autofund.mjs
import { evaluateVrfAutoFund, VRF_AUTOFUND } from '../api/_lib/vrf_autofund.js'

// Base = enabled, Bank key present, reserve ~15 LINK, flush Bank fuel, no recent spend.
const base = {
  enabled: true,
  hasBankKey: true,
  subBalance: 8,             // below threshold
  reserveLink: 15,           // threshold=max(25,18.75)=25, target=max(30,22.5)=30
  bankLinkBalance: 50,
  sevenDayTopupTotal: 0,
}
const m = (o) => ({ ...base, ...o })

const results = []
function check(name, input, expect) {
  const r = evaluateVrfAutoFund(input)
  let pass = r.topUp === expect.topUp
  if (pass && expect.topUp) pass = Math.abs(r.amount - expect.amount) < 1e-6
  results.push({ name, pass, got: r.topUp ? `TOP-UP ${r.amount}` : `NO (${r.reason})`,
    want: expect.topUp ? `TOP-UP ${expect.amount}` : 'NO' })
}

// 1. below threshold → tops up to target (8 → 30 ⇒ +22)
check('below threshold → tops up (+22 → 30)', m({}), { topUp: true, amount: 22 })

// 2. above threshold → no-op (sub 25 ≥ threshold 25)
check('at/above threshold → no-op', m({ subBalance: 25 }), { topUp: false })
check('well above threshold → no-op', m({ subBalance: 40 }), { topUp: false })

// 3. per-top-up cap clamps (high reserve ⇒ target 60; need 60 → clamp 30)
check('MAX_PER_TOPUP clamps to 30', m({ reserveLink: 40, subBalance: 0 }), { topUp: true, amount: 30 })

// 4. rolling 7-day cap clamps (already 50 of 60 spent ⇒ only 10 left)
check('7-day cap clamps to 10', m({ sevenDayTopupTotal: 50 }), { topUp: true, amount: 10 })
check('7-day cap exhausted → refuse', m({ sevenDayTopupTotal: 60 }), { topUp: false })

// 5. solvency floor: Bank nearly empty → refuse (0.0003 - 5 < 0)
check('Bank at/below floor → refuse (no fuel)', m({ bankLinkBalance: 0.0003 }), { topUp: false })
// 5b. solvency partial: Bank has 20 → available 15, wants 22 → clamp to 15
check('solvency clamps to available above floor (→15)', m({ bankLinkBalance: 20 }), { topUp: true, amount: 15 })

// 6. kill switch off → short-circuits
check('kill switch (enabled=false) → short-circuit', m({ enabled: false }), { topUp: false })

// 7. no Bank key → refuse
check('DEPLOYER key unset → refuse', m({ hasBankKey: false }), { topUp: false })

// 8. price-aware: high reserve raises threshold so a "healthy 25" now tops up
//    reserve 30 ⇒ threshold 37.5, target 45; sub 25 → +20
check('price-aware: reserve↑ raises threshold (sub25 → +20)', m({ reserveLink: 30, subBalance: 25 }), { topUp: true, amount: 20 })

// 9. caps sanity — constants are exactly as specified
const capsOk = VRF_AUTOFUND.MAX_PER_TOPUP_LINK === 30 && VRF_AUTOFUND.MAX_PER_7DAYS_LINK === 60 &&
               VRF_AUTOFUND.BANK_LINK_FLOOR === 5 && VRF_AUTOFUND.MIN_THRESHOLD_LINK === 25
results.push({ name: 'hard caps = 30/topup, 60/7d, floor 5, thresh 25', pass: capsOk, got: capsOk ? 'ok' : 'WRONG', want: 'ok' })

const w = (s, n) => String(s).padEnd(n)
console.log('\n' + w('SCENARIO', 52) + w('RESULT', 8) + 'DETAIL')
console.log('-'.repeat(108))
let all = true
for (const r of results) { if (!r.pass) all = false; console.log(w(r.name, 52) + w(r.pass ? 'PASS' : 'FAIL', 8) + `got ${r.got} | want ${r.want}`) }
console.log('-'.repeat(108))
console.log(all ? '\n✅ ALL VRF AUTO-FUNDER CHECKS PASS' : '\n❌ ONE OR MORE CHECKS FAILED')
process.exit(all ? 0 : 1)
