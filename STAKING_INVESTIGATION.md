# Staking Contract Investigation Report
Generated: 2026-05-12 — completed investigation of TTSStaking at `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc`

---

## Summary

The staking contract is broken but **fully recoverable** via a UUPS upgrade executed from the Bank/Deployer wallet. No contract redeployment or multisig required.

---

## 1. Contract Architecture

| Field | Value |
|-------|-------|
| Proxy address | `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc` |
| Implementation | `0x370b8fd7cfa4abf1b16cbf1d9c7b875907f523ca` |
| Proxy size | 1,101 bytes (minimal UUPS proxy) |
| Implementation size | 16,416 bytes |
| BaseScan verified | NO — source not available |
| Upgrade pattern | **UUPS** (ERC-1967) — confirmed by `upgradeTo` (0x3659cfe6), `upgradeToAndCall` (0x4f1ef286), `proxiableUUID` (0x52d1902d) selectors in bytecode |
| Access control | **AccessControl** (not Ownable) — `hasRole` (0x91d14854), `grantRole` (0x2f2ff15d), `revokeRole` (0x36568abe) selectors confirmed |
| `owner()` | REVERTS — no Ownable interface |

---

## 2. Initialization State

**Already initialized — slot 0 = `0x1`** (`_initialized = 1`, OpenZeppelin Initializable flag)

Calling `initialize(BANK, TTS)` returns:
```
execution reverted: Initializable: contract is already initialized
```

This is definitive: the contract was initialized exactly once.

**Problem:** All other state variable slots (1–20) are **zero**. This means `initialize()` was called with zeroed arguments, e.g. `initialize(address(0), address(0))`, leaving the contract in a broken-but-initialized state.

Affected state vars (inferred from pattern):
- `ttsToken` = address(0) — no token reference
- All stake mappings empty (no users have staked)
- Access control: DEFAULT_ADMIN_ROLE holder = BANK (see Section 3)

---

## 3. Access Control

| Check | Result |
|-------|--------|
| `hasRole(DEFAULT_ADMIN_ROLE, BANK)` | **`true`** ✅ |
| `hasRole(DEFAULT_ADMIN_ROLE, IMPL)` | `false` |
| `grantRole(DEFAULT_ADMIN_ROLE, BANK)` sim from BANK | **succeeds** (`0x`) ✅ |
| `upgradeTo(current_impl)` sim from BANK | **succeeds** (`0x`) ✅ |

**BANK (`0xb1e991bf...`) has full DEFAULT_ADMIN_ROLE and upgrade authority.**

The DEFAULT_ADMIN_ROLE was set during initialization (likely via `_setupRole(DEFAULT_ADMIN_ROLE, msg.sender)` where `msg.sender` was the Bank wallet at deploy time, even though the `initialize()` args were zeroed).

---

## 4. Why `getStakingTier()` Always Reverts

`getStakingTier(address)` (selector `0xa8a82fd7`) reverts for every address tested. Likely cause: the function reads `ttsToken` (which is address(0)) and attempts a view call on it — e.g. to get TTS price for USD tier thresholds — which reverts as a call to address(0).

**Impact on V3b:** `_applyMultiplier()` wraps `getStakingTier()` in a try/catch:
```solidity
try stakingContract.getStakingTier(voter) returns (uint256 tier) {
    // apply multiplier
} catch { emit MultiplierFallback(voter); }
return amount;  // fallback: 1x multiplier
```

Every vote currently gets **1x multiplier** (no tier boost). All stakers are being underserved regardless of stake amount. The catch prevents the voting contract from breaking, so votes work normally — staking boosts just silently don't apply.

---

## 5. 71 Function Selectors Found in Implementation Bytecode

Key selectors (extracted via PUSH4 opcode scan):

| Selector | Likely Function |
|----------|----------------|
| `0x485cc955` | `initialize(address,address)` |
| `0x3659cfe6` | `upgradeTo(address)` |
| `0x4f1ef286` | `upgradeToAndCall(address,bytes)` |
| `0x52d1902d` | `proxiableUUID()` |
| `0x91d14854` | `hasRole(bytes32,address)` |
| `0x2f2ff15d` | `grantRole(bytes32,address)` |
| `0x36568abe` | `revokeRole(bytes32,address)` |
| `0x5c975abb` | `paused()` |
| `0x8456cb59` | `pause()` |
| `0x3f4ba83a` | `unpause()` |
| `0xa8a82fd7` | `getStakingTier(address)` |
| `0x817b1cd2` | probable `totalStaked()` |
| `0xa9059cbb` | `transfer(address,uint256)` |

Full AccessControlEnumerable (`getRoleMemberCount`, `getRoleMember`) is NOT present — only base AccessControl.

---

## 6. Recovery Path

### Option A — UUPS Upgrade to Fixed Implementation (RECOMMENDED)

Since BANK has upgrade authority, the fix is:

1. **Write new implementation** — `TTSStakingV2.sol` with:
   - Same external interface (no ABI changes required)
   - `reinitializer(2)` function: `function initializeV2(address _ttsToken, address _uniswapPool) reinitializer(2)`
   - Correct tier thresholds (USD-based via Uniswap price)
   - Fixed `getStakingTier()` that handles address(0) gracefully
   - BANK keeps DEFAULT_ADMIN_ROLE (no change needed)

2. **Deploy new implementation** — deploy to Base, verify on BaseScan

3. **Upgrade + re-initialize in one tx** from BANK wallet:
   ```js
   stakingProxy.upgradeToAndCall(newImpl, initializeV2.encode(TTS_TOKEN, UNISWAP_POOL))
   ```

4. **V3b starts working** — `getStakingTier()` stops reverting; vote boosts activate

**No Gnosis Safe required. No proxy redeployment. BANK wallet can execute solo.**

### Option B — Accept Broken Staking (Not Recommended)

- Leave staking proxy as-is
- All vote boosts silently give 1x (no boost)
- Users staking ANY amount get 0 boost benefit
- Staking UI shows tiers but they have no effect
- APR payouts from staking contract would also be broken

---

## 7. Staking Current State

| Item | Status |
|------|--------|
| Staking contract initialized | ✅ (once, with zeroed args) |
| ttsToken address set | ❌ address(0) |
| Any active stakers | Unknown — no state readable |
| Vote boosts working | ❌ All 1x (catch fallback) |
| BANK has upgrade authority | ✅ Confirmed |
| Recovery possible without redeployment | ✅ UUPS upgrade path |
| Gnosis Safe needed for fix | ❌ Not required |

---

## 8. Recommended Action

**Before Round 2 begins: execute UUPS upgrade to fix staking.**

Steps:
1. Claude drafts `TTSStakingV2.sol` with `reinitializer(2)` + corrected tier logic
2. Founder reviews + deploys implementation to Base
3. Founder calls `upgradeToAndCall(newImpl, encodedInitData)` from Bank wallet via Etherscan Write Contract
4. Verify `getStakingTier()` no longer reverts

This unblocks vote boosts and makes staking APR payouts functional before any real stake volume builds.

---

*Investigation performed via on-chain RPC reads and eth_call simulations. No transactions sent.*
