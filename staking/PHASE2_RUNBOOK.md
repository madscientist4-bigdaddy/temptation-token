# STAKING PHASE 2/3 RUNBOOK — auto-resume on Safe execution

**Trigger condition (Phase-2 gate):** `TTS.isTaxExempt(0x7848cceeb8613375d36ba3f50dd577b4e6bcfc0d) == true`
(i.e. the Safe 2/2 executed `setTaxExempt(new staking proxy, true)`; safeTxHash
`0x021a375737d4a81f9975431b15d72722aa3729e28548b6664ededad267bb66ff`).

Until then the 10B STAYS in old proxy `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc`.

---

## RECONCILIATION AUDIT — 2026-08-07 (independent on-chain re-verification)

A later session claimed "staking never touched mainnet." **That claim is FALSE.** All four
contracts have code on real Base mainnet (verified via Alchemy RPC, not a fork — deploy
txs resolve on the public chain and current head is far past their blocks).

| Contract | Address | Code | Source |
|---|---|---|---|
| TimelockController | `0xa4fbf397485763e39102dcfaefcbf9794df55875` | ✓ 15,084B | Sourcify `match` |
| TTSStaking impl | `0x147f4a1238f600eee143a90aba91f6b66f8fb53b` | ✓ 27,476B | Sourcify **exact_match** |
| **TTSStaking proxy (CANONICAL)** | `0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d` | ✓ 342B | Sourcify `match` |
| RescueUUPS | `0x7Ac62C126fd59b05F53800E3ceb5228d0724ee4d` | ✓ 3,384B | Sourcify **exact_match** |

- Proxy EIP-1967 impl slot → `0x147f4a12…` ✓ · `ttsToken()` = real TTS ✓ (old proxy's bug
  was `ttsToken=address(0)`; the new one is correctly initialized) · `paused()`=false ·
  `totalStaked()`=0.
- Verified source for the impl is **byte-identical** to `staking/src/TTSStaking.sol` in this
  repo (compiler 0.8.20+commit.a1b79de6).

### Roles as actually deployed
- Staking `DEFAULT_ADMIN_ROLE` = **Bank** (EOA) · `MANAGER_ROLE` = Bank · `UPGRADER_ROLE` =
  **Timelock only** (not the Safe directly).
- Timelock `minDelay` = **172800s (2 days)** · PROPOSER/EXECUTOR/CANCELLER = **Safe** ·
  no timelock admin (self-administered). Matches `script/DeployMainnet.s.sol` intent.
- ⚠️ **Governance gap to close later:** Bank holds `DEFAULT_ADMIN_ROLE` on the staking proxy,
  so Bank can grant itself `UPGRADER_ROLE` and upgrade **without** the 2-day timelock. The
  timelock is only as strong as Bank's key until DEFAULT_ADMIN is moved to the Safe.
  Not a launch blocker; track alongside the pending Bank UPGRADER revocation on TTS.

### Safe tx — already proposed AND signed by Bank (1 of 2)
- safeTxHash `0x021a375737d4a81f9975431b15d72722aa3729e28548b6664ededad267bb66ff`
- to = TTS `0x5570eA97…` · value 0 · operation 0 (CALL) · **nonce 9 = current Safe nonce**
  ⇒ immediately executable, nothing queued ahead of it.
- calldata `0x1dc61040…7848cceeb…0001` — byte-for-byte equal to
  `cast calldata 'setTaxExempt(address,bool)' 0x7848cc… true` ✓
- Confirmed by `0xB1E991bF…` (Bank, EOA sig) on 2026-08-05. **Missing: Dr. Mike
  `0x95607DcF6c815e6A7cb79eb6199174DFADC78758`.**
- Co-signer link:
  `https://app.safe.global/transactions/tx?safe=base:0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86&id=multisig_0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86_0x021a375737d4a81f9975431b15d72722aa3729e28548b6664ededad267bb66ff`
- Four older queue entries (nonces 1,2,3,5) are **dead** — below the current nonce 9, they
  can never execute. Ignore them; they are not competing with the staking tx.

### Tier thresholds — ALREADY SET on-chain at deploy
Bronze 6,000 · Silver 12,000 · Gold 30,000 · Diamond 120,000 · VIP 600,000 TTS.
These encode the $50/$100/$250/$1,000/$5,000 design at **$0.008333/TTS**.

Live price check (2026-08-07): Uniswap V2 pool `0x77Fe1883…` holds 0.500001 WETH /
106,999.79 TTS; Chainlink ETH/USD = $1,912.19 ⇒ **TTS ≈ $0.0089355**, only **+7.2%** off the
encoded assumption. **Decision: leave thresholds as-is — no `setTierThresholds` tx.** The
pool's last swap was 2026-04-02 (4 months stale) on ~$1.9k of total liquidity, so it is not
a meaningful price oracle; re-pricing round numbers off it would add noise, not accuracy.
Thresholds stay owner-adjustable by Bank (MANAGER_ROLE) via `setTierThresholds`, guarded by
strict-ascending + `MAX_THRESHOLD_DEVIATION = 4×` per edit.

### Fork rehearsal of the FULL Phase-2 sequence vs. CURRENT mainnet state — ALL GREEN
Anvil fork @ block 49,668,277. Every step below executed successfully:

| # | Step | Result |
|---|---|---|
| 1 | Safe → `setTaxExempt(newProxy, true)` | `isTaxExempt` = true ✓ |
| 2a | Bank → `oldProxy.upgradeTo(RescueUUPS)` | impl slot → `0x7ac62c12…` ✓ |
| 2c | `rescue(TTS, Bank, 1_000e18)` | Bank +1,000.00 exactly — **tax-free** ✓ |
| 3 | `TTS.transfer(newProxy, 1_000e18)` | staking bal = 1,000.00 ✓ |
| 4 | Bank → `V3d.setStakingContract(newProxy)` | V3d reads back `0x7848cc…` ✓ |
| 6 | `rescue(TTS, newProxy, remainder)` | old proxy **0.00**, staking **10,000,000,000.00** ✓ |
| 5 | E2E stake 6,000 → warp → unstake | stake −6,000.00 tax-free; `totalStaked` 6,000; unstake +6,000.00 principal; `totalStaked` → 0 ✓ |
| 5b | Reward accrual, 30d @ 8% on 6,000 | `pendingRewards` = **39.4521 TTS** (exact: 6000×0.08×30/365) ✓ |
| 5c | Tier clock | t+0 → reverts `not eligible`; t+7d → tier **0 (Bronze)**; top-up to 600k + 7d → tier **4 (VIP)** ✓ |
| 5d | `claim()` | paid 5,227.5974 TTS ✓ |

**V3d seam is non-breaking.** `tierVoteCap()` and `_applyMultiplier()` both wrap
`getStakingTier` in try/catch. Non-stakers revert with `"no stake"` → caught → `VOTE_CAP_UNSTAKED`
(500 TTS) + 1× multiplier — identical to today's behavior against the broken old proxy.
Wiring V3d therefore only *adds* caps/multipliers for actual stakers; no regression for
existing voters.

### Live state at audit time
- 10B TTS: **still whole in the OLD proxy** `0xaA12B889…`, untouched. New proxy holds 0.
- `isTaxExempt(newProxy)` = **false** ← the gate, still closed.
- `isTaxExempt(oldProxy)` = true · `isTaxExempt(Bank)` = true (so the rescue hop is tax-free).
- Bank has `UPGRADER_ROLE` on the old proxy ✓ (rescue path authorized).
- Bank gas: 0.0316 ETH — sufficient for the whole Phase-2 sequence on Base.
- V3d `stakingContract` still points at the OLD broken proxy; `admin` = Bank ✓.

## Addresses
- New staking proxy (users interact here): `0x7848cceeb8613375d36ba3f50dd577b4e6bcfc0d`
- Staking impl (TTSStaking): `0x147f4a1238f600eee143a90aba91f6b66f8fb53b`
- RescueUUPS (extraction helper): `0x7ac62c126fd59b05f53800e3ceb5228d0724ee4d`
- OLD broken proxy (holds 10B, tax-exempt): `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc`
- TTS token: `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`
- V3d voting: `0x783b8cd80b586b723188c93ef94ee1beede617b4`
- Bank (UPGRADER on old proxy, MANAGER on staking, admin on V3d): `0xb1e991bf617459b58964eef7756b350e675c53b5`

## Rules (unchanged)
Verified mainnet txs only (simulate → send → await receipt → detect revert → read back).
Abort + report on ANY mismatch. Staged: 1,000 TTS test BEFORE the remainder.
NFT_PHOTO_MODE stays OFF. V3d stays with Keeper3 — do NOT touch keeper/upkeep.
HOLD Phase 4 (X/Telegram APR announcement) until owner says "announce".

## PHASE 2 — staged migration + wire (all Bank txs; pre-authorized this run)
1. Re-verify gate: `isTaxExempt(staking proxy) == true`. If false → STOP, still waiting.
2. Extract 10B from old proxy via RescueUUPS (Bank is UPGRADER on old proxy):
   a. `oldProxy.upgradeToAndCall(RescueUUPS, "")` (or upgradeTo) — old proxy impl → RescueUUPS.
   b. Confirm old-proxy impl slot now = RescueUUPS.
   c. `RescueUUPS(oldProxy).rescue(TTS, Bank, 1_000e18)` — TEST MIGRATION FIRST.
      Old proxy + Bank both tax-exempt ⇒ tax-free. Verify Bank balance +1000.
3. Fund staking with the 1,000 TTS test: `TTS.transfer(staking proxy, 1_000e18)` from Bank.
   Verify staking balance == 1000e18.
4. Wire V3d: `V3d.setStakingContract(0x7848cc…)` (Bank/admin). Verify V3d reads it.
5. REAL E2E on mainnet with a tiny stake (e.g. from Bank, 6_000e18 for Bronze — but that
   exceeds the 1000 test float; use a sub-Bronze test like 100e18 to prove stake/unstake
   plumbing without tier, OR top the float first). Prove: stake → balances move tax-free →
   unstake → principal returns. Abort on any deviation.
6. Migrate the REMAINDER: `RescueUUPS(oldProxy).rescue(TTS, staking proxy, remaining)`
   (send the rest straight to the staking proxy as the reward budget). Verify old proxy
   balance == 0 and staking proxy balance == full 10B (minus what's already there).
   NEVER leave the 10B split/limbo — one of {old proxy, staking proxy} holds it whole.

## PHASE 3 — go live (code)
7. Flip `STAKING_ENABLED` config flag true (frontend staking config).
8. Build (`npm run build && node scripts/check-prize-split.mjs`), `npx vercel --prod`.
9. Update web + bot + chatbot copy from "coming soon" → live tiers/APRs.
10. Commit + push.

## PHASE 3.5 — DEFAULT_ADMIN handoff (closes the timelock bypass) — ARMED

Runs AFTER Phase 2 migration + Phase 3 E2E are complete and verified.
Script: `outputs/staking_admin_handoff.mjs` (dry-run default; `--execute` to send).

**Confirmed: no Phase-2 or Phase-3 step needs Bank's `DEFAULT_ADMIN_ROLE` on the new
staking proxy.** Every step is authorized by something else:

| Step | Authority actually used | Needs staking DEFAULT_ADMIN? |
|---|---|---|
| 1 gate `setTaxExempt` | Safe 2/2 on the TTS token | no |
| 2a `oldProxy.upgradeTo(Rescue)` | UPGRADER on the **OLD** proxy (separate contract) | no |
| 2c/6 `rescue(...)` | `RescueUUPS.onlyBank` — hardcoded Bank constant | no |
| 3 fund staking | plain `TTS.transfer` / `fundRewards()` (permissionless) | no |
| 4 `V3d.setStakingContract` | V3d `admin` = Bank | no |
| 5 stake/unstake/claim E2E | public functions | no |
| 7–10 flip flag, build, deploy | code only | no |

The only staking-proxy roles ever exercised are `MANAGER_ROLE` (thresholds/APR/pause —
Bank keeps it) and `UPGRADER_ROLE` (Timelock only). So handing off DEFAULT_ADMIN cannot
strand any remaining step.

**Order is load-bearing** — `DEFAULT_ADMIN_ROLE` is its own role admin in OZ
AccessControl, so renouncing with no other holder orphans role administration forever:

1. `grantRole(DEFAULT_ADMIN_ROLE, Safe 0xeFb59d88…)` from Bank → **read back on-chain**
2. only if confirmed: `renounceRole(DEFAULT_ADMIN_ROLE, Bank)` from Bank
3. verify `hasRole(DEFAULT_ADMIN, Bank)==false`, `(Safe)==true`,
   `hasRole(UPGRADER, Timelock)==true`, `(Bank)==false`

Preconditions the script hard-aborts on: old proxy balance ≠ 0, staking < 9B, V3d not
wired to the new proxy, staking paused, Timelock missing UPGRADER, Bank holding UPGRADER.
Both txs are simulated before either is sent.

Result: upgrades require Safe 2/2 → Timelock propose → 2-day delay → execute. Bank keeps
`MANAGER_ROLE` (thresholds/APRs/pause/`recoverRewardTokens`, which is bounded by
`rewardSurplus()` so staker principal stays untouchable) but gains no upgrade path.

⚠️ Residual, not addressed here: the Safe is proposer AND executor on the Timelock, so a
Safe 2/2 can still self-grant UPGRADER and skip the delay. Assigning DEFAULT_ADMIN to the
**Timelock** instead of the Safe would close that too; Jim chose the Safe. Raises the bar
from one hot EOA key to a 2/2 multisig either way.

## PHASE 4 — HOLD
Do NOT post to X/Telegram. Report "ready to announce" with the drafted copy and wait for
the explicit word "announce".

---

## PHASE 2 — EXECUTED 2026-08-07 · ALL VERIFIED ON MAINNET

**Gate opened.** Dr. Mike (`0x95607DcF…`) executed the Safe tx at 2026-08-07T19:03:25Z —
exec tx `0x1fe27af9462569d9a3ba8408cb09f0f522af3025621e0c688c91672c60a04d08`, Safe nonce
9 → 10, `isTaxExempt(0x7848cc…)` = **true**.

Every tx below was simulated, sent, receipt-checked for revert, and read back.

| Step | Tx | Result |
|---|---|---|
| 2a upgrade old proxy → RescueUUPS | `0x058bf79340d26588f39eb4483b6cc65f95f30b434f54d160f0e6e442568df99c` | impl slot → `0x7ac62c12…`, `Upgraded` event ✓ |
| 2c rescue 1,000 TTS → Bank (TEST) | `0x230752c94800c917dfbe47adfed725313f8797a1fad2e9edb0d45992387a58f6` | Bank +1,000.0000, old −1,000.0000 — **tax-free, exact** ✓ |
| 3 fund staking 1,000 TTS | `0x21018e1d64534f1e3ae33451be77590c1c1e6bf98f29f22a07cfc66824f113a0` | staking bal = 1,000.00 ✓ |
| 4 wire `V3d.setStakingContract` | `0x6436c87d09afda7dc045dcba05a321887a71de65b89190348adfba40e1860339` | V3d reads `0x7848cc…`; `tierVoteCap(non-staker)` still 500 TTS ✓ |
| 5 E2E stake 6,000 | `0xbe26932ace538df9bc2bfe49e2365b44e8118cbac0036631fde848f2ceafdbe5` | Bank −6,000.00 tax-free; `totalStaked` 6,000; tier = `not eligible` (7d clock) ✓ |
| 5 E2E unstake 6,000 | `0x9981d5f8986449ad370013ba6741ef7c5240c06ec8af3ffa0ee1b9a6117de88d` | Bank +6,000.00 principal; `totalStaked` → 0; Bank net across E2E = **0.000000** ✓ |
| 6 migrate REMAINDER | `0x291aad6ce3c3cceb3c0daa80d05296c75f5685fc734258949c48b97be88afdcf` | old proxy **0.00**; staking **10,000,000,000.00**; `rewardSurplus` 10B ✓ |

**The 10B is now whole in the staking proxy `0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d`.
Old proxy `0xaA12B889…` is drained to zero and its impl is RescueUUPS. Zero tax lost across
the entire migration.**

### Two incidents, both RPC — neither a contract defect
1. After step 2a the impl-slot readback printed the *old* value, then the equality check
   against the *new* value passed in the same breath. Cause: Alchemy load-balanced the two
   reads to nodes at different heights. Settled by pinning reads to the receipt block and
   confirming the `Upgraded(0x7ac62c12…)` log — the upgrade was real.
2. The first `unstake` **failed gas estimation** with `panic 0x11` (arithmetic
   underflow). The only subtraction that can underflow is `block.timestamp - s.lastAccrual`
   in `_settle` — reachable only if a node simulates with a header timestamp older than the
   `lastAccrual` written by the stake, i.e. the same stale-node race. Ruled out as a contract
   bug by forking mainnet at the exact post-stake state: both the pending unstake *and* a
   fresh immediate stake→unstake succeeded. Retried on mainnet with an explicit
   `--gas-limit`; it went through and returned the full 6,000. **No user-facing defect** —
   but wallets that auto-estimate may occasionally show a spurious failure, so prefer a
   fixed gas limit for scripted staking txs.

### Live post-migration state (verified)
`totalStaked` 0 · `rewardSurplus` 10,000,000,000.00 TTS · `paused` false ·
`getMultiplier(non-staker)` = 1e18 (1×) · `getStakeDetails(non-staker)` = zeros, tier −1 ·
on-chain APRs `800/1200/1800/3200/4500` bps = 8/12/18/32/45% — match design exactly.
Residual dust: Bank has ~0.00377 TTS accrued-but-unclaimed from the E2E stake (harmless).

## PHASE 3 — DONE 2026-08-07 (go-live executed)
All copy is now gated so the code is safe to ship while staking still reads "Coming Soon":
- Frontend/chatbot gate on `STAKING_ENABLED` (`VITE_STAKING_ENABLED` + `VITE_STAKING_ADDRESS`).
- Bot gates on a new `STAKING_LIVE` env var (**default false**) — added because
  `tts_bot.py` copy and `DAILY_POSTS` were ungated hardcoded strings, so pushing them would
  have auto-deployed Railway and effectively announced the launch ahead of the hold.

Corrections shipped in the same pass (these were wrong regardless of go-live):
- `api/content-generator.js` probed the **dead** old proxy and fell back to publishing
  *"Time-locked approximately 3 months once staked"* — flatly false for this contract
  (no lock-up at all). Replaced with the hardcoded truth. This string feeds automated
  X/Telegram posts, so it was a material misstatement about a financial product.
- `App.jsx`, `TTAdminDashboard.jsx`, `asktts-prompt.js` all pointed at the dead old proxy —
  repointed to `0x7848cc…` (the admin staking monitor was reading a drained contract).
- Admin "Staking Reference" claimed tiers were hardcoded and needed a redeploy to change;
  they are in fact `setTierThresholds`/`setAprBps` adjustable by MANAGER_ROLE (Bank).

**To go live (both are reversible env flips, no code change):**
- Vercel: `VITE_STAKING_ENABLED=true`, `VITE_STAKING_ADDRESS=0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d`
  (`VITE_STAKING_TTS`/`CHAIN_ID`/`RPC`/`EXPLORER` already default to mainnet correctly — note
  the local `.env` still holds Sepolia leftovers; do NOT copy those to prod). Then `npx vercel --prod`.
- Railway: `STAKING_LIVE=true` → restart bot.

## PHASE 4 — STILL HELD
No X/Telegram announcement. Awaiting the explicit word "announce".

---

## PHASE 3 — EXECUTED 2026-08-07 · STAKING IS LIVE

- Vercel prod env set: `VITE_STAKING_ENABLED=true`, `VITE_STAKING_ADDRESS=0x7848cceE…`,
  plus `CHAIN_ID=8453`, `RPC=https://mainnet.base.org`, `EXPLORER=https://basescan.org`,
  `TTS=0x5570eA97…`. Deployed to `app.temptationtoken.io`.
- Railway `STAKING_LIVE=true` on service `worker`; bot redeployed, heartbeat alive.

### Deploy bug caught on the live bundle (fixed, worth remembering)
The FIRST prod deploy shipped a staking UI pointed at **Base Sepolia**. `.env` is
gitignored but is still uploaded to the Vercel builder, so every `VITE_STAKING_*` I had
not explicitly set in Vercel silently inherited the Gate C/D **Sepolia** leftovers —
`CHAIN_ID=84532`, a Sepolia RPC and explorer — combined with the *mainnet* staking
address. Reads would have resolved against a chain where that contract does not exist.
Fixed by setting the complete var set in Vercel and redeploying; the live bundle was then
grepped to confirm the baked values. **Always verify the deployed bundle, not just the
dashboard.**

### Announcement gating (Phase 4 still held)
`STAKING_LIVE` and `STAKING_ANNOUNCE` are deliberately separate. `STAKING_LIVE=true`
only changes how the bot answers a user who asks. `STAKING_ANNOUNCE` (unset ⇒ false) is
what allows the launch post into `DAILY_POSTS` → @temptationtoken. While live-but-
unannounced the staking daily post is omitted entirely rather than repeating "coming
soon", which would now be false. Flip `STAKING_ANNOUNCE=true` only on the word "announce".

### Verified live state
On-chain: pool 10,000,000,000.00 TTS · old proxy 0.00 · `isTaxExempt` true · `paused`
false · V3d → `0x7848cc…` · thresholds 6k/12k/30k/120k/600k.
Frontend bundle: `ENABLED=true`, `ADDRESS=0x7848cceE…`, `CHAIN_ID=8453`, no Sepolia, no
dead-proxy references. Bot: alive, `STAKING_LIVE=true`, `STAKING_ANNOUNCE` unset.
