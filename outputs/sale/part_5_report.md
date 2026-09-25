# Part 5 — Pre-audit, timelock, SolidProof packet

**Status: inventory, static analysis and the readiness report DONE. Timelock DESIGNED but
deliberately not built. SolidProof request drafted.**

Full report: `outputs/audit/preaudit_2026-09-25.md`.

## What this part found
Three things that change the sale materially, all verified by execution rather than
reading:

1. **The token is not behind a proxy.** `proxiableUUID()` returns successfully (OZ marks
   it `notDelegated`, so through a proxy it reverts — the staking proxy, tested the same
   way, does revert); the EIP-1967 slot is zero; the contract holds 20,747 bytes where a
   proxy holds ~170. **The token is immutable.** Documentation has described it as a UUPS
   proxy for months.
2. **The M-1 zero-value-transfer fix never went live.** It was deployed as
   `0xb995b63c…` and believed live since 2026-05-17. Nothing delegates to that contract.
   On a fork, `transfer(B, 0)` between non-exempt addresses still reverts with panic
   0x11. **Not patchable** — no proxy, so no upgrade path.
3. **Supply is not fixed.** `mint()` exists; MINTER_ROLE is empty but the Safe holds
   DEFAULT_ADMIN_ROLE. Executed on a fork: granted MINTER, minted 1B, supply 69B → 70B.

And one piece of good news, equally checkable: **the `blacklisted` mapping has no
setter.** No function in the contract can write to it, so no address can ever be
blacklisted. That is the root cause of the Blockaid and GoPlus flags, and "the mapping is
unreachable" is a far stronger appeal than anything previously drafted.

## Slither
| Contract | High | Medium | Low | Info |
|---|---|---|---|---|
| TTS token | 3 | 10 | 0 | 71 |
| TTSVotingV3d | 0 | 3 | 15 | 11 |
| TTSKeeper3 | 0 | 4 | 7 | 5 |

Triaged in full in the readiness report. The token's 3 High: one is the unprotected
`initialize()` on the orphaned implementation (harmless while nothing delegates to it),
one is the empty `blacklisted` mapping (unreachable, see above), and one is a known
OpenZeppelin `MathUpgradeable.mulDiv` false positive. All eight `divide-before-multiply`
Mediums are the same library false positive.

**Aderyn was not run** — it is not installed and a Rust toolchain was not worth the time
against Slither's coverage. Stated rather than silently skipped.

## Timelock — designed, NOT built, on purpose
The planned scope shrinks because the token is not upgradeable: a timelock on the token's
UPGRADER_ROLE would be theatre. What matters is **DEFAULT_ADMIN_ROLE on the token**,
because that is what makes the mint risk real. Behind 48 hours, granting MINTER_ROLE
becomes a publicly visible notice period instead of a two-signature surprise.

Design: OZ `TimelockController`, `minDelay = 172800`, proposers `[Safe]`, executors
`[Safe]`, admin `address(0)`.

⚠️ **Why it is not built yet.** `DEFAULT_ADMIN_ROLE` is its own role admin. Renouncing the
Safe's copy while the timelock is misconfigured is **irreversible** and would permanently
freeze every admin function on an unupgradeable token — including `setTaxExempt`, which
the liquidity work in Part 4 depends on. That deserves its own fork test of the full
grant → wait 48h → execute cycle, not a bundle with Safe tx #1. Safe tx #1 must execute
first regardless.

## Optional hardening upgrade (Part 5.5) — not possible
Removing the blacklist gate, hard-capping the tax and making MINTER non-grantable all
require an upgrade. There is no proxy. This would need a new token and a holder
migration, which is out of scope for this sale. Two of the three are also moot: the
blacklist is already unreachable, and the tax is already a compile-time constant in an
immutable contract.

## Gate
| Gate | Result |
|---|---|
| Tool outputs attached | **PASS** — `outputs/audit/slither_*.json`, `slither_raw.txt` |
| Zero unresolved findings above informational | **NOT MET, and cannot be.** A-1 (supply governed) is mitigated by the timelock but not removable; A-2 (zero-value transfer) is unfixable without migration. Both are now disclosed publicly rather than hidden. |
| Timelock address + fork proof | **NOT MET** — deliberately deferred, see above |

Honest reading: this part **fails its own gate**, and the right response is disclosure,
not a fix. Both open findings are now stated on `/audit`, in `llms.txt`, in the one-pager
and in the SolidProof request.
