# V3c + TTSKeeper2V2 Deployment Runbook

**Date drafted:** 2026-05-15  
**Executor:** Jim (Bank wallet `0xb1e991bf617459b58964eef7756b350e675c53b5`)  
**Status:** DO NOT DEPLOY until Round 1 manually settled and Jim reviews code

---

## Pre-flight checklist

- [ ] Round 1 settled manually (owner calls `manualExecute(3)` on old TTSKeeper2)
- [ ] Jim has reviewed `contracts/TTSVotingV3c.sol` and `contracts/TTSKeeper2V2.sol`
- [ ] Gnosis Safe co-signer (Jim + co-signer) available to execute tax-exempt batch
- [ ] Bank wallet has ≥ 0.05 ETH on Base for gas
- [ ] 5 LINK available in Bank wallet or LinkReserve for upkeep funding
- [ ] Remix IDE open at remix.ethereum.org with MetaMask connected to **Base mainnet**

---

## Step 1 — Compile both contracts in Remix

**Compiler settings (both contracts):**
- Solidity: `0.8.20`
- Optimizer: enabled, runs `200`
- `via IR`: ✅ checked (`--via-ir` flag)

1. Paste `contracts/TTSVotingV3c.sol` into Remix → compile → confirm 0 errors
2. Paste `contracts/TTSKeeper2V2.sol` into Remix → compile → confirm 0 errors

---

## Step 2 — Deploy TTSVotingV3c

**Contract:** `TTSVotingV3c`  
**Constructor args** (use exact values — same as V3b):

| Arg | Value |
|-----|-------|
| `_ttsToken` | `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` |
| `vrfCoordinator_` | *Read from V3b contract's `i_vrfCoordinator` immutable. In Remix: call V3b at `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` and read raw bytecode at immutable offset, OR use the same address you used when deploying V3b.* |
| `_keyHash` | *Same keyHash used for V3b subscription on vrf.chain.link/base* |
| `_subscriptionId` | *Same subscription ID as V3b — check at vrf.chain.link/base* |
| `_stakingContract` | `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc` |
| `_charityWallet` | `0xf7dd429d679cb61231e73785fd1737e60138aba3` |
| `_houseWallet` | `0xb1e991bf617459b58964eef7756b350e675c53b5` |

Click **Deploy** from Bank wallet.

> **Record:** `V3c_ADDRESS = 0x...` ← paste actual address here before continuing

---

## Step 3 — Deploy TTSKeeper2V2

**Contract:** `TTSKeeper2V2`  
**Constructor arg:**

| Arg | Value |
|-----|-------|
| `_votingContract` | `V3c_ADDRESS` from Step 2 |

Click **Deploy** from Bank wallet.

> **Record:** `KEEPER_ADDRESS = 0x...` ← paste actual address here before continuing

---

## Step 4 — Transfer V3c ownership to Keeper

In Remix, interact with **TTSVotingV3c** at `V3c_ADDRESS`:

```
transferOwnership(KEEPER_ADDRESS)
```

Call from Bank wallet. After this, V3c `owner()` = KEEPER_ADDRESS.

> V3c `admin` role stays with Bank wallet (deployer). `admin` controls profile approvals and club management — separate from `owner`.

---

## Step 5 — Set V3c NFT contract

In Remix, interact with **TTSVotingV3c** at `V3c_ADDRESS` (using Bank wallet as admin):

```
setNFTContract("0x0768e862D3AB14d85213BfeF8f1D012E77721da2")
```

---

## Step 6 — Add V3c as VRF consumer

1. Go to [vrf.chain.link/base](https://vrf.chain.link/base)
2. Open the existing subscription (same one used for V3b)
3. Click **Add consumer** → enter `V3c_ADDRESS`
4. Confirm from Bank wallet

> Do NOT remove V3b from the subscription yet — leave it until V3c is confirmed working.

---

## Step 7 — Register Chainlink Automation upkeep

1. Go to [automation.chain.link/base](https://automation.chain.link/base)
2. Click **Register new upkeep**
3. Choose: **Custom Logic**
4. **Target contract:** `KEEPER_ADDRESS`
5. **Upkeep name:** `TTS Round Manager`
6. **Gas limit:** `500000` (performUpkeep calls startRound or settleRound, ~150k gas each)
7. **Starting balance:** `5 LINK`
8. **Email:** (optional — for low-balance alerts)
9. Submit → confirm from Bank wallet

After registration completes:
- Chainlink assigns a **Forwarder address** — visible in the upkeep details page
- Note it down

> **Record:** `FORWARDER_ADDRESS = 0x...` ← paste here

---

## Step 8 — Set forwarder on TTSKeeper2V2

In Remix, interact with **TTSKeeper2V2** at `KEEPER_ADDRESS` from Bank wallet:

```
setForwarder("FORWARDER_ADDRESS")
```

This enables Chainlink automation. Until this call, only the Bank wallet can trigger performUpkeep.

---

## Step 9 — Update Gnosis Safe tax-exempt batch

The existing `outputs/gnosis_setTaxExempt_batch.json` has 9 transactions for V3b and associated contracts. Add a 10th for V3c:

**TX#10 calldata:**
```
to:   0x5570eA97d53A53170e973894A9Fa7feb5785d3b9   (TTS token proxy)
data: 0x1dc61040
      + 000000000000000000000000
      + V3c_ADDRESS_lowercase (40 hex chars, no 0x)
      + 0000000000000000000000000000000000000000000000000000000000000001
```

Example (replace with actual V3c address):
```
0x1dc61040
000000000000000000000000[V3c_ADDRESS_40_CHARS]
0000000000000000000000000000000000000000000000000000000000000001
```
= 136 hex chars total after `0x`. Verify length before submitting.

Then import updated JSON at [app.safe.global](https://app.safe.global) → execute. Both signers must approve.

> **This batch is REQUIRED before Round 2 has any actual votes.** V3c must be tax-exempt or settlement will revert when winner transfer occurs.

---

## Step 10 — Batch approve all 16 profiles on V3c

V3c starts with `currentRoundId = 0` — no round yet. Start a round first (Step 11), then approve profiles within that round.

Actually: profiles can ONLY be approved while a round is active (`startTime > 0 && !settled`). So:

1. First start Round 2 (Step 11)
2. Then call `batchApproveProfiles` from Bank wallet (admin role)

Pull profile IDs and payout wallets from Supabase:
```sql
SELECT id::text, payout_wallet FROM submissions WHERE status = 'approved' ORDER BY approved_at;
```

In Remix, call on TTSVotingV3c:
```
batchApproveProfiles(
  ["profile_id_1", "profile_id_2", ...],
  ["0xwallet1", "0xwallet2", ...]
)
```

---

## Step 11 — Start Round 2

From Bank wallet, call on **TTSKeeper2V2**:

```
manualExecute(1)
```

This calls `V3c.startRound(604740)` — starts a round ending Monday 03:59 UTC (7 days − 60s from now).

Verify: call `V3c.getRound(1)` and confirm `startTime > 0`, `settled = false`, `endTime = now + 604740`.

> Note: approve profiles (Step 10) within the same block or immediately after — Chainlink won't fire for the next ~7 days.

---

## Step 12 — Update frontend

Replace `VOTING_ADDRESS` in all three files (search for `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`):

```
src/App.jsx                        → VOTING_ADDRESS constant
src/TTAdminDashboard.jsx           → VOTING_ADDRESS / V3_ADDRESS constant
api/approve-profile.js             → V3_ADDRESS or VOTING constant
```

Also update the V3 contract in the `screens` config objects in TTAdminDashboard.

```bash
cd ~/Desktop/temptation-token
git add src/App.jsx src/TTAdminDashboard.jsx api/approve-profile.js
git commit -m "V3c: update VOTING_ADDRESS to new contract"
git push origin main
```

Vercel auto-deploys on push.

---

## Step 13 — Verify V3c on BaseScan

1. In Remix: **Plugin Manager** → install **Flattener** → flatten TTSVotingV3c.sol → save output
2. Go to basescan.org → search V3c_ADDRESS → **Verify & Publish**
3. Settings: Solidity `0.8.20`, optimizer `200 runs`, `via IR` checked, single file
4. Paste flattened source → submit

---

## Step 14 — Verify TTSKeeper2V2 on BaseScan

Same process for KEEPER_ADDRESS. The contract is simpler and flattens easily.

---

## Post-deployment smoke tests

| Test | Expected result |
|------|----------------|
| `V3c.owner()` | `KEEPER_ADDRESS` |
| `V3c.admin()` | Bank wallet `0xb1e991bf...` |
| `V3c.currentRoundId()` | `1` (after manualExecute(1)) |
| `V3c.nftContract()` | `0x0768e862D3AB14d85213BfeF8f1D012E77721da2` |
| `KEEPER.votingContract()` | `V3c_ADDRESS` |
| `KEEPER.s_forwarder()` | `FORWARDER_ADDRESS` (non-zero) |
| `KEEPER.checkUpkeep("")` | `(false, "")` while round is active |
| `isTaxExempt(V3c_ADDRESS)` on TTS | `true` (after Gnosis batch) |
| VRF subscription consumer list | V3c_ADDRESS present |
| Chainlink upkeep balance | ≥ 4.5 LINK |
| Frontend app.temptationtoken.io | Shows Round 2, correct endTime |
| Admin Dashboard → System Health | No overdue round alert |

---

## Rollback plan

If V3c has a critical bug after deployment:

1. Call `KEEPER.setVotingContract(OLD_V3b_ADDRESS)` to revert keeper to V3b
2. Call `V3b.transferOwnership(Bank_wallet)` if V3b ownership was transferred
3. Update `VOTING_ADDRESS` back to V3b in App.jsx and redeploy frontend
4. V3b is still deployed and unchanged — no state was migrated

---

## Gas estimates

| Operation | ~Gas |
|-----------|------|
| Deploy TTSVotingV3c | ~2,800,000 |
| Deploy TTSKeeper2V2 | ~600,000 |
| transferOwnership | ~30,000 |
| setNFTContract | ~30,000 |
| Add VRF consumer | ~50,000 |
| Register upkeep (Chainlink UI) | ~150,000 |
| setForwarder | ~30,000 |
| manualExecute(1) startRound | ~80,000 |
| batchApproveProfiles (16 profiles) | ~600,000 |
| **Total ETH at 0.01 gwei Base fee** | ~**0.005 ETH** |
