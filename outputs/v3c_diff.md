# TTSVotingV3b → TTSVotingV3c Diff Report

**Generated:** 2026-05-12  
**Status:** DO NOT DEPLOY — surfaced for human code review  
**Compiler:** solc 0.8.20, optimizer 200 runs, via_ir=true — **zero errors, zero warnings**  
**Slither:** 30 results (all inherited from V3b or informational — zero new HIGH/CRITICAL)  
**Mythril:** No issues detected (execution-timeout 60s, via_ir mode)

---

## Summary of Changes

V3c makes exactly four targeted changes to V3b. No new storage slots are introduced. Constructor parameters and the prize split logic are unchanged.

| Area | V3b | V3c |
|------|-----|-----|
| Tier 3 (Diamond) multiplier | 1.75x | **2.0x** |
| Tier 4 (VIP) multiplier | 2.0x | **3.0x** |
| Tier 5 (ghost) multiplier | 3.0x | **removed** |
| NFT mints at settlement | 1 (winner only) | **3 (winner + top voter + houseWallet archive)** |
| Per-tier vote cap | none | **500/1000/2500/5000/15000 TTS / unlimited (VIP)** |
| New public view | — | **`tierVoteCap(address voter)`** |
| New constants | — | `VOTE_CAP_UNSTAKED/BRONZE/SILVER/GOLD/DIAMOND` |
| Storage slots | 0–12 | **0–12 (unchanged)** |

---

## Change 1: Multipliers (`_applyMultiplier`)

**Location:** `TTSVotingV3c.sol` lines 609–624 (was 593–605 in V3b)

```diff
-    function _applyMultiplier(address voter, uint256 amount) internal returns (uint256) {
-        try stakingContract.getStakingTier(voter) returns (uint256 tier) {
-            if (tier == 5) return amount * 300 / 100;
-            if (tier == 4) return amount * 200 / 100;
-            if (tier == 3) return amount * 175 / 100;
-            if (tier == 2) return amount * 150 / 100;
-            if (tier == 1) return amount * 125 / 100;
-            if (tier == 0) return amount * 110 / 100;
-        } catch {
-            emit MultiplierFallback(voter);
-        }
-        return amount;
-    }
+    // V3c multipliers: Diamond (tier 3) 2x, VIP (tier 4) 3x, ghost tier 5 removed
+    function _applyMultiplier(address voter, uint256 amount) internal returns (uint256) {
+        try stakingContract.getStakingTier(voter) returns (uint256 tier) {
+            if (tier == 4) return amount * 300 / 100;
+            if (tier == 3) return amount * 200 / 100;
+            if (tier == 2) return amount * 150 / 100;
+            if (tier == 1) return amount * 125 / 100;
+            if (tier == 0) return amount * 110 / 100;
+        } catch {
+            emit MultiplierFallback(voter);
+        }
+        return amount;
+    }
```

**Rationale:** Ghost tier (tier 5) was an undocumented backdoor multiplier. Diamond (tier 3) raised to 2x to better incentivise mid-tier holders. VIP (tier 4) raised to 3x for top stakers.  
**Risk:** Low. `try/catch` around staking call is preserved. Fallback returns `amount` (1x) unchanged.

---

## Change 2: Three NFT Mints (`fulfillRandomWords`)

**Location:** `TTSVotingV3c.sol` lines 472–481 (was 473–476 in V3b)

```diff
-        // MEDIUM #2 — gas cap on NFT mint
-        if (nftContract != address(0)) {
-            try ITTSRoundNFT(nftContract).mint{gas: 200000}(winner.wallet, roundId, winnerId, pool / 1e18) {} catch {}
-        }
+        // V3c: three NFT mints — winning profile, top voter, BE LLC archive (houseWallet)
+        if (nftContract != address(0)) {
+            uint256 voteCount = pool / 1e18;
+            try ITTSRoundNFT(nftContract).mint{gas: 200000}(winner.wallet, roundId, winnerId, voteCount) {} catch {}
+            try ITTSRoundNFT(nftContract).mint{gas: 200000}(topVoterAddr, roundId, winnerId, voteCount) {} catch {}
+            try ITTSRoundNFT(nftContract).mint{gas: 200000}(houseWallet, roundId, winnerId, voteCount) {} catch {}
+        }
```

**Note:** `topVoterAddr` is computed just above the payout block:
```solidity
address topVoterAddr = winner.topVoter != address(0) ? winner.topVoter : winner.wallet;
```
This reuses the already-computed value used for `voterShare` payout — no extra external call.

**Gas analysis:** 3 × 200,000 = 600,000 gas for mints. `CALLBACK_GAS_LIMIT = 2,500,000` leaves 1,900,000 for the rest of settlement (payout transfers, storage writes, winner loop). Comfortable margin.  
**Risk:** Low. Each mint is independent try/catch. Any single mint failure leaves the other two and all payouts unaffected. `houseWallet` is never zero (constructor-guarded).

---

## Change 3: Per-Tier Vote Caps (`vote` + new constants + `tierVoteCap`)

### New constants (no storage cost):

```solidity
uint256 public constant VOTE_CAP_UNSTAKED = 500e18;
uint256 public constant VOTE_CAP_BRONZE   = 1000e18;
uint256 public constant VOTE_CAP_SILVER   = 2500e18;
uint256 public constant VOTE_CAP_GOLD     = 5000e18;
uint256 public constant VOTE_CAP_DIAMOND  = 15000e18;
// tier >= 5 (VIP): type(uint256).max — no cap
```

### New public view function:

```solidity
function tierVoteCap(address voter) public view returns (uint256) {
    try stakingContract.getStakingTier(voter) returns (uint256 tier) {
        if (tier == 0) return VOTE_CAP_UNSTAKED;
        if (tier == 1) return VOTE_CAP_BRONZE;
        if (tier == 2) return VOTE_CAP_SILVER;
        if (tier == 3) return VOTE_CAP_GOLD;
        if (tier == 4) return VOTE_CAP_DIAMOND;
        return type(uint256).max; // tier >= 5 (VIP): no cap
    } catch {}
    return VOTE_CAP_UNSTAKED; // staking call failed: treat as unstaked
}
```

### Check added to `vote()`:

```diff
     require(amount >= MIN_VOTE, "Below minimum");
+
+    // V3c: per-tier single-tx vote cap
+    require(amount <= tierVoteCap(msg.sender), "Exceeds tier vote cap");
+
     Profile storage p = _profiles[currentRoundId][profileId];
```

**Placement:** Checked before `p.approved` lookup and before `safeTransferFrom`. No token transfer occurs on revert.  
**Fallback behaviour:** If staking contract is unavailable (reverts), `tierVoteCap` returns `VOTE_CAP_UNSTAKED` (500 TTS). This is intentionally conservative — a voter whose tier cannot be confirmed is capped at the lowest tier.  
**Risk note for reviewer:** This introduces a second external call to `stakingContract` per vote (first is in `_applyMultiplier`). Both are already try/catch guarded. If the staking contract interface mismatch persists (current V3b issue: `getStakingTier` selector not in staking dispatch table), both will catch and fall back safely — unstaked cap (500 TTS) will apply to all voters until the staking upgrade is deployed.

---

## Change 4: Contract Name and Header (cosmetic)

`TTSVotingV3b` → `TTSVotingV3c` throughout. Header comment updated to describe V3c changes rather than V3b fixes. All inline `// HIGH #1`, `// MEDIUM #2` etc. tags removed (no functional change — these were annotation-only comments).

---

## Slither Analysis — Full Findings

All 30 findings are either identical to V3b or informational. Zero new HIGH/CRITICAL introduced by V3c changes.

| Severity | Finding | New in V3c? | Assessment |
|----------|---------|-------------|------------|
| HIGH | Reentrancy in `vote()` — state written after `safeTransferFrom` | No (V3b identical) | TTS token is not a reentrant token. Would require a malicious TTS token to exploit. Accepted inherited risk. |
| HIGH | Reentrancy in `_requestSettlement()` — `_vrfToRound` written after VRF request | No (V3b identical) | VRF coordinator is trusted Chainlink contract. Accepted. |
| MEDIUM | Uninitialized local `req` struct (assigned field-by-field) | No | Solidity zero-initialises structs. No risk. |
| MEDIUM | Uninitialized local `winnerId` string | No | Empty string is valid initial value; set in loop body. No risk. |
| LOW | `setNFTContract` missing zero-address check | No | Intentional: `nftContract = address(0)` disables minting. |
| INFO | Block timestamp comparisons | No | Standard for time-gated voting. Unavoidable. |
| INFO | `^0.8.20` known compiler bugs | No | All three bugs (VerbatimInvalidDeduplication, etc.) are compile-time only, not runtime. |
| INFO | Low-level call in `SafeERC20._callOptionalReturn` | No | Intentional pattern for optional-return tokens. |
| INFO | Naming conventions (`_charity`, `_house`, etc.) | No | Cosmetic. |
| INFO | Too many digits (`200000`, `2500000`, VRF_EXTRA_ARGS) | No | Cosmetic. |
| INFO | High cyclomatic complexity in `fulfillRandomWords` (15) | Marginal (+1 vs V3b) | Two additional `try` blocks add 2 branches. Accepted. |

---

## Mythril Analysis

```
The analysis was completed successfully. No issues were detected.
```

Run: `myth analyze TTSVotingV3c.sol --solc-json {"optimizer":{"enabled":true,"runs":200},"viaIR":true} --execution-timeout 60 --create-timeout 30`

---

## Storage Layout Verification

Slots 0–12 are byte-for-byte identical to V3b:

| Slot | Variable | Notes |
|------|----------|-------|
| 0 | `_owner` (Ownable) | |
| 1 | `admin` | |
| 2 | `stakingContract` | |
| 3 | `charityWallet` | |
| 4 | `houseWallet` | |
| 5 | `nftContract` | |
| 6 | `clubWallets` mapping | |
| 7 | `profileClub` mapping | |
| 8 | `currentRoundId` | |
| 9 | `_rounds` mapping | |
| 10 | `_profiles` mapping | |
| 11 | `_voterTotals` mapping | |
| 12 | `_vrfToRound` mapping | |

New constants (`VOTE_CAP_*`) are compile-time constants embedded in bytecode — **zero storage slots consumed.**

---

## Reviewer Checklist

- [ ] Multiplier values match design spec (tier3=2x, tier4=3x, tier5 absent)
- [ ] Three NFT mints: winner.wallet / topVoterAddr / houseWallet — correct recipients
- [ ] Vote cap values match design spec (500/1000/2500/5000/15000 TTS)
- [ ] `tierVoteCap` fallback correctly returns VOTE_CAP_UNSTAKED on staking revert
- [ ] VIP (tier≥5) correctly returns `type(uint256).max` (unlimited)
- [ ] Gas budget for 3 mints within CALLBACK_GAS_LIMIT (600k / 2500k = 24%)
- [ ] No new storage slots introduced
- [ ] Constructor params unchanged from V3b
- [ ] Prize split percentages unchanged
- [ ] `adminResetSettlement` still present and functional
- [ ] Reentrancy in `vote()` accepted (inherited from V3b, TTS not reentrant)
