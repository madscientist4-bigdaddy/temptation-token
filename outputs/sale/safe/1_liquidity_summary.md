# Safe transaction #1 — buy-side liquidity, in plain English

**For: Jim and Mike. Both signatures required. Nothing here spends ETH, cash, or any
wallet other than the Safe's own TTS.**

Built 2026-09-25 01:22 UTC against live mainnet price
$0.013953 per TTS (ETH $2692.36).

## The problem it fixes
Today the only TTS pool holds about 0.5265 WETH. A \$100 card purchase
moves the price more than 7%, and the app refuses any trade over 5%, so **the largest
card purchase anyone can actually complete is around \$50.** The card on-ramp is one of
the headline features of what is being sold, and it does not work above pocket change.

## What these 5 transactions do
1. Create the Uniswap v3 WETH/TTS pool at the 0.3% fee tier. Deterministic address 0x09E7a7A90b1C4E8Ad69b26417fE88FE30Af31cC8. No pool exists at this tier today.
2. Set the new pool's opening price to the current Uniswap v2 price ($0.013953 per TTS). Matching v2 means there is no arbitrage gap the moment it opens.
3. Exempt the new pool from the 1% transfer tax. The token skips tax when either side is exempt; without this every purchase out of the pool loses 1%. The existing v2 pair is already exempt, so this only brings the new pool to parity.
4. Allow Uniswap's position manager to take 1,007,851 TTS from the Safe. Exact amount, not unlimited.
5. Deposit 1,007,851 TTS as single-sided liquidity, priced from today's price up to about +60%. No ETH and no cash leaves the Safe. The position NFT is minted to the Safe itself.

## What it costs
- **1,007,851 TTS**, which is **0.0101%** of the Safe's 1.00e+10 TTS.
- **No ETH. No cash.** The position is single-sided: it holds only TTS, offered at
  today's price and above. It is sold only if someone buys at those prices.
- Founder, Team and Treasury wallets are untouched. The TTS comes from the Safe's own
  balance, because a Safe transaction can only move the Safe's own assets — the
  Treasury address is an ordinary wallet, not controlled by the Safe.

## Proven, not estimated
Every transaction was executed against a Base mainnet fork and the resulting pool was
traded through at six purchase sizes. Full transcript: `outputs/sale/liquidity_forktest.md`.

| purchase | before | after |
|---|---|---|
| \$100 | 7.3% impact — refused | 0.9% — fine |
| \$500 | 35.6% impact — refused | **1.9%** |
| \$1,000 | 70.8% impact — refused | **3.3%** |

Selling back was also tested: buy \$500, sell it straight back, recover \$497 (0.6% round
trip, which is the two 0.3% swap fees). The position is not a one-way trap.

## Before you sign — this batch expires 2026-10-09
The opening price and the price range are computed from the price at build time. If TTS
moves meaningfully before signing, this batch would open the pool at a stale price, which
is a free profit for the first person to notice. **Re-run `node scripts/sale/build_safe_tx1.mjs`
and re-upload the JSON if more than a few days have passed, or if the price has moved
more than a few percent.**

## Risks worth naming
- The TTS in this position is sold if buyers arrive at these prices. That is the point,
  but it is a real disposal of 1,007,851 TTS, not a loan.
- If the price falls below the range, the position converts entirely to WETH and stops
  offering TTS. It does not "lose" anything, but it stops helping until price recovers.
- A stray empty Uniswap v3 pool already exists at the **1% fee tier**
  (`0x7f52386781Cd5c01a1f6A0B4fB028ab7598a3Bd1`), initialized at an implausible price with
  zero liquidity and no tax exemption. It is harmless while empty — nothing routes through
  a pool with no liquidity — but **no one should ever add liquidity to it at that price.**

## Execution note for whoever presses the button
`createPool` alone costs **4.56 million gas** — a v3 pool is a full contract deployment.
The whole batch costs about **5.24 million gas**. The first fork replay of this exact
JSON failed because the runner capped gas at 3 million: `createPool` ran out, and then
`initialize` was sent to an address with no code, where it **succeeded trivially and
reported ok**. If the Safe UI proposes a gas limit near or below 6 million, raise it.
A batch that half-executes here leaves an uninitialized pool address behind.

Fork proof of this exact calldata: `outputs/sale/safe/1_liquidity_forkproof.txt`.
