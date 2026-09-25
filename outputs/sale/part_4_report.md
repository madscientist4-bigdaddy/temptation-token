# Part 4 — Liquidity + card on-ramp

**Status: analysis, design and fork proof DONE. Safe tx #1 BUILT and verified. Transak
production and the LINK reclaim need Jim.**

Transcripts: `outputs/sale/liquidity_forktest.md` · `outputs/sale/safe/1_liquidity.json`
· `outputs/sale/safe/1_liquidity_summary.md` · `outputs/sale/safe/1_liquidity_forkproof.txt`

## 1–2. The pool, and the tax rule
V2 pair `0x77Fe1883…` holds **0.5266 WETH / 101,612 TTS** — about $1,420 a side.
Spot $0.01396/TTS at ETH $2,694.

**Tax logic, read from the deployed source:** the 1% transfer tax is skipped when
**either** side is exempt (`if (_taxExempt[from] || _taxExempt[to]) return;`, and the
negated form in the `transfer`/`transferFrom` overrides). The v2 pair **is** exempt, so
swaps are already untaxed on both legs. Tax only applies when neither party is exempt.

| Buy | Impact today | Passes the app's 5% guard |
|---|---|---|
| $30 | 2.42% | yes |
| $50 | 3.83% | yes |
| $100 | 7.35% | **no** |
| $500 | 35.56% | **no** |
| $1,000 | 70.81% | **no** |

**The real card ceiling today is about $50.** That is worse than the Aug 12 figure and it
means one of the headline features of the thing being sold does not work.

## 3–4. The fix, proven
A Uniswap v3 position at the 0.3% tier, **TTS only**, from spot up to about +60%.
Single-sided, so it costs no ETH and no cash.

Token ordering is the trap here and it is worth stating: WETH sorts below TTS, so WETH is
token0 and v3's price is *TTS per WETH*. A buy therefore moves that price **down**, which
puts TTS-only liquidity **below** the current tick — the opposite of the dollar
intuition.

**Sizing:** for a constant-liquidity range, a swap moving P→P′ executes at `1/√(P·P′)`
against a spot of `1/P`, so impact `i` satisfies `√(P/P′) = 1+i`, and the WETH needed is
`L·i/√P`. Inverting for the binding constraint ($500 at 2%) and adding 50% headroom gives
L ≈ 6,117 → **1,007,851 TTS**, which is **0.0101% of the Safe's balance**.

**Measured by actually swapping on a Base fork, not estimated:**

| Buy | Before | After | TTS received |
|---|---|---|---|
| $100 | 7.35% | **0.85%** | 7,104 |
| $250 | 17.93% | **1.25%** | 17,691 |
| $500 | 35.56% | **1.92%** | 35,149 |
| $1,000 | 70.81% | **3.26%** | 69,389 |

Targets: "$500 under 2%" **met**. "$1,000 under 5%" **met**.
Max buy under the 5% guard: **$50 → $1,000.**

**Sell side tested too:** buy with $500, sell straight back, recover **$497.02** — a 0.60%
round trip, which is exactly the two 0.3% swap fees. The position is not a one-way trap.

## 5. Safe transaction #1 — built and independently verified
5 transactions: `createPool` → `initialize` → `setTaxExempt(pool)` → `approve` → `mint`.
Recipient of the position NFT is the Safe. Plain-English summary written for Jim and Mike.

The **exact calldata in the JSON** was then replayed from the Safe address on a fresh
fork: all 5 succeeded, Safe spent 1,007,851 TTS, pool funded and tax-exempt.

⚠️ **The batch encodes today's price and expires 2026-10-09.** Re-run
`node scripts/sale/build_safe_tx1.mjs` before signing if the price has moved.
⚠️ **`createPool` alone costs 4.56M gas**; the batch needs ~5.24M. The first replay failed
at a 3M cap — and then `initialize` was sent to an address with no code, where it
*succeeded*, burning 21k gas and reporting ok. The verifier now refuses any call whose
target has no code, because a silent no-op reads exactly like a pass.

**Funding note:** the brief says Treasury allocation, but `0xC3A3858A…` is an ordinary
EOA, not Safe-controlled — a Safe batch cannot move it. This uses the Safe's own 10B.
Founder and Team wallets are untouched either way. If Jim wants it to come from Treasury,
that needs a separate transfer signed with the Treasury key first.

## 6. App routing — designed, not deployed, on purpose
Quoting both pools and routing the better price requires the v3 pool to exist. It does
not exist on mainnet yet. Shipping a change to the buy path that quotes a non-existent
pool risks breaking the one purchase route that currently works, to no benefit.
**Trigger: deploy immediately after Safe tx #1 executes.** The 5% guard and the `?buy=1`
deep link stay as they are.

## 7. Transak production — blocked
Needs the production key from Jim (Plan T07). Then: set to PRODUCTION, whitelist
`app.temptationtoken.io`, enable the card tab flag, and Jim does a live $30 buy on his
phone (Plan T20). **Sequence this after Safe tx #1** — a live $30 test against today's
pool costs 2.4% in slippage and proves the wrong thing.

## 8. LINK → sell-side depth — **now unblocked, needs Jim**
The condition was 3+ consecutive clean autopilot settlements. **There are four**
(rounds 9, 10, 11, 12 — verified from chain, each next round opening within 0.5h of
close). So the retired Chainlink upkeep's **43.97 LINK** is reclaimable.

Sequence, none of it done here because every step is a mainnet transaction:
cancel the upkeep (from whichever wallet registered it) → wait the required blocks →
withdraw → **top the VRF subscription to ≥25 LINK first** → swap the remainder to ETH →
pair with Treasury TTS in v2.

Worth knowing before spending effort: a VRF draw actually costs **0.000476 LINK**. The
subscription holds 32.76. Fuel is not a real constraint — this is about reclaiming a
stranded asset, not about keeping the lights on.

## 9. Gate
| Gate | Result |
|---|---|
| Before/after impact table | **PASS** — measured on fork |
| Max card buy under 2% and 5% | **PASS** — $500 under 2%, $1,000 under 5% |
| Production test receipt | **BLOCKED** — no Transak production key |
| Blockaid recheck after 7 stable days | **NOT DUE** — and the appeal is now much stronger: the `blacklisted` mapping they flag **has no setter**, so no address can ever be blacklisted. See `outputs/audit/preaudit_2026-09-25.md` A-5. |
