# Item 5 — reclaiming the stranded LINK

**Fork-proven 2026-09-25. NOT executed.** These are **Bank wallet** transactions, not a
Safe batch — the upkeep admin is the Bank EOA (`0xB1E991bF…`), so the Safe Transaction
Builder cannot execute them. Jim signs directly, and `cancelUpkeep` is irreversible.

## The gate is met
The condition was 3+ consecutive clean autopilot settlements. **There are four** — rounds
9, 10, 11 and 12 settled **19.6, 22.4, 17.3 and 18.3 minutes** after close, unattended.
Chainlink Automation has not performed for *any* upkeep on this registry since
2026-08-05, so the upkeep is dead weight holding a live asset.

## Current state (read from chain)
| | |
|---|---|
| Upkeep balance | **43.9739 LINK** |
| Upkeep admin | `0xB1E991bF617459B58964eEf7756B350e675C53b5` (Bank) |
| Target / performGas | Keeper3 / 500,000 |
| Paused / cancelled | no / no (`maxValidBlocknumber` = UINT32_MAX) |
| Last performed | block 49,471,915 |
| Bank LINK | 9.1597 |
| VRF subscription | **32.7619 LINK** |

## VRF top-up: not needed
The instruction was to bring the VRF subscription to 25+ LINK first. **It is already at
32.76.** No top-up transaction is required. For scale, a draw costs ~0.000476 LINK, so
that balance is roughly **69,000 draws** — about 1,300 years of weekly rounds. VRF fuel has
never been the real constraint.

## The sequence, proven on a Base mainnet fork
| Step | From | Call | Result |
|---|---|---|---|
| 1 | Bank | `cancelUpkeep(id)` | succeeded, 67,458 gas. Sets `maxValidBlocknumber` to current + 50 |
| — | — | `withdrawFunds` sent immediately | **correctly reverts** — Automation enforces a 50-block cancellation delay |
| 2 | Bank | `withdrawFunds(id, Bank)` after 50 blocks | succeeded, 71,546 gas. **+43.9739 LINK** arrived (Bank 9.1597 → 53.1337). Registry balance now zero |

Calldata: `5_link_reclaim_bank_txs.json`. Transcript: `5_link_reclaim_forkproof.txt`.
50 blocks on Base is about **100 seconds**, so step 2 follows step 1 almost immediately.

## What it is actually worth — read this before spending effort
At LINK $13.88 / ETH $2,716:

- Bank after withdraw: **53.13 LINK**
- Keeping a 5 LINK operational floor leaves **48.13 LINK**
- That is **≈ $668, or 0.246 ETH**

Added to the v2 pool that would take the ETH side from 0.5266 to roughly 0.77 WETH — about
**1.5×**. Real, but not transformative: a $100 buy would still move the price several
percent.

**The concentrated position in Safe tx #1 is the actual fix** — it takes the maximum card
purchase from ~$50 to $1,000 for no cash at all. This reclaim is worth doing because $668
of a stranded asset should not sit in a dead upkeep, and because it adds genuine sell-side
depth that a single-sided TTS position cannot provide. It is not worth doing *first*, and
it should not be described to a buyer as a liquidity strategy.

## Remaining step, not built
Swapping LINK → ETH and pairing with Treasury TTS in v2. Not built because:
1. It should happen **after** Safe tx #1, so the pairing ratio reflects the new pool.
2. Pairing with **Treasury** TTS needs the Treasury key — `0xC3A3858A…` is an ordinary
   EOA, not Safe-controlled — or it comes from the Safe's own balance as Safe tx #1 does.
   That is Jim's call.
3. An aggregator route should be quoted at execution time, not baked in now.

## Risks worth naming
- **`cancelUpkeep` is irreversible.** If Chainlink Automation ever returns on Base, this
  upkeep is gone and re-registering means a new upkeep and new LINK. Given zero performs
  across all 191 upkeeps on this registry since 2026-08-05, and a working replacement in
  production, that is an acceptable trade — but it is a one-way door.
- The autopilot becomes the **only** settlement mechanism. It already is in practice; this
  removes the fiction of a backup.
