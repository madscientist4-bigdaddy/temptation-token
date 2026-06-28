// Auto-funder test suite — proves the top-up algorithm + every guard.
// Pure-logic tests against evaluateAutoFund(). No network, no funds.
// Run:  node outputs/test_autofund.mjs
import { evaluateAutoFund } from '../api/_lib/autofund.js'

// Base = a healthy, enabled setup with a flush Marketing wallet.
const base = {
  enabled: true,
  hasMarketingKey: true,
  refWalletBalance: 2000,
  dailyAvgPayout: 0,            // target = max(10000, 0) = 10000
  dailyCapTts: 10000,
  maxDailyTopupTts: 25000,
  maxWalletBalanceTts: 50000,
  marketingBalance: 991000,
  marketingReserveFloorTts: 100000,
}
const m = (o) => ({ ...base, ...o })

const results = []
function check(name, input, expect) {
  const r = evaluateAutoFund(input)
  let pass = r.topUp === expect.topUp
  if (pass && expect.topUp) pass = r.amount === expect.amount
  results.push({ name, pass, got: r.topUp ? `TOP-UP ${r.amount}` : `NO (${r.reason})`,
    want: expect.topUp ? `TOP-UP ${expect.amount}` : 'NO' })
}

// 1. underfunded → tops up to target (2000 → 10000 ⇒ +8000)
check('underfunded → tops up to target (+8000→10k)', m({}), { topUp: true, amount: 8000 })

// 2. overfunded → does nothing (balance ≥ half-target 5000)
check('overfunded → no-op', m({ refWalletBalance: 8000 }), { topUp: false })

// 3. Marketing low → refuses (991k→105k; 105000-8000 < 100000 floor)
check('marketing below floor → refuses', m({ marketingBalance: 105000 }), { topUp: false })

// 4a. ceiling: per-top-up MAX_DAILY_TOPUP clamps (avg 8000 ⇒ target 56000; need 54000 → clamp 25000)
check('MAX_DAILY_TOPUP ceiling clamps to 25000', m({ dailyAvgPayout: 8000, refWalletBalance: 2000 }), { topUp: true, amount: 25000 })

// 4b. ceiling: MAX_WALLET_BALANCE clamps (bal 27000, target 56000, desired 29000 → clamp25k → 52k>50k → 23000)
check('MAX_WALLET_BALANCE ceiling clamps to 23000', m({ dailyAvgPayout: 8000, refWalletBalance: 27000 }), { topUp: true, amount: 23000 })

// 4c. at wallet ceiling already → no top-up (bal 49000 but below half of big target → amount would be ≤ maxWallet-bal=1000>0... use bal at cap)
check('already at wallet ceiling → no-op', m({ dailyAvgPayout: 8000, refWalletBalance: 50000 }), { topUp: false })

// 5. kill switch off → short-circuits
check('kill switch (enabled=false) → short-circuit', m({ enabled: false }), { topUp: false })

// 6. no Marketing key → refuses (never Bank fallback)
check('MARKETING key unset → refuse', m({ hasMarketingKey: false }), { topUp: false })

// 7. solvency exact-floor allowed (105000 - 5000 == 100000 floor; bal 5000→? target10000 half5000, bal 5000 not < 5000 → no-op). Use bal 4000 → +6000, mkt 106000-6000=100000 == floor OK
check('solvency at exact floor → allowed', m({ refWalletBalance: 4000, marketingBalance: 106000 }), { topUp: true, amount: 6000 })

const w = (s, n) => String(s).padEnd(n)
console.log('\n' + w('SCENARIO', 48) + w('RESULT', 8) + 'DETAIL')
console.log('-'.repeat(104))
let all = true
for (const r of results) { if (!r.pass) all = false; console.log(w(r.name, 48) + w(r.pass ? 'PASS' : 'FAIL', 8) + `got ${r.got} | want ${r.want}`) }
console.log('-'.repeat(104))
console.log(all ? '\n✅ ALL AUTO-FUNDER CHECKS PASS' : '\n❌ ONE OR MORE CHECKS FAILED')
process.exit(all ? 0 : 1)
