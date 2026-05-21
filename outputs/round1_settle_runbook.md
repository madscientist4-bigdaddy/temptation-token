# Round Settlement + Manual Override Runbook

**Generated:** 2026-05-20  
**Status:** HISTORICAL — Round 1 already settled. Use as template for future rounds.

---

## Current State (verified on-chain 2026-05-20)

| Field | Value |
|-------|-------|
| Contract | TTSVotingV3b `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` |
| currentRoundId | 1 |
| startTime | 2026-05-07 03:23:13 UTC |
| endTime | 2026-05-14 03:23:13 UTC |
| settled | **true — CONFIRMED ✅** |
| vrfPending | false |
| totalRawVotes | 0 (no voters in Round 1) |
| totalTickets | 0 |
| profileCount | 15 |
| Round 2 | Not started |

**What happened:** Jim (Bank wallet) called `manualExecute(3)` on TTSKeeper2 at block 46046030 (May 15, 2026 21:43 UTC), tx `0x50d0ec5ed6ff5d0c30fa79956162e8d2278ccbc33bd091be14784f71f423c41d`. This triggered a VRF request (requestId `0xf7e988...`). VRF responded; since `totalTickets = 0`, the callback set `settled = true` and returned early — **no prizes distributed** (no votes to distribute).

---

## TTSKeeper2V2 Action Constants

| Constant | Value | Effect |
|----------|-------|--------|
| `ACTION_START_ROUND` | 1 | Calls `votingContract.startRound()` |
| `ACTION_SNAPSHOT` | 2 | No-op (kept for compatibility) |
| `ACTION_SETTLE` | **3** | Calls `votingContract.requestSettlement()` → triggers VRF |
| `ACTION_ROLLOVER` | 4 | Calls `votingContract.rolloverRound()` |

`manualExecute(3)` = `ACTION_SETTLE`. **This is what Jim called on May 15 to settle Round 1.**

---

## When to Use Each Action

| Situation | Action | Call |
|-----------|--------|------|
| Round ended with votes, VRF not pending | **3 (SETTLE)** | `manualExecute(3)` |
| Round ended with 0 votes, want to close it without VRF | **4 (ROLLOVER)** | `manualExecute(4)` |
| New round needs to start after settlement | **1 (START_ROUND)** | `manualExecute(1)` |

**Note on SETTLE vs ROLLOVER:** With 0 votes, calling SETTLE still works (VRF returns → no prizes → round closed). ROLLOVER skips VRF entirely and is faster/cheaper. For future 0-vote rounds, prefer ROLLOVER.

---

## Method 1: BaseScan Write-Contract (Manual)

1. Go to: `https://basescan.org/address/0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48#writeContract`
2. Click **Connect to Web3** → connect Bank wallet (`0xb1e991bf617459b58964eef7756b350e675c53b5`)
3. Find function `manualExecute`
4. Input:
   - `action (uint256)`: `3` (to settle) OR `4` (to rollover) OR `1` (to start next round)
5. Click **Write** → confirm in wallet
6. Wait for tx confirmation (~2–5 seconds on Base)

**Gas estimate:** ~200,000–400,000 gas. At 0.01 gwei base fee: ~$0.10–0.20. Bank wallet needs >0.001 ETH.

---

## Method 2: Standalone Script (env-keyed, no hardcoded secrets)

```bash
#!/usr/bin/env node
// Usage: ACTION=3 DEPLOYER_PRIVATE_KEY=0x... node manual-execute.js
// Actions: 1=startRound 2=snapshot 3=settle 4=rollover
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const KEEPER2 = '0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48'
const ABI = parseAbi(['function manualExecute(uint256 action)'])
const ACTION = BigInt(process.env.ACTION || '3')
const pk = process.env.DEPLOYER_PRIVATE_KEY
if (!pk) { console.error('DEPLOYER_PRIVATE_KEY not set'); process.exit(1) }

const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`)
const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') })

console.log(`Calling manualExecute(${ACTION}) on TTSKeeper2...`)
const hash = await walletClient.writeContract({
  address: KEEPER2, abi: ABI, functionName: 'manualExecute', args: [ACTION]
})
console.log(`TX: ${hash}`)
const receipt = await publicClient.waitForTransactionReceipt({ hash })
console.log(`Status: ${receipt.status}  Block: ${receipt.blockNumber}`)
```

Save as `scripts/manual-execute.js`. Run with:
```bash
ACTION=1 DEPLOYER_PRIVATE_KEY=0x... node --input-type=module < scripts/manual-execute.js
```

---

## Post-Settlement Verification Checklist

After calling any action, verify on-chain:

```bash
# Check round state
cast call 0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6 \
  "getRound(uint256)(uint256,uint256,uint256,uint256,bool,bool,uint256)" \
  1 --rpc-url https://mainnet.base.org

# Expected after SETTLE/ROLLOVER: settled=true, vrfPending=false
# After START_ROUND: new round exists with startTime > 0

# Check currentRoundId
cast call 0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6 \
  "currentRoundId()(uint256)" --rpc-url https://mainnet.base.org
```

**Expected post-state for ACTION_SETTLE (Round 1):**
- `settled = true` ✅ (confirmed)
- `vrfPending = false` ✅ (confirmed)
- If 0 votes: no RoundSettled event emitted (VRF callback exits early — this is correct behavior, not an error)
- If votes existed: RoundSettled event emitted with winner, pool, recipient addresses

**Expected post-state for ACTION_START_ROUND:**
- `currentRoundId` increments by 1
- New round has `startTime = block.timestamp`, `endTime = startTime + 604740` (7 days - 60s)

---

## Next Immediate Action (V3c deployment path)

Round 1 is settled on V3b. Round 2 has NOT started. The deployment sequence is:

1. Deploy `contracts/TTSVotingV3c.sol` + `contracts/TTSKeeper2V2.sol` (full runbook: `outputs/v3c_v2_deployment_runbook.md`)
2. After V3c deploy: start Round 1 on V3c via `manualExecute(1)` on Keeper2V2 (or wait for Chainlink automation if upkeep is funded)
3. Do NOT start Round 2 on V3b — all future rounds go on V3c

---

*Document last updated: 2026-05-20*
