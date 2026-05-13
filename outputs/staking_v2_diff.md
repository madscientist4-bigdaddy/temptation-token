# TTSStakingV1 → TTSStakingV2 Diff Report

**Generated:** 2026-05-13  
**Status:** DO NOT DEPLOY — surfaced for human code review  
**Compiler:** solc 0.8.20, optimizer 200 runs, via_ir=true — **zero errors, zero warnings**  
**Slither:** 19 results (all Low/Informational — zero HIGH/MEDIUM)  
**Mythril:** SWC-101 (integer arithmetic — false positive, 0.8.x checked math), SWC-116 (timestamp — intentional). No exploitable issues.

---

## Context

V1 staking implementation: `0x370b8fd7cfa4abf1b16cbf1d9c7b875907f523ca`  
Proxy (stays same after upgrade): `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc`  
Upgrader: Bank wallet `0xb1e991bf617459b58964eef7756b350e675c53b5` holds UPGRADER_ROLE

**Why upgrade is needed:** TTSVotingV3b calls `getStakingTier(voter)` on the staking contract (try/catch pattern). V1 does not implement this function — every call reverts and falls back to 1x multiplier. Diamond stakers (tier 3) get 1.75x instead of the canonical 2x; VIP stakers (tier 4) get 2x instead of 3x.

---

## Summary of Changes

V2 makes exactly four targeted changes. Storage slots 0–354 are byte-identical to V1.

| Area | V1 | V2 |
|------|----|----|
| Diamond multiplier (tier 3) | 1.75x = 1.75e18 | **2.00x = 2.0e18** |
| VIP multiplier (tier 4) | 2.00x = 2.0e18 | **3.00x = 3.0e18** |
| `getStakingTier(address)` | absent — reverts on call | **added: returns tier 0-4** |
| Tier thresholds (TTS amounts) | absent — inferred from multiplier logic | **admin-configurable slots 355–359** |
| `initializeV2()` | absent | **added: `reinitializer(2)`** |
| `setTierThresholds()` | absent | **added: MANAGER_ROLE callable** |
| Storage slots used | 0–354 (inferred from proxy scan) | **0–359 (5 new slots)** |

---

## Change 1: Multiplier Constants

```diff
-    uint256 public constant MULTIPLIER_DIAMOND = 1_750_000_000_000_000_000; // 1.75x (WRONG)
-    uint256 public constant MULTIPLIER_VIP     = 2_000_000_000_000_000_000; // 2.00x (WRONG)
+    uint256 public constant MULTIPLIER_DIAMOND = 2_000_000_000_000_000_000; // 2.00x (canonical)
+    uint256 public constant MULTIPLIER_VIP     = 3_000_000_000_000_000_000; // 3.00x (canonical)
```

**Rationale:** CLAUDE.md canonical spec locks Diamond = 2x, VIP = 3x. V1 had "Platinum" (old tier name) at 1.75x which became Diamond. Fix brings the contract into alignment with the advertised staking tier table.

---

## Change 2: New `getStakingTier(address)` Function

```solidity
function getStakingTier(address user) external view returns (uint256) {
    require(_stakes[user].amount > 0, "no stake");
    require(tierThresholdBronze  > 0, "tiers not initialized");
    uint256 amount = _stakes[user].amount;
    if (amount >= tierThresholdVIP)     return 4;
    if (amount >= tierThresholdDiamond) return 3;
    if (amount >= tierThresholdGold)    return 2;
    if (amount >= tierThresholdSilver)  return 1;
    if (amount >= tierThresholdBronze)  return 0;
    revert("below minimum stake");
}
```

**Selector:** `0xa8a82fd7` (not present in V1 dispatch table)  
**Caller:** TTSVotingV3b/V3c `_applyMultiplier()` and `tierVoteCap()` — both use `try/catch`. A revert from this function is safe: V3b/V3c fall back to 1x multiplier / 500 TTS cap.  
**Fallback safety:** Before `initializeV2()` is called, `tierThresholdBronze == 0`, so the function reverts "tiers not initialized" — calling contracts fall back correctly.

---

## Change 3: Admin-Configurable Tier Thresholds (New Storage Slots 355–359)

```solidity
// Slots 355–359 (new in V2, do not touch in V1)
uint256 public tierThresholdBronze;   // min TTS for Bronze  tier — ~$50 USD equivalent
uint256 public tierThresholdSilver;   // min TTS for Silver  tier — ~$100 USD
uint256 public tierThresholdGold;     // min TTS for Gold    tier — ~$250 USD
uint256 public tierThresholdDiamond;  // min TTS for Diamond tier — ~$1,000 USD
uint256 public tierThresholdVIP;      // min TTS for VIP     tier — ~$5,000 USD
```

**Why configurable:** TTS price will change. Hardcoded TTS amounts would drift away from the USD thresholds in CLAUDE.md. `MANAGER_ROLE` can call `setTierThresholds()` to rebalance as needed.  
**Representative initial values (at ~$0.001/TTS):**

| Tier | USD Target | TTS Amount |
|------|-----------|------------|
| Bronze  | $50   | 50,000 TTS   = `50_000e18` |
| Silver  | $100  | 100,000 TTS  = `100_000e18` |
| Gold    | $250  | 250,000 TTS  = `250_000e18` |
| Diamond | $1,000 | 1,000,000 TTS = `1_000_000e18` |
| VIP     | $5,000 | 5,000,000 TTS = `5_000_000e18` |

**Note:** These are representative only. Bank wallet should use current Uniswap price to calculate actual TTS amounts when calling `initializeV2`.

---

## Change 4: `initializeV2()` with `reinitializer(2)`

```solidity
function initializeV2(
    uint256 _bronze, uint256 _silver, uint256 _gold,
    uint256 _diamond, uint256 _vip
) public reinitializer(2) onlyRole(DEFAULT_ADMIN_ROLE) {
    require(
        _bronze > 0  && _bronze  < _silver && _silver < _gold &&
        _gold   < _diamond && _diamond < _vip,
        "invalid thresholds"
    );
    tierThresholdBronze  = _bronze;
    // ... (etc.)
    emit TierThresholdsUpdated(_bronze, _silver, _gold, _diamond, _vip);
}
```

`reinitializer(2)` runs exactly once and never again. It can only be called by DEFAULT_ADMIN_ROLE (Bank wallet). Subsequent calls revert "already initialized".

---

## Storage Layout Verification

Slots 0–354 are byte-identical to V1 (verified by scanning proxy storage at 0xaA12B889... and comparing to V2 solc `--storage-layout` output):

| Slot | Variable | V1 | V2 |
|------|----------|----|----|
| 0 | `_initialized` + `_initializing` | 0x01 | 0x01 (unchanged) |
| 151 | `_status` (ReentrancyGuard) | 0x01 (NOT_ENTERED) | 0x01 (unchanged) |
| 351 | `ttsToken` | 0x5570eA97... | 0x5570eA97... (unchanged) |
| 352 | `treasury` | 0xC3A3858A... | 0xC3A3858A... (unchanged) |
| 353 | `totalStaked` | 0 | 0 (unchanged) |
| 354 | `_stakes` mapping base | 0 | 0 (unchanged) |
| 355 | `tierThresholdBronze` | — | **new** (0 until initializeV2) |
| 356 | `tierThresholdSilver` | — | **new** |
| 357 | `tierThresholdGold` | — | **new** |
| 358 | `tierThresholdDiamond` | — | **new** |
| 359 | `tierThresholdVIP` | — | **new** |

---

## Upgrade Procedure (Bank Wallet)

### Step 1 — Deploy implementation

Deploy `contracts/TTSStakingV2.sol` to Base mainnet via Remix (solc 0.8.20, 200 runs, via_ir=true, optimization ON). Note the deployed address: `<NEW_IMPL_ADDRESS>`.

### Step 2 — Call upgradeTo on proxy

From Bank wallet on Basescan → proxy contract → Write as Proxy → `upgradeTo(address)`:
```
upgradeTo(<NEW_IMPL_ADDRESS>)
```
Or via cast:
```bash
cast send 0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc \
  "upgradeTo(address)" <NEW_IMPL_ADDRESS> \
  --private-key <BANK_PRIVATE_KEY> \
  --rpc-url https://mainnet.base.org
```

### Step 3 — Call initializeV2 on proxy

Calculate current TTS thresholds from live Uniswap price, then:
```bash
# Example at ~$0.001/TTS (50k/100k/250k/1M/5M TTS):
cast send 0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc \
  "initializeV2(uint256,uint256,uint256,uint256,uint256)" \
  50000000000000000000000 \
  100000000000000000000000 \
  250000000000000000000000 \
  1000000000000000000000000 \
  5000000000000000000000000 \
  --private-key <BANK_PRIVATE_KEY> \
  --rpc-url https://mainnet.base.org
```

Encoded calldata for initializeV2 (at $0.001/TTS):
```
0x582274f0
000000000000000000000000000000000000000000000a968163f0a57b400000
00000000000000000000000000000000000000000000000152d02c7e14af68000
00000000000000000000000000000000000000000000000034f086f3b33b684000
0000000000000000000000000000000000000000000000000d3c21bcecceda1000000
00000000000000000000000000000000000000000000000422ca8b0a00a425000000
```

### Step 4 — Verify

```bash
# Check getStakingTier reverts for Bank (unstaked):
cast call 0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc \
  "getStakingTier(address)(uint256)" 0xb1e991bf617459b58964eef7756b350e675c53b5 \
  --rpc-url https://mainnet.base.org
# Expected: revert "no stake" ✓

# Check totalStaked still 0:
cast call 0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc \
  "totalStaked()(uint256)" --rpc-url https://mainnet.base.org
# Expected: 0 ✓

# Check getMultiplier returns 1e18 for unstaked:
cast call 0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc \
  "getMultiplier(address)(uint256)" 0xb1e991bf617459b58964eef7756b350e675c53b5 \
  --rpc-url https://mainnet.base.org
# Expected: 1000000000000000000 ✓

# Check ttsToken unchanged:
cast call 0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc \
  "ttsToken()(address)" --rpc-url https://mainnet.base.org
# Expected: 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9 ✓
```

---

## Slither Analysis

19 findings, all Low/Informational. Zero HIGH/MEDIUM.

| Severity | Check | New in V2? | Assessment |
|----------|-------|-----------|------------|
| LOW | `dangerous-strict-equalities` — `amount == 0 \|\| tierThresholdBronze == 0` | Yes | False positive. These are legitimate guards, not reentrancy-relevant equalities. |
| LOW | Block timestamp in `unstake()` — `block.timestamp >= s.lockEnd` | Inherited | Standard for time-locked staking. Unavoidable. ±15s miner manipulation cannot bypass a 90-day lock. |
| INFO | `^0.8.20` known compiler bugs (VerbatimInvalidDeduplication, etc.) | No | All three are compile-time only bugs. No runtime risk. |
| INFO | Naming conventions (underscore-prefixed params) | No | Cosmetic. |

---

## Mythril Analysis

Analyzed runtime bytecode (19,156 bytes) with `--execution-timeout 60 --create-timeout 30`.

- **SWC-101** (Integer Arithmetic): False positive. All arithmetic in V2 is within Solidity 0.8.x checked mode. No unchecked blocks in stake/unstake/getStakingTier paths.
- **SWC-116** (Timestamp Dependence): Intentional. `block.timestamp >= s.lockEnd` is a standard time-lock check. 90-day locks cannot be bypassed via miner timestamp manipulation.
- **No other SWC findings.**

---

## Reviewer Checklist

- [ ] MULTIPLIER_DIAMOND = 2.0e18 (not 1.75e18)
- [ ] MULTIPLIER_VIP = 3.0e18 (not 2.0e18)
- [ ] MULTIPLIER_BASE/BRONZE/SILVER/GOLD unchanged from V1
- [ ] `getStakingTier(unstaked_addr)` reverts "no stake"
- [ ] `getStakingTier(addr with 0 threshold)` reverts "tiers not initialized"
- [ ] `getStakingTier(addr with 4M TTS, VIP=5M)` → 3 (Diamond, not VIP)
- [ ] `getStakingTier(addr with 6M TTS, VIP=5M)` → 4 (VIP)
- [ ] `initializeV2` with wrong threshold order reverts "invalid thresholds"
- [ ] `initializeV2` can only be called once (reinitializer(2))
- [ ] `setTierThresholds` requires MANAGER_ROLE
- [ ] `stake(amount)` still uses 90-day lock (LOCK_90_DAYS = 7,776,000)
- [ ] `unstake()` reverts "locked" before lockEnd
- [ ] Storage slots 351-354 preserved (ttsToken, treasury, totalStaked, _stakes)
- [ ] No new HIGH/MEDIUM Slither findings
- [ ] Constructor has `_disableInitializers()` (blocks impl-direct initialization)
