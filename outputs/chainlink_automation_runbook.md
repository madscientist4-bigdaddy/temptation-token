# Chainlink Automation Root Cause + Remediation Runbook

**Generated:** 2026-05-20  
**Applies to:** TTSKeeper2V2 + TTSVotingV3c (post-deployment)

---

## B1 — Root Cause: Why Round 1 Did Not Auto-Settle

### Evidence

| Check | Result |
|-------|--------|
| TTSKeeper2 `votingContract` | `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` ✅ |
| TTSKeeper2 `owner` | `0xB1E991bF...` (Bank wallet) ✅ |
| TTSKeeper2 storage slot 2 (`s_forwarder`) | `0x6593c7de001fc8542bb1703532ee1e5aa0d458fd` |
| Is forwarder a contract on Base? | **NO — zero code (empty address on Base)** |
| LINK balance in Chainlink Automation upkeep | **0 LINK (unfunded)** |
| TTSLinkReserve LINK balance | `1.0 LINK` (not deposited into upkeep) |

### Root Cause (Two Separate Failures)

**Failure 1 — CRITICAL: Wrong forwarder address**  
TTSKeeper2's `s_forwarder` storage slot holds `0x6593c7de001fc8542bb1703532ee1e5aa0d458fd`, which has **no code on Base mainnet**. This is an Ethereum mainnet address. Chainlink Automation routes `performUpkeep` calls through the forwarder. A forwarder with no code on Base means Chainlink's automation calls reverted — automation could never execute even if funded.

This bug is documented in TTSKeeper2V2.sol header:
```
// CRITICAL  s_forwarder pointed to Ethereum mainnet Registrar (no code on Base)
// HIGH      performUpkeep lacked forwarder-check; any EOA could call it
```

TTSKeeper2V2 fixes both: `performUpkeep` is gated to the forwarder address set via `setForwarder()` after registration.

**Failure 2 — HIGH: Upkeep had 0 LINK**  
Separately, the Chainlink Automation upkeep had 0 LINK balance. Even if the forwarder was correct, automation requires LINK in the upkeep to execute.

**Conclusion:** Both failures were present simultaneously. The primary root cause is the wrong forwarder address; the secondary cause is insufficient LINK. Round 1 required Jim's manual call (`manualExecute(3)`) to settle on May 15.

---

## B2 — Remediation: Deploy + Register TTSKeeper2V2

### Prerequisites

- [ ] TTSVotingV3c deployed (get its address first)
- [ ] Bank wallet has >0.01 ETH for gas
- [ ] Enough LINK for upkeep (minimum 5 LINK, recommended 10 LINK)

### Step 1: Deploy TTSKeeper2V2

In Remix (solc 0.8.20, optimizer 200 runs, via IR, Base mainnet):

```
Contract: contracts/TTSKeeper2V2.sol
Constructor args:
  _votingContract: "<V3c address — fill after V3c deploy>"
Deploy from: Bank wallet (0xb1e991bf617459b58964eef7756b350e675c53b5)
```

Save the deployed address as `KEEPER2V2_ADDRESS`.

### Step 2: Transfer V3c Ownership to Keeper2V2

In Remix, connected as Bank wallet:
```
V3c.transferOwnership(KEEPER2V2_ADDRESS)
```
Verify: `V3c.owner()` returns `KEEPER2V2_ADDRESS`.

### Step 3: Set V3c NFT Contract on Keeper2V2

```
KEEPER2V2.setVotingContract(V3C_ADDRESS)  ← already set in constructor
V3c.setNFTContract(0x0768e862D3AB14d85213BfeF8f1D012E77721da2)  ← call from Keeper2V2 (owner)
```

Wait — V3c's owner is now Keeper2V2. So to call `setNFTContract` on V3c, call through Keeper2V2's `manualExecute` OR temporarily call it before transferring ownership.

**Correct sequence:** Set NFT contract on V3c BEFORE transferring ownership to Keeper2V2.

```
1. Deploy V3c (Bank wallet = owner)
2. V3c.setNFTContract(0x0768e862D3AB14d85213BfeF8f1D012E77721da2)   ← Bank wallet as owner
3. V3c.transferOwnership(KEEPER2V2_ADDRESS)                           ← Bank wallet as owner
```

### Step 4: Add V3c to Chainlink VRF Subscription

1. Go to `vrf.chain.link` → Your Subscriptions → ID `58222014484560539249027457203866883376041731162442592604288474822166186263722`
2. Click **Add Consumer**
3. Enter V3c address
4. Confirm (requires VRF sub owner wallet)

### Step 5: Register Chainlink Automation Upkeep

1. Go to `automation.chain.link` → **Register New Upkeep**
2. Select **Custom Logic** (not time-based)
3. Target contract: `KEEPER2V2_ADDRESS`
4. Gas limit: `500000`
5. Starting balance: **10 LINK** (minimum: 5 LINK)
6. Source LINK: Withdraw from TTSLinkReserve (`0xE8006d8F36827c97fd8f2932d4D2198B833A432F`) first

**How to withdraw from TTSLinkReserve:**
TTSLinkReserve has 1 LINK. BaseScan write contract → call `withdraw(address recipient, uint256 amount)` from owner wallet. You'll need additional LINK — buy on Uniswap on Base (LINK contract on Base: `0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196`).

### Step 6: Set Forwarder on Keeper2V2

After upkeep registration, Chainlink UI shows a **Forwarder address** for the upkeep. Copy it.

From Bank wallet:
```
KEEPER2V2.setForwarder(<forwarder address from Chainlink UI>)
```

Verify: `KEEPER2V2.s_forwarder()` returns the forwarder.

### Step 7: Execute Gnosis Tax-Exempt Batch for V3c

V3c must be tax-exempt before any vote settlement can succeed. Use `outputs/gnosis_setTaxExempt_batch.json` — add V3c address as TX#10 with selector `0x1dc61040` before importing to app.safe.global.

### Step 8: Start Round 1 on V3c

```bash
# Call manualExecute(1) on Keeper2V2 from Bank wallet
ACTION=1 DEPLOYER_PRIVATE_KEY=0x... node scripts/manual-execute.js
```

Or wait ~30 seconds for Chainlink automation to detect `checkUpkeep` returning true (roundId=0 → start round).

### Step 9: batchApproveProfiles on V3c

Pull approved profiles from Supabase and batch-approve on V3c. See `outputs/v3c_v2_deployment_runbook.md` for full batchApprove script.

---

## B3 — Will Round 2 Onward Be Fully Autonomous?

**YES, conditionally** — once all of the following are true:

| Requirement | Status |
|-------------|--------|
| V3c deployed with Keeper2V2 as owner | ❌ Not done |
| Keeper2V2 upkeep registered at automation.chain.link | ❌ Not done |
| Upkeep funded with ≥5 LINK | ❌ 0 LINK in any upkeep currently |
| TTSLinkReserve LINK moved into upkeep | ❌ 1 LINK sitting idle in reserve |
| Keeper2V2 `s_forwarder` set correctly | ❌ Not done |
| V3c tax-exempt via Gnosis Safe | ❌ Not done |

**What "fully autonomous" means:**
- Round ends → Chainlink detects `endTime` passed → calls `performUpkeep(ACTION_SETTLE)` → VRF requested → VRF callback settles round + distributes prizes + mints NFTs
- New round starts → Chainlink detects previous round settled → calls `performUpkeep(ACTION_START_ROUND)` → next round begins
- No human action needed per round

**What is NOT automated:**
- `batchApproveProfiles` — still requires human action per round (admin calls it after reviewing submitted profiles)
- Gnosis Safe transactions (tax-exempt batch) — require 2/2 signatures
- LINK top-ups — must be monitored; upkeep cancels if LINK runs out (minimum balance ~0.1 LINK)
- VRF subscription funding — must be monitored separately

**Risk:** If LINK drops below minimum balance in the automation upkeep, Chainlink stops executing. A monitoring alert should be set at `automation.chain.link` → Notifications to get email when balance < 2 LINK.

---

## LINK Budget Estimate

| Item | Cost |
|------|------|
| Settlement (VRF call) | ~0.15 LINK per round |
| startRound + checkUpkeep calls | ~0.01 LINK per round |
| Per-round total | ~0.16–0.20 LINK |
| 6 months at 1 round/week | ~4–5 LINK |
| **Recommended starting balance** | **10 LINK** |
| Available in TTSLinkReserve | 1 LINK |
| **Need to acquire** | ~9 LINK |

---

*Document last updated: 2026-05-20*
