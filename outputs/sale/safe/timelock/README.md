# Timelock package — parked, closing-day option
**Built and fork-tested 2026-09-25. NOT executed. Do not sign before closing.**

Jim's instruction: build it, prove `setTaxExempt` still works through it after 48 hours,
park it. Done — all 15 checks pass. Transcript: `../timelock_forkproof.txt`.

## What it is for
The one real centralization risk on the token is that the 2-of-2 Safe holds
`DEFAULT_ADMIN_ROLE` and can therefore grant itself `MINTER_ROLE` and mint. That cannot be
removed from the code — the token is not upgradeable — so the only available mitigation is
to put a **public 48-hour notice period** in front of it. That is what this does. It turns
"two signatures and the supply changes" into "two signatures, then everyone watching has
two days to react."

## Three steps, in this order

### Step 1 — deploy the timelock (anyone; no privilege required)
OpenZeppelin `TimelockController` v4.9.6, solc 0.8.20, optimizer on (200), evmVersion paris.
Creation bytecode: `TimelockController.creation.bytecode.txt`.

Constructor arguments:
| Argument | Value |
|---|---|
| `minDelay` | `172800` (48 hours) |
| `proposers` | `[0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86]` (the Safe) |
| `executors` | `[0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86]` (the Safe) |
| `admin` | `0x0000000000000000000000000000000000000000` |

`admin = address(0)` is deliberate: the timelock self-administers, so no EOA can rewrite
its roles. Deploy cost on the fork: **1,962,343 gas**. Verify the source on BaseScan
immediately — an unverified timelock is worth nothing to a buyer.

### Step 2 — `2_timelock_grant.json` (reversible)
Grants `DEFAULT_ADMIN_ROLE` on the token to the timelock. **The Safe keeps its own admin
role**, so nothing is lost yet.

**Then stop.** Schedule one harmless operation through the timelock on real mainnet — for
example `setTaxExempt` on an address that is already exempt — wait the 48 hours, and
execute it. Only once that has actually worked against live state should anyone sign step 3.

### Step 3 — `3_timelock_renounce.json` (**IRREVERSIBLE**)
The Safe gives up `DEFAULT_ADMIN_ROLE`.

⚠️ **There is no undo.** `DEFAULT_ADMIN_ROLE` is its own role admin, and the token cannot
be upgraded. If the timelock is misconfigured, every admin function on the token is frozen
permanently — including `setTaxExempt`, which the new liquidity pool depends on. The fork
test covers exactly this, and step 2's live rehearsal covers the rest.

## What the fork test proved
Against real mainnet state, in one run:

| | |
|---|---|
| Timelock deploys with minDelay 48h, Safe as sole proposer and executor, no admin | PASS |
| Timelock holds `DEFAULT_ADMIN_ROLE`; Safe renounces its own | PASS |
| Safe can no longer call `setTaxExempt` directly | PASS |
| `execute` **reverts** before 48h, and `isOperationReady` is false | PASS |
| After 48h, `execute` succeeds (67,964 gas) | PASS |
| **`isTaxExempt(probe)` actually flipped to true** — the claim the package rests on | PASS |
| Safe can no longer grant itself `MINTER_ROLE` directly | PASS |

Re-run: `anvil --fork-url $BASE_RPC_URL`, then `node scripts/sale/timelock_forktest.mjs`.

## Regenerate the JSONs with the real address
```
node scripts/sale/build_safe_tx2_timelock.mjs 0x<deployed-timelock>
```
The files currently in this directory carry a **placeholder** timelock address and must be
regenerated before signing.

## What this deliberately does NOT cover
- The **staking proxy's** `UPGRADER_ROLE`. It is genuinely upgradeable and already sits
  behind its own 2-day timelock (`0xa4fbf397…`), so it is a separate decision.
- The **Trophy NFT** admin. Low value; fold in later if a buyer asks.
- `UPGRADER_ROLE` on the token, which is **inert** — there is no proxy, so delaying it
  would be theatre.
