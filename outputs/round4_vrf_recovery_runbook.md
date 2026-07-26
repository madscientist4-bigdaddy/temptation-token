# Round 4 VRF-Stall Recovery — GATED RUNBOOK (review only, DO NOT EXECUTE)

**Status:** prepared for Jim's review 2026-07-26. **No mainnet tx has been sent.**
Every step below is a Bank-wallet transaction and requires explicit go-ahead.

---

## Confirmed on-chain state (read-only, 2026-07-26 14:23 UTC)

| Fact | Value | OK for recovery? |
|---|---|---|
| `currentRoundId` | **4** | ✅ `settleRound()` (no-arg) will target round 4 |
| Round 4 `settled` | `false` | ✅ not yet settled |
| Round 4 `vrfPending` | **`true`** | ✅ genuinely stalled (6+ days) |
| Round 4 `endTime` | 2026-07-20 04:59 UTC | fixed anchor |
| `endTime + 1 day` | 2026-07-21 04:59 UTC | ✅ already passed → reset allowed **now** |
| Round 4 `profileCount` | 18 | ✅ `>0` (settlement precondition) |
| Round 4 `totalRawVotes` / `tickets` | 10 / 10 | ✅ non-empty → a winner WILL be drawn + paid |
| V3d `owner` | Keeper3 `0x363Ce4…442C` | expected — must flip to Bank then back |
| V3d `admin` | Bank `0xb1e991bf…` | ✅ Bank can call `adminTransferOwnership` |
| Keeper3 `owner` | Bank `0xb1e991bf…` | (unchanged by this runbook) |
| VRF sub `5822…3722` balance | **7.998 LINK** | ✅ ample; not the stall cause |
| V3d is a sub consumer | `true` | ✅ fresh request can be served |
| `CALLBACK_GAS_LIMIT` | 2,500,000 | ✅ generous; callback-gas revert unlikely |

**Re-verify ALL of the above immediately before executing** — state can change (a
late VRF fulfillment could self-resolve it; a rollover could move `currentRoundId`).

### Definitive VRF evidence (why this is "stalled", not "reverted")
- Round 4's request: `VRFRequested(4, 0x65dbc59fa73a157e3c0e0d90bf825b2a49aa9fb88ce81382077562230d1e4d32)`
  at block **48867100**, tx `0x89dad30c759b6822d9ca8b6cb3a866c498a4e7866a70bf8aa34ac2ebc8927d07`.
- On the coordinator `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634`:
  `s_requestCommitments(0x65dbc59f…)` = **`0xa2666cc6…` (NON-ZERO)** and
  `pendingRequestExists(sub)` = **`true`**.
- A non-zero commitment means the request is **still queued and unfulfilled** — the DON
  never delivered the callback. This is NOT a fulfilled-but-reverted callback (that would
  leave the commitment cleared). **Implication:** a small LINK top-up *may auto-resolve*
  round 4 with **zero Bank txs**, and a fresh re-request (Steps 2–3) is safe.
- **Pre-flight at execution:** if `s_requestCommitments(0x65dbc59f…)` has become `0x0`,
  the old request just fulfilled — STOP and re-check `getRound(4).settled` before acting.

---

## ⚠️ Correction to the stated plan

The plan says "adminTransferOwnership **of Keeper3**" and "return **Keeper3
ownership** to Bank." What actually moves is **V3d's ownership**, not Keeper3's:

- V3d's owner is currently Keeper3. `adminResetSettlement` and `settleRound` are
  `onlyOwner` on V3d, so **Bank must temporarily become V3d's owner**.
- Bank is V3d's **admin**, and `adminTransferOwnership(address)` is `onlyAdmin` — so
  Bank can reassign V3d's owner to itself (Step 1) and back to Keeper3 (Step 4).
- **Keeper3's own owner (Bank) never changes.** Step 4 = "return **V3d** ownership to
  **Keeper3**," restoring automation.

---

## Contracts / wallets referenced

- **V3d (TTSVotingV3d):** `0x783b8cd80b586b723188c93ef94ee1beede617b4`
- **Keeper3:** `0x363ce4960e3b459f5892587a37ae1ff2ed04442c`
- **Bank (signer for every step; is V3d admin):** `0xb1e991bf617459b58964eef7756b350e675c53b5`
- Bank needs a little Base ETH for gas (4 small txs) — trivial, just confirm it's funded.

---

## STEP 1 — Bank takes V3d ownership

| | |
|---|---|
| **Contract** | V3d `0x783b8cd8…e617b4` |
| **Function** | `adminTransferOwnership(address to)`  *(access: `onlyAdmin`)* |
| **Arg** | `to = 0xb1e991bf617459b58964eef7756b350e675c53b5` (Bank) |
| **Signer** | **Bank** (admin) |
| **Confirms success** | `owner()` returns Bank; `OwnershipTransferred(Keeper3 → Bank)` emitted |
| **Side effect** | While Bank owns V3d, Keeper3's automated `settleRound/startRound` calls will revert (`onlyOwner`). Expected & harmless for the short window; Round 5 can't start until Round 4 settles anyway. |

## STEP 2 — Clear the stalled VRF flag

| | |
|---|---|
| **Contract** | V3d `0x783b8cd8…e617b4` |
| **Function** | `adminResetSettlement(uint256 roundId)`  *(access: `onlyOwner`)* |
| **Arg** | `roundId = 4` |
| **Signer** | **Bank** (now owner from Step 1) |
| **Preconditions** | `vrfPending==true` ✅ · `block.timestamp > endTime + 1 day` ✅ (both already true) |
| **Effect** | Sets Round 4 `vrfPending = false` (does NOT settle) |
| **Confirms success** | `getRound(4)` → `vrfPending=false`, `settled=false` |

## STEP 3 — Re-request settlement (async)

| | |
|---|---|
| **Contract** | V3d `0x783b8cd8…e617b4` |
| **Function** | `settleRound()`  — **NO ARGUMENTS** *(access: `onlyOwner`)* |
| **Arg** | none — it acts on `currentRoundId`, which must be **4** (re-verify!) |
| **Signer** | **Bank** (owner) |
| **Preconditions** (checked internally) | `startTime>0` ✅ · `!settled` ✅ · `!vrfPending` ✅ (cleared in Step 2) · `block.timestamp>=endTime` ✅ · `profileIds.length>0` ✅ (18) |
| **Immediate effect** | Sets `vrfPending=true`, emits `VRFRequested(4, newRequestId)`, sends a new randomness request to the coordinator |
| **This tx does NOT settle** | Settlement happens later when the Chainlink DON calls back `rawFulfillRandomWords` → `fulfillRandomWords`. **Wait for it.** |
| **Confirms full success** | `RoundSettled(4, winnerProfileId, winnerWallet, pool)` emitted; `getRound(4).settled==true`; **4 payout transfers** (35% winner / 35% top voter / 10% Polaris / 20% Marketing-house — no club on the winning profile); **NFT `totalSupply` 0→3** (winner, top voter, house). |

**If the fresh request stalls again** (vrfPending stuck > a few hours): **just repeat
Step 2 then Step 3.** The reset guard is relative to `endTime` (fixed, already
passed), so repeated reset→re-request is allowed immediately — **no 1-day wait between
attempts**, and no need to redo Step 1 (Bank is still owner).

## STEP 4 — Return V3d ownership to Keeper3 (restore automation)

| | |
|---|---|
| **Contract** | V3d `0x783b8cd8…e617b4` |
| **Function** | `adminTransferOwnership(address to)`  *(access: `onlyAdmin`; Bank is still admin regardless of owner)* |
| **Arg** | `to = 0x363ce4960e3b459f5892587a37ae1ff2ed04442c` (Keeper3) |
| **Signer** | **Bank** (admin) |
| **Confirms success** | `owner()` returns Keeper3; `OwnershipTransferred(Bank → Keeper3)`; Chainlink upkeep resumes → Round 5 starts at the next upkeep tick |

**Recommended timing:** do **not** run Step 4 until Step 3 has produced a confirmed
`RoundSettled(4)`. Keeping Bank as owner until then means that if the fresh request
also stalls, you can immediately re-run Step 2+3 without redoing Step 1. Once settled,
Step 4 hands automation back. (Ownership is not required for the VRF callback itself —
the coordinator calls `rawFulfillRandomWords`, which is not `onlyOwner` — so returning
ownership earlier would not block settlement; the recommendation is purely operational
convenience for retry.)

---

## Safety properties worth knowing before you sign

- **No double-settlement risk.** If the ORIGINAL orphaned request ever fulfills after
  Step 2/3, `fulfillRandomWords` begins with `require(r.vrfPending)` and sets
  `settled=true` on the first fulfillment — so whichever of {old, new} request lands
  first settles round 4, and the other **reverts harmlessly**. No double payout, no
  double mint.
- **Funds are never at risk in these steps.** None of Steps 1–4 move TTS. Payouts are
  moved only by the VRF callback, from the votes already escrowed in V3d (10 TTS pool).
- **`adminTransferOwnership` can't be front-run into a bad state** — only Bank (admin)
  can call it, both directions.

---

## VRF sub top-up — is it advisable first?

**Short answer: not required, and unlikely to be the fix — but a small top-up is cheap,
harmless insurance. Do the *diagnosis* below rather than a blind top-up.**

Why top-up is almost certainly **not** the cause or the cure here:
- Sub holds **~8 LINK**; a single Base VRF fulfillment costs a small fraction of a LINK.
  8 LINK covers many fulfillments.
- `CALLBACK_GAS_LIMIT` is **2.5M** — the callback (4 transfers + 3 gas-capped 200k
  `try/catch` mints + burn) fits comfortably, so the stall is unlikely to be a
  callback-gas revert.
- V3d is confirmed still an **active consumer** on the sub.

What to actually do first (5-minute read-only check, higher value than a blind top-up):
1. On BaseScan, open VRF sub `5822…3722` (or the VRF coordinator
   `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634`) and find Round 4's **pending request**
   (the `VRFRequested(4, requestId)` log on V3d around 2026-07-20). Check its status:
   - **Pending / awaiting fulfillment** → the DON may fulfill it once conditions clear;
     a top-up *could even auto-resolve it* (making Steps 1–4 unnecessary). Watch briefly
     before intervening.
   - **Fulfilled-but-reverted** → the re-request could hit the *same* revert. Investigate
     the winner wallet / mint path before Step 3 (low risk given the 2.5M limit + `try/catch`
     mints, but confirm).
2. **Optional top-up (if you want zero funding risk):** add ~2–5 LINK to sub
   `5822…3722` before Step 3. This is a normal `LINK.transferAndCall` / VRF UI top-up
   from any funded wallet — **not** a Bank-privileged action and not part of the gated
   sequence. Harmless either way.

**Recommendation:** skip a blind top-up; do the request-status check in (1). If it's
merely pending, a small top-up is the *least-invasive* first move and may settle round 4
with zero Bank txs. If it's stuck for a non-funding reason, proceed with Steps 1–4.

---

## Abort / rollback

- After **Step 1** only: to abort, run Step 4 (return ownership to Keeper3). Nothing
  else changed.
- After **Step 2** only: `vrfPending` is cleared but round unsettled. Either proceed to
  Step 3, or run Step 4 to hand back — Keeper3's upkeep will itself attempt
  `settleRound()` on its schedule since preconditions are met.
- After **Step 3**: settlement is in flight; do not "undo." If it stalls, repeat Step 2+3.

## One-line pre-flight re-check (read-only) to run at execution time
`currentRoundId==4` · `getRound(4)`: `vrfPending==true, settled==false` ·
`owner()==Keeper3` · `admin()==Bank` · `now > endTime+1day` · sub balance > 0 & V3d is consumer.
