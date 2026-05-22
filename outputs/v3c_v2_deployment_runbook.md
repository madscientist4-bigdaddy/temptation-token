# V3c + TTSKeeper2V2 Deployment Runbook

**Revised:** 2026-05-21 — houseWallet corrected to Marketing wallet per Jim's locked decision  
**Executor:** Jim (Bank wallet `0xb1e991bf617459b58964eef7756b350e675c53b5`)  
**Status:** PRE-FLIGHT COMPLETE — ready to deploy

---

## Pre-flight Checklist

| Item | Status |
|------|--------|
| Round 1 settled | ✅ settled=true (TX 0x50d0ec5e, May 15) |
| Bank wallet ETH | ✅ 0.0245 ETH — sufficient (~0.0042 ETH needed) |
| V3c compiler check | ✅ PASS (0 errors, 0 warnings; Slither HIGH accepted AF-001) |
| Keeper2V2 compiler check | ✅ PASS (0 HIGH Slither findings) |
| Gnosis co-signer available | Check before starting — 2/2 needed for tax-exempt batch (Step 6) |
| LINK for automation upkeep | ⚠️ 1 LINK in TTSLinkReserve — need 10 total. Buy ~9 LINK before Step 7. |

---

## V3c Constructor Arguments (FINAL — LOCKED)

| Arg | Value | Source |
|-----|-------|--------|
| `_ttsToken` | `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` | TTS proxy (on-chain read) |
| `vrfCoordinator_` | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` | Base mainnet VRF v2.5 |
| `_keyHash` | `0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70` | 200 gwei lane (same as V3b) |
| `_subscriptionId` | `58222014484560539249027457203866883376041731162442592604288474822166186263722` | Existing VRF subscription |
| `_stakingContract` | `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc` | TTSStaking proxy |
| `_charityWallet` | `0xf7dd429d679cb61231e73785fd1737e60138aba3` | Polaris Project (on-chain verified) |
| `_houseWallet` | **`0x7a9ff2f584248744cBbA32c737D660ED6f077fCB`** | **Marketing/Bonus wallet — CORRECTED from V3b** |

> **V3b error note:** V3b used Bank wallet (`0xb1e991bf...`) as houseWallet. That was wrong. V3c uses Marketing wallet for the 20% house cut. Locked decision by Jim (May 19, 2026).

### Keeper2V2 Constructor Argument

| Arg | Value |
|-----|-------|
| `_votingContract` | `<V3C_ADDRESS — fill after Step 1>` |

---

## Compiler Settings (Remix IDE)

- Compiler: `0.8.20`
- Optimizer: **ON**, runs: `200`
- `via IR`: **checked**
- EVM Version: `default`
- MetaMask network: **Base Mainnet (chainId 8453)**

---

## Step 1 — Deploy TTSVotingV3c

**Bank wallet signs. Human action required.**

1. Paste `contracts/TTSVotingV3c.sol` → compile (expect 0 errors, 0 warnings)
2. Deploy tab → Environment: Injected Web3 → confirm Base Mainnet (8453)
3. Contract: `TTSVotingV3c`
4. Fill constructor args from table above — verify `_houseWallet` is Marketing wallet
5. Deploy → confirm in MetaMask → copy deployed address

**Record: `V3C_ADDRESS = ___________________________`**

**Post-step on-chain checks:**
```bash
cast call <V3C_ADDRESS> "houseWallet()(address)" --rpc-url https://mainnet.base.org
# MUST BE: 0x7a9ff2f584248744cBbA32c737D660ED6f077fCB
# If Bank wallet: HALT — redeploy with correct _houseWallet

cast call <V3C_ADDRESS> "charityWallet()(address)" --rpc-url https://mainnet.base.org
# Expected: 0xf7dd429d679cb61231e73785fd1737e60138aba3

cast call <V3C_ADDRESS> "owner()(address)" --rpc-url https://mainnet.base.org
# Expected: 0xb1e991bf617459b58964eef7756b350e675c53b5

cast call <V3C_ADDRESS> "admin()(address)" --rpc-url https://mainnet.base.org
# Expected: 0xb1e991bf617459b58964eef7756b350e675c53b5
```

**Rollback:** Discard — redeploy with corrected args. No contract state exists yet.

---

## Step 2 — Set NFT Contract on V3c

`setNFTContract` is `onlyAdmin`. Admin stays with Bank wallet after ownership transfer; set it now.

Interact with V3C_ADDRESS from Bank wallet:
```
setNFTContract("0x0768e862D3AB14d85213BfeF8f1D012E77721da2")
```

**Post-step check:**
```bash
cast call <V3C_ADDRESS> "nftContract()(address)" --rpc-url https://mainnet.base.org
# Expected: 0x0768e862D3AB14d85213BfeF8f1D012E77721da2
```

**Rollback:** `setNFTContract(address(0))` from Bank wallet. Admin role stays permanently with Bank.

---

## Step 3 — Deploy TTSKeeper2V2

**Bank wallet signs. Human action required.**

1. Paste `contracts/TTSKeeper2V2.sol` → compile (0 errors)
2. Constructor arg `_votingContract`: V3C_ADDRESS
3. Deploy from Bank wallet → copy deployed address

**Record: `KEEPER2V2_ADDRESS = ___________________________`**

**Post-step checks:**
```bash
cast call <KEEPER2V2_ADDRESS> "votingContract()(address)" --rpc-url https://mainnet.base.org
# Expected: V3C_ADDRESS

cast call <KEEPER2V2_ADDRESS> "s_forwarder()(address)" --rpc-url https://mainnet.base.org
# Expected: 0x0000...0000 (not yet set — correct at this stage)
```

**Rollback:** Discard — redeploy. No state.

---

## Step 4 — Transfer V3c Ownership to Keeper2V2

**Bank wallet signs. Human action required.**

Interact with V3C_ADDRESS from Bank wallet:
```
transferOwnership(<KEEPER2V2_ADDRESS>)
```

After this:
- `V3c.owner()` = KEEPER2V2_ADDRESS → controls `startRound`, `requestSettlement`, `rolloverRound`
- `V3c.admin()` = Bank wallet → controls `approveProfile`, `batchApproveProfiles`, `setNFTContract`

**Post-step checks:**
```bash
cast call <V3C_ADDRESS> "owner()(address)" --rpc-url https://mainnet.base.org
# Expected: KEEPER2V2_ADDRESS

cast call <V3C_ADDRESS> "admin()(address)" --rpc-url https://mainnet.base.org
# Expected: 0xb1e991bf... (unchanged)
```

**Rollback:** `KEEPER2V2.setVotingContract(old_V3b_address)` to redirect keeper. Admin functions always callable by Bank wallet directly.

---

## Step 5 — Add V3c as VRF Subscription Consumer

1. Go to `vrf.chain.link/base` → Your Subscriptions
2. Find subscription `58222014484560539249027457203866883376041731162442592604288474822166186263722`
3. **Add Consumer** → enter V3C_ADDRESS → confirm

**Post-step check:** Consumer list on vrf.chain.link shows V3C_ADDRESS.

**Rollback:** Remove consumer from VRF UI. Does not affect V3c contract state.

---

## Step 6 — Gnosis Safe Tax-Exempt Batch for V3c

V3c must be tax-exempt before any vote settlement (1% TTS transfer tax would reduce payouts).

1. Open `outputs/gnosis_setTaxExempt_batch.json`
2. Add entry: `setTaxExempt(V3C_ADDRESS, true)` with selector `0x1dc61040`
3. Go to `app.safe.global` → Safe `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`
4. Import batch → both signers sign and execute (2/2)

**Post-step check:**
```bash
cast call 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9 \
  "isTaxExempt(address)(bool)" <V3C_ADDRESS> --rpc-url https://mainnet.base.org
# Expected: true
```

**Rollback:** New Gnosis batch: `setTaxExempt(V3C_ADDRESS, false)`.

---

## Step 7 — Register Chainlink Automation Upkeep

> **Root-cause of prior automation failure:** TTSKeeper2's `s_forwarder` was `0x6593c7de001fc8542bb1703532ee1e5aa0d458fd` — no code on Base mainnet (confirmed May 20 on-chain). This was likely the Ethereum mainnet Chainlink Registrar address, copied without verifying it exists on Base. Chainlink routes `performUpkeep` through the forwarder; with a dead address, all automation calls failed silently.
>
> **TTSKeeper2V2 fixes this:** `s_forwarder` is NOT set at deploy time. It is set explicitly via `setForwarder()` in Step 8, using the actual address Chainlink assigns after registration.

**LINK needed:** Buy ~9 LINK on Uniswap (Base LINK: `0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196`). 1 LINK in TTSLinkReserve can be added after.

### Upkeep Registration Form (automation.chain.link)

1. Connect wallet to Base mainnet
2. **Register New Upkeep** → **Custom Logic**
3. Form values:
   - Target contract address: `KEEPER2V2_ADDRESS`
   - Upkeep name: `TTS Game Keeper V2`
   - Gas limit: `500000`
   - Check data: (leave empty)
   - Starting balance: `10 LINK`
4. Submit → confirm in MetaMask
5. On upkeep detail page, copy the **Forwarder address**

**Record: `FORWARDER_ADDRESS = ___________________________`**

---

## Step 8 — setForwarder on Keeper2V2 — CRITICAL ROOT-CAUSE FIX

Interact with KEEPER2V2_ADDRESS from Bank wallet:
```
setForwarder(<FORWARDER_ADDRESS>)
```

**Post-step verification — J3 HALT CHECK:**
```bash
# 1. Confirm stored correctly
cast call <KEEPER2V2_ADDRESS> "s_forwarder()(address)" --rpc-url https://mainnet.base.org
# Expected: FORWARDER_ADDRESS

# 2. Confirm forwarder has code on Base (this is what was missing before)
CODESIZE=$(cast code <FORWARDER_ADDRESS> --rpc-url https://mainnet.base.org | wc -c)
echo "Forwarder bytecode length: $CODESIZE"
# PASS: > 100 characters → forwarder is a live contract on Base
# HALT: 2 characters ("0x") → forwarder has no code → automation will fail
# If HALT: setForwarder(address(0)), contact Chainlink support, investigate before Round 2
```

**Rollback:** `setForwarder(address(0))` from Bank wallet. Disables automated performUpkeep; `manualExecute()` still works.

---

## Step 9 — Verify checkUpkeep

```bash
cast call <KEEPER2V2_ADDRESS> "checkUpkeep(bytes)(bool,bytes)" \
  "0x" --rpc-url https://mainnet.base.org
# If currentRoundId=0: expected (true, 0x...01) — ACTION_START_ROUND
# If round already started: expected (false, 0x)
```

---

## Step 10 — Round 1 Start on V3c (Automation Test)

**Do not manually trigger if proving automation is the goal.**

After Step 8, Chainlink polls `checkUpkeep` every block. Since V3c starts with `currentRoundId = 0`, it returns `ACTION_START_ROUND`. Automation should call `performUpkeep(ACTION_START_ROUND)` within **1–5 minutes**.

**Pass criteria:**
```bash
cast call <V3C_ADDRESS> "currentRoundId()(uint256)" --rpc-url https://mainnet.base.org
# Expected: 1

cast call <V3C_ADDRESS> "getRound(uint256)(uint256,uint256,uint256,uint256,bool,bool,uint256)" \
  1 --rpc-url https://mainnet.base.org
# Expected: startTime>0, endTime=startTime+604740, settled=false
```

**If automation does NOT fire within 10 minutes:** This is RELEASE-BLOCKING — document it; do not manually rescue. Diagnose: check LINK balance in upkeep, check checkUpkeep return, check J3 forwarder code size.

---

## Step 11 — batchApproveProfiles on V3c

After Round 1 is live, Bank wallet (admin role — permanent) approves profiles.

```sql
-- Supabase query
SELECT id::text, payout_wallet FROM submissions WHERE status = 'approved' ORDER BY approved_at;
```

Interact with V3C_ADDRESS from Bank wallet:
```
batchApproveProfiles(["id1","id2",...], ["0xwallet1","0xwallet2",...])
```

---

## Step 12 — Update Frontend VOTING_ADDRESS

Replace `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` in:
- `src/App.jsx` → `VOTING_ADDRESS` constant
- `src/TTAdminDashboard.jsx` → `VOTING_ADDRESS` / `V3_ADDRESS` + screens config
- `api/approve-profile.js` → `V3_ADDRESS`

```bash
git add src/App.jsx src/TTAdminDashboard.jsx api/approve-profile.js
git commit -m "V3c: update VOTING_ADDRESS to <V3C_ADDRESS>"
git push origin main
```

---

## Step 13 — Verify Both Contracts on BaseScan

- V3c: Solidity 0.8.20, optimizer 200, via IR, single file → paste `outputs/v3c_flattened.sol`
- Keeper2V2: same → paste `outputs/keeper_v2_flattened.sol`

---

## Complete Post-Deploy State (copy-paste verification block)

```bash
RPC="https://mainnet.base.org"
V3C="<V3C_ADDRESS>"
KEEPER="<KEEPER2V2_ADDRESS>"
FORWARDER="<FORWARDER_ADDRESS>"
TTS="0x5570eA97d53A53170e973894A9Fa7feb5785d3b9"

echo "V3c.owner:" && cast call $V3C "owner()(address)" --rpc-url $RPC
echo "V3c.admin:" && cast call $V3C "admin()(address)" --rpc-url $RPC
echo "V3c.houseWallet:" && cast call $V3C "houseWallet()(address)" --rpc-url $RPC
echo "V3c.charityWallet:" && cast call $V3C "charityWallet()(address)" --rpc-url $RPC
echo "V3c.nftContract:" && cast call $V3C "nftContract()(address)" --rpc-url $RPC
echo "V3c.currentRoundId:" && cast call $V3C "currentRoundId()(uint256)" --rpc-url $RPC
echo "Keeper.votingContract:" && cast call $KEEPER "votingContract()(address)" --rpc-url $RPC
echo "Keeper.s_forwarder:" && cast call $KEEPER "s_forwarder()(address)" --rpc-url $RPC
echo "Forwarder code size:" && cast code $FORWARDER --rpc-url $RPC | wc -c
echo "isTaxExempt(V3C):" && cast call $TTS "isTaxExempt(address)(bool)" $V3C --rpc-url $RPC
```

**Expected values:**
- `V3c.owner` = KEEPER2V2_ADDRESS
- `V3c.admin` = `0xb1e991bf...` (Bank)
- `V3c.houseWallet` = `0x7a9ff2f...` (Marketing) ← CRITICAL
- `V3c.charityWallet` = `0xf7dD429D...` (Polaris)
- `V3c.nftContract` = `0x0768e862...`
- `V3c.currentRoundId` = `1` (after automation starts round)
- `Keeper.s_forwarder` = non-zero FORWARDER_ADDRESS
- `Forwarder code size` = > 100 chars (J3 PASS)
- `isTaxExempt(V3C)` = `true`

---

## Rollback Decision Tree

| Symptom | Action |
|---------|--------|
| Wrong houseWallet | Redeploy V3c before ownership transfer |
| Wrong V3c in Keeper2V2 | Redeploy Keeper2V2 |
| V3c bug post-ownership-transfer | `KEEPER.setVotingContract(old_V3b)` temporarily |
| Forwarder code size = 0 (J3 fail) | `setForwarder(0)` on Keeper2V2; manual execution still works; investigate |
| Automation not executing | Check LINK, check s_forwarder, check checkUpkeep() |
| VRF stuck | `adminResetSettlement(roundId)` from owner (Keeper2V2 → manualExecute) |

---

## LINK Acquisition

TTSLinkReserve: 1 LINK at `0xE8006d8F36827c97fd8f2932d4D2198B833A432F`
Need total: 10 LINK in automation upkeep
Must buy: ~9 LINK

**Buy on Uniswap (Base):** app.uniswap.org → Base → swap ETH for `0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196`
~$135 for 9 LINK. Bank wallet needs ~0.07 ETH for this swap + gas.

---

## Gas Estimate

| Operation | Gas | ETH (0.01 gwei) |
|-----------|-----|-----------------|
| Deploy V3c | ~2,800,000 | ~0.0028 |
| setNFTContract | ~30,000 | ~0.00003 |
| Deploy Keeper2V2 | ~600,000 | ~0.0006 |
| transferOwnership | ~30,000 | ~0.00003 |
| setForwarder | ~30,000 | ~0.00003 |
| manualExecute(1) if needed | ~80,000 | ~0.00008 |
| batchApprove (16 profiles) | ~600,000 | ~0.0006 |
| **Total** | **~4,170,000** | **~0.0042 ETH** |

Bank wallet: 0.0245 ETH — sufficient.

---

*Document last updated: 2026-05-21*
