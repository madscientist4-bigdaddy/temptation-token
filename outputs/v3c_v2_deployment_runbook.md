# V3c + TTSKeeper2V2 Deployment Runbook

**Revised:** 2026-06-07 — lean action-only rewrite; rollbacks moved to Appendix A  
**Executor:** Jim (Bank wallet `0xb1e991bf617459b58964eef7756b350e675c53b5`)  
**Status:** PRE-FLIGHT COMPLETE — ready to execute

---

## Pre-flight Checklist

| Item | Status |
|------|--------|
| Round 1 settled | ✅ settled=true (TX 0x50d0ec5e, May 15) |
| Bank wallet ETH | ✅ 0.0245 ETH — sufficient (~0.0042 ETH needed) |
| V3c compiler check | ✅ PASS (0 errors, 0 warnings; Slither HIGH accepted AF-001) |
| Keeper2V2 compiler check | ✅ PASS (0 HIGH Slither findings) |
| Gnosis co-signer available | Confirm before Step 6 — 2/2 needed |
| LINK | ✅ Recover ~27.4 LINK from 4 cancels (Step 7). No purchase needed. |

---

## Constructor Arguments

### V3c — FINAL, LOCKED

| Arg | Value |
|-----|-------|
| `_ttsToken` | `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` |
| `vrfCoordinator_` | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` |
| `_keyHash` | `0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70` |
| `_subscriptionId` | `58222014484560539249027457203866883376041731162442592604288474822166186263722` |
| `_stakingContract` | `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc` |
| `_charityWallet` | `0xf7dd429d679cb61231e73785fd1737e60138aba3` |
| `_houseWallet` | **`0x7a9ff2f584248744cBbA32c737D660ED6f077fCB`** ← Marketing wallet. V3b used Bank wallet — that was an error. Do NOT reuse Bank wallet here. |

### Keeper2V2

| Arg | Value |
|-----|-------|
| `_votingContract` | `<V3C_ADDRESS — fill after Step 1>` |

### Remix settings

`0.8.20` · optimizer ON (200 runs) · via IR ✓ · Base Mainnet (8453)

---

## Step 1 — Deploy V3c

1. Remix → `contracts/TTSVotingV3c.sol` → compile (0 errors, 0 warnings)
2. Deploy tab → Injected Web3 → confirm Base Mainnet (8453)
3. Fill constructor args from table above; double-check `_houseWallet` = `0x7a9ff2f...`
4. Deploy → MetaMask confirm → copy address

**`V3C_ADDRESS = ___________________________`**

```bash
cast call <V3C_ADDRESS> "houseWallet()(address)" --rpc-url https://mainnet.base.org
# MUST = 0x7a9ff2f584248744cBbA32c737D660ED6f077fCB  ← HALT + redeploy if Bank wallet
```

---

## Step 2 — setNFTContract

On `V3C_ADDRESS` from Bank wallet:
```
setNFTContract("0x0768e862D3AB14d85213BfeF8f1D012E77721da2")
```

```bash
cast call <V3C_ADDRESS> "nftContract()(address)" --rpc-url https://mainnet.base.org
# Expected: 0x0768e862D3AB14d85213BfeF8f1D012E77721da2
```

---

## Step 3 — Deploy Keeper2V2

1. Remix → `contracts/TTSKeeper2V2.sol` → compile (0 errors)
2. Constructor arg `_votingContract`: `V3C_ADDRESS`
3. Deploy → MetaMask confirm → copy address

**`KEEPER2V2_ADDRESS = ___________________________`**

```bash
cast call <KEEPER2V2_ADDRESS> "votingContract()(address)" --rpc-url https://mainnet.base.org
# Expected: V3C_ADDRESS
```

---

## Step 4 — Transfer V3c Ownership to Keeper2V2

On `V3C_ADDRESS` from Bank wallet:
```
transferOwnership(<KEEPER2V2_ADDRESS>)
```

```bash
cast call <V3C_ADDRESS> "owner()(address)" --rpc-url https://mainnet.base.org
# Expected: KEEPER2V2_ADDRESS
```

After this: `owner` = Keeper2V2 (controls startRound/settle/rollover). `admin` = Bank wallet (controls approveProfile forever).

---

## Step 5 — Add V3c as VRF Consumer

1. `vrf.chain.link/base` → Subscriptions → find subscription `58222014...263722`
2. **Add Consumer** → enter `V3C_ADDRESS` → confirm

Check: V3C_ADDRESS appears in consumer list on vrf.chain.link.

---

## Step 6 — Gnosis Tax-Exempt Batch

V3c must be tax-exempt before any settlement — 1% TTS tax would reduce payouts.

1. Open `app.safe.global` → Safe `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`
2. Transaction Builder → add call: `setTaxExempt(V3C_ADDRESS, true)` on TTS token `0x5570eA97...`
3. Both signers approve and execute (2/2)

```bash
cast call 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9 \
  "isTaxExempt(address)(bool)" <V3C_ADDRESS> --rpc-url https://mainnet.base.org
# Expected: true
```

---

## Step 7 — Chainlink: Cancel 4 Upkeeps → Recover LINK → Register New

**Root cause reminder:** Old automation failed because `s_forwarder` in TTSKeeper2 pointed to `0x6593c7de...` — no code on Base mainnet. All upkeep calls routed through it silently failed. Keeper2V2 ships with `s_forwarder = address(0)` and sets it explicitly in Step 8.

### 7a — LINK to recover

| Upkeep name | LINK balance | Fate |
|-------------|-------------|------|
| TTS Link Reserve Monitor | 7.11 LINK | Cancel + withdraw |
| TTS Settle Or Rollover | 6.2 LINK | Cancel + withdraw |
| TTS Midpoint Snapshot | 8.2 LINK | Cancel + withdraw |
| TTS Start Round | 5.9 LINK | Cancel + withdraw |
| **Total** | **~27.4 LINK** | |

### 7b — Cancel all 4 (automation.chain.link → Base mainnet)

For each upkeep above, in order:
1. Open upkeep → **Cancel upkeep** → MetaMask confirm
2. Wait ~2 min (50-block cooldown on Base)
3. **Withdraw funds** → MetaMask confirm → LINK returns to Bank wallet

Repeat for all 4. Confirm each shows status **Cancelled** and balance **0**.

### 7c — Register new Custom Logic upkeep

1. `automation.chain.link` → Base mainnet → **Register New Upkeep** → **Custom Logic**
2. Fill form:
   - Target contract: `KEEPER2V2_ADDRESS`
   - Name: `TTS Game Keeper V2`
   - Gas limit: `500000`
   - Check data: *(leave empty)*
   - Starting balance: `10 LINK`
3. Submit → MetaMask confirm
4. On upkeep detail page → copy **Forwarder address**

**`FORWARDER_ADDRESS = ___________________________`**

Transfer remaining ~17.4 LINK → `TTSLinkReserve` (`0xE8006d8F36827c97fd8f2932d4D2198B833A432F`).

---

## Step 8 — setForwarder on Keeper2V2 — CRITICAL

This is the exact fix for the prior automation failure. Set it, then verify.

On `KEEPER2V2_ADDRESS` from Bank wallet:
```
setForwarder(<FORWARDER_ADDRESS>)
```

**J3 verification — run both checks before proceeding:**
```bash
# Check 1: stored correctly
cast call <KEEPER2V2_ADDRESS> "s_forwarder()(address)" --rpc-url https://mainnet.base.org
# Must be non-zero FORWARDER_ADDRESS

# Check 2: forwarder has code on Base (the check that would have caught the prior failure)
cast code <FORWARDER_ADDRESS> --rpc-url https://mainnet.base.org | wc -c
# PASS: > 100 chars → forwarder is a live contract
# HALT: 2 chars ("0x") → no code → automation will fail silently → see Appendix A
```

---

## Step 9 — batchApproveProfiles

Pull approved wallets from Supabase:
```sql
SELECT id::text, payout_wallet FROM submissions WHERE status = 'approved' ORDER BY approved_at;
```

On `V3C_ADDRESS` from Bank wallet:
```
batchApproveProfiles(["id1","id2",...], ["0xwallet1","0xwallet2",...])
```

---

## Step 10 — Update Frontend VOTING_ADDRESS

Replace `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` with `V3C_ADDRESS` in:
- `src/App.jsx` → `VOTING_ADDRESS`
- `src/TTAdminDashboard.jsx` → `VOTING_ADDRESS` / `V3_ADDRESS` + screens config
- `api/approve-profile.js` → `V3_ADDRESS`

```bash
npm run build && npx vercel --prod
git add src/App.jsx src/TTAdminDashboard.jsx api/approve-profile.js
git commit -m "V3c: update VOTING_ADDRESS to <V3C_ADDRESS>"
git push origin main
```

---

## Step 11 — Verify Both Contracts on BaseScan

- V3c: `0.8.20` · optimizer 200 · via IR · single file → paste `outputs/v3c_flattened.sol`
- Keeper2V2: same → paste `outputs/keeper_v2_flattened.sol`

---

## Step 12 — Confirm Round 2 Starts Automatically ← GO / HALT

Chainlink polls `checkUpkeep` every block. With `currentRoundId = 0`, it returns `ACTION_START_ROUND`. Automation should call `performUpkeep` within **5 minutes of Step 8**.

Poll every 60 seconds for up to 5 minutes:
```bash
cast call <V3C_ADDRESS> "currentRoundId()(uint256)" --rpc-url https://mainnet.base.org
# GO: returns 1 → Round 2 is live ✅
# HALT: still 0 after 5 min → automation not firing → see Appendix A
```

If `currentRoundId = 1`, confirm round data:
```bash
cast call <V3C_ADDRESS> "getRound(uint256)(uint256,uint256,uint256,uint256,bool,bool,uint256)" \
  1 --rpc-url https://mainnet.base.org
# startTime > 0, endTime = startTime + 604740, settled = false
```

**If automation does NOT fire within 10 minutes: HALT — do not manually rescue yet.** Diagnose per Appendix A before taking any action.

---

## Complete State Verification Block

Run after Step 12 confirms GO:

```bash
RPC="https://mainnet.base.org"
V3C="<V3C_ADDRESS>"
KEEPER="<KEEPER2V2_ADDRESS>"
FORWARDER="<FORWARDER_ADDRESS>"
TTS="0x5570eA97d53A53170e973894A9Fa7feb5785d3b9"

echo "V3c.owner       :" && cast call $V3C "owner()(address)" --rpc-url $RPC
echo "V3c.admin       :" && cast call $V3C "admin()(address)" --rpc-url $RPC
echo "V3c.houseWallet :" && cast call $V3C "houseWallet()(address)" --rpc-url $RPC
echo "V3c.charityWallet:" && cast call $V3C "charityWallet()(address)" --rpc-url $RPC
echo "V3c.nftContract :" && cast call $V3C "nftContract()(address)" --rpc-url $RPC
echo "V3c.roundId     :" && cast call $V3C "currentRoundId()(uint256)" --rpc-url $RPC
echo "Keeper.voting   :" && cast call $KEEPER "votingContract()(address)" --rpc-url $RPC
echo "Keeper.forwarder:" && cast call $KEEPER "s_forwarder()(address)" --rpc-url $RPC
echo "Forwarder code  :" && cast code $FORWARDER --rpc-url $RPC | wc -c
echo "isTaxExempt(V3C):" && cast call $TTS "isTaxExempt(address)(bool)" $V3C --rpc-url $RPC
```

| Field | Expected |
|-------|----------|
| `V3c.owner` | KEEPER2V2_ADDRESS |
| `V3c.admin` | `0xb1e991bf...` (Bank) |
| `V3c.houseWallet` | `0x7a9ff2f...` (Marketing) ← CRITICAL |
| `V3c.charityWallet` | `0xf7dD429D...` (Polaris) |
| `V3c.nftContract` | `0x0768e862...` |
| `V3c.roundId` | `1` |
| `Keeper.forwarder` | non-zero FORWARDER_ADDRESS |
| `Forwarder code` | > 100 chars (J3 PASS) |
| `isTaxExempt(V3C)` | `true` |

---

## Gas Estimate

| Operation | Gas | ETH (0.01 gwei) |
|-----------|-----|-----------------|
| Deploy V3c | ~2,800,000 | ~0.0028 |
| setNFTContract | ~30,000 | ~0.00003 |
| Deploy Keeper2V2 | ~600,000 | ~0.0006 |
| transferOwnership | ~30,000 | ~0.00003 |
| setForwarder | ~30,000 | ~0.00003 |
| batchApprove (16 profiles) | ~600,000 | ~0.0006 |
| **Total** | **~4,090,000** | **~0.0041 ETH** |

Bank wallet: 0.0245 ETH — sufficient.

---

---

# Appendix A — Rollbacks and Diagnosis

## Per-Step Rollbacks

| Step | Symptom | Action |
|------|---------|--------|
| 1 | Wrong houseWallet | Redeploy V3c before Steps 2+. No state to undo. |
| 2 | Wrong NFT address | `setNFTContract(correct)` from Bank wallet. Admin role is permanent. |
| 3 | Wrong votingContract in Keeper | Redeploy Keeper2V2. No state. |
| 4 | Need to revert ownership | `KEEPER2V2.setVotingContract(0x6d6fF6...)` to redirect keeper back to V3b temporarily. |
| 5 | VRF consumer wrong | Remove via vrf.chain.link UI. No contract state. |
| 6 | Tax-exempt not set | Re-execute Gnosis batch. No urgency until first settlement. |
| 7 | Wrong upkeep target | Cancel and re-register. LINK refunded after cooldown. |
| 8 | J3 HALT (forwarder has no code) | `setForwarder(address(0))` immediately from Bank wallet. Manual `manualExecute()` still works. Contact Chainlink support for correct forwarder address before re-setting. |
| 9 | Wrong wallet approved | `approveProfile(profileId, correctWallet)` from Bank wallet. |
| 10 | Frontend pointing at old contract | Revert VOTING_ADDRESS and redeploy. |

## Automation Diagnosis (Step 12 HALT)

If `currentRoundId` is still 0 after 10 minutes:

```bash
# 1. Re-run J3 check
cast code <FORWARDER_ADDRESS> --rpc-url https://mainnet.base.org | wc -c
# If 2 → forwarder has no code → re-register upkeep, get new forwarder, re-run Step 8

# 2. Check upkeep LINK balance on automation.chain.link
# If 0 → add LINK via dashboard (no re-registration needed)

# 3. Check checkUpkeep return
cast call <KEEPER2V2_ADDRESS> "checkUpkeep(bytes)(bool,bytes)" \
  "0x" --rpc-url https://mainnet.base.org
# If (false, ...) → keeper doesn't see a needed action — check V3c.currentRoundId and round state
# If (true, ...) → keeper wants to act but automation isn't calling it → forwarder or LINK issue

# 4. Manual rescue (only if automation diagnosis is inconclusive and Round 2 is urgent)
# On KEEPER2V2_ADDRESS from Bank wallet:
# manualExecute(1)  → ACTION_START_ROUND
```

## VRF Rescue

If VRF is pending for > 24 hours after settlement call:
```bash
# On KEEPER2V2_ADDRESS from Bank wallet:
manualExecute(5)  # ACTION_RESET_VRF — triggers adminResetSettlement on V3c
```
Clears stuck `vrfPending` flag. Re-run settle sequence.
