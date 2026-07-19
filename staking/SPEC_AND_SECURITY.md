# TTSStaking — Gate A (spec) + Gate B (safety suite)

Canonical, final staking contract for Temptation Token. Isolated Foundry
sub-project under `staking/` (the repo root has broken legacy `.sol` files that
forge 1.5 globs; this module vendors a clean, pinned **OpenZeppelin 4.9.6**
under `staking/vendor/` — the exact dep set used for deploy + BaseScan verify).

Run: `cd staking && forge test` · Slither: `forge flatten src/TTSStaking.sol -o
out-flat/TTSStaking.flat.sol && slither out-flat/TTSStaking.flat.sol --solc-args
"--evm-version paris"`.

---

## Gate A — design → implementation (`src/TTSStaking.sol`)

UUPS-upgradeable, `AccessControl` + `ReentrancyGuard` + `Pausable`. Solc 0.8.20,
optimizer 200, evmVersion paris (matches V3d verify settings).

### The five confirmed decisions, as built
1. **Fresh contract.** Not an upgrade of the mis-initialized proxy `0xaA12B889…`.
   The 10B pool is migrated in via `fundRewards` as *reward surplus*.
2. **Lock model = 7-day multiplier-eligibility, principal never locked.**
   `stake`/`unstake` and the always-open `emergencyWithdraw` move principal
   anytime. Only the vote multiplier is gated: `getStakingTier` reverts until a
   position is ≥ `MULTIPLIER_ELIGIBILITY` (7 days) old. **Any principal increase
   resets the clock** — this stops flash-stake-vote *and* flash-top-up-to-upgrade
   gaming. A partial unstake does *not* reset it (reducing can't game upward).
3. **Manual admin thresholds.** `setTierThresholds` (MANAGER_ROLE) sets TTS
   amounts; strict-ascending + a ≤4× per-edit deviation guard (fat-finger / bad
   price). First-time set is exempt from the deviation guard.
4. **Reward economics — principal strictly segregated.** Rewards are paid *only*
   from `rewardSurplus() = balance − totalStaked`. A reward bug can never touch
   deposits. APRs default to the published 8/12/18/32/45% but live in storage
   (`setAprBps`, MANAGER) so the Safe can throttle emissions to protect the pool
   **without a contract upgrade** (see Gate E). `claim` reverts if the pool can't
   cover the amount (rewards stay accrued for later). `recoverRewardTokens` is
   bounded by surplus, so governance can reclaim unused budget but never principal.
5. **Upgrade authority = Safe + timelock, never Bank.** `UPGRADER_ROLE` →
   TimelockController (Safe is proposer/executor). `DEFAULT_ADMIN_ROLE` /
   `MANAGER_ROLE` → Safe. `_authorizeUpgrade` is `onlyRole(UPGRADER_ROLE)`.

### Integration seam (unchanged, matches V3d exactly)
`getStakingTier(address) → uint256 0..4`, called by V3d inside `try/catch`. A
revert ⇒ V3d falls back to **1× multiplier + unstaked vote cap** — precisely the
behavior we want for an ineligible (< 7 day) position. Tiers map to V3d's on-chain
multipliers 1.1 / 1.25 / 1.5 / 2 / 3× and caps 1000 / 2500 / 5000 / 15000 / ∞.

### Reward accrual (lazy, no global loops)
Per-user `StakeInfo{amount, eligibleAt, accrued, lastAccrual, aprBps}`. `_settle`
adds `amount × aprBps × dt / (1e4 × 365d)` to `accrued`, then any amount change
recomputes the cached `aprBps`. Threshold/APR edits do **not** resettle everyone
(no unbounded loop, no retroactive change); a staker or keeper picks up the new
rate via `refresh(user)` or their next interaction.

---

## Gate B — Foundry safety suite + Slither

**`forge test` → 42 passed / 0 failed** across 4 suites.

### Invariants (`test/TTSStakingInvariant.t.sol`) — 256 runs × 128 depth, 0 reverts
- **INV-1** `balance ≥ totalStaked` — principal always fully backed.
- **INV-2** `Σ per-actor principal == totalStaked` — no accounting drift.
- **INV-3** `rewardSurplus == balance − totalStaked`.
- **INV-4** `Σ claimed ≤ Σ funded` — rewards never exceed the funded budget.

### Unit / fuzz / integration / reentrancy (`test/TTSStaking.t.sol`)
- Principal: credit-on-stake (tax-exempt *and* fee-on-transfer via balance-delta),
  anytime unstake, partial unstake.
- Eligibility gate: reverts before 7d; active after; top-up resets; partial
  unstake preserves; below-Bronze reverts.
- Tier boundary values (Bronze−1 … VIP+1). Reward math per-tier APR over 1 yr
  (8/12/18/32/45%). Claim pays from surplus not principal; reverts on empty pool
  (principal still withdrawable). Emergency withdraw works **while paused** and
  preserves accrued rewards. Pause blocks stake/unstake/claim but never emergency.
- Thresholds: ascending + deviation guard. APR lever: defaults published,
  only-manager, ascending, 200% ceiling, deviation guard, throttle halves emissions.
- Access control: only MANAGER (thresholds/apr/pause/recover), only UPGRADER
  (upgrade — Bank/manager/user all rejected). Recover bounded by surplus.
- **Integration stub** replicates V3d's `_applyMultiplier` + `tierVoteCap`
  byte-for-byte: ineligible ⇒ 1× & 500 cap; eligible Gold ⇒ 1.5× & 5000; eligible
  VIP ⇒ 3× & uncapped. (Gate D swaps this for real V3d on Sepolia.)
- **Reentrancy**: a hostile token that re-enters stake/unstake/emergency during
  transfer — all revert on the `nonReentrant` guard.

### Slither triage (flattened, clean 4.9.6 deps)
**No high-severity findings** (no reentrancy-eth, arbitrary-send, suicidal,
uninitialized-state, tautology). Everything reported is OZ-library dead code /
naming style / `__gap`-unused, or:
- **`reentrancy-no-eth` in `stake`** — state written after `safeTransferFrom`
  because we use balance-delta crediting (must transfer, then measure). Mitigated:
  `stake` is `nonReentrant`, `refresh` is now `nonReentrant`, and TTS is a fixed
  standard ERC-20 with no transfer hooks (repo finding **AF-001**). Non-exploitable;
  proven by the reentrancy suite. **ACCEPTED.**
- **`amountTier` strict equality** — `== 0` on unsigned values; safe. **ACCEPTED.**
- **`_upgradeToAndCall` ignores return** — OZ library internal. **ACCEPTED.**
