# TTS Vesting — Deployment Runbook

**Contract:** `contracts/TTSVestingWallet.sol`  
**Executor:** Jim (Bank wallet `0xb1e991bf617459b58964eef7756b350e675c53b5`)  
**Network:** Base mainnet (chainId 8453)  
**Status:** PENDING — placeholder addresses must be replaced before executing any step.

> ⚠ **DO NOT EXECUTE ANY STEP** until Step 0 is complete (real addresses set).  
> No Bank wallet transactions are included in this file — all steps require human action in Remix or MetaMask.

---

## Pre-flight Checklist

| Item | Status |
|------|--------|
| Beneficiary addresses obtained and verified | ❌ Placeholders still in place |
| TTS allocations decided (amount per beneficiary) | ❌ Not set |
| Bank wallet ETH sufficient for 5 deploy txs + funding | ⚠ Check — need ~0.001 ETH per tx |
| Bank wallet TTS sufficient for total allocation | ⚠ Check — run `node scripts/deploy_vesting.js` |
| Gnosis co-signer available (for Step 4 tax-exempt) | ⚠ Confirm before starting |

---

## Compiler Settings (Remix IDE)

| Setting | Value |
|---------|-------|
| Compiler | `0.8.20` |
| Optimizer | **ON**, runs: `200` |
| via IR | **checked** |
| EVM version | `default` |
| MetaMask network | **Base Mainnet (chainId 8453)** |

---

## Step 0 — Replace Placeholder Addresses (prerequisite)

**No transaction. Human action required before all other steps.**

1. Edit `scripts/deploy_vesting.js`
2. Replace the 5 entries in `BENEFICIARIES` array with real wallet addresses
3. Set `ALLOCATIONS_TTS` for each beneficiary (in TTS tokens, 18 decimals)
4. Run `node scripts/deploy_vesting.js` to verify the output looks correct
5. Record the addresses in a secure location — they cannot be changed after deployment

**CRITICAL:** Confirm each beneficiary controls their private key. TTS sent to a lost wallet is permanently unrecoverable after the cliff.

---

## Step 1 — Compile TTSVestingWallet in Remix

**No transaction. Compiler action.**

1. Open Remix IDE → load `contracts/TTSVestingWallet.sol`
2. Set compiler settings (see table above)
3. Click **Compile TTSVestingWallet.sol**
4. Confirm: **0 errors, 0 warnings** ✅

---

## Step 2 — Deploy Instance 1 (Bank wallet signs)

**1 transaction. ~0.001 ETH gas.**

**Constructor args** (run `node scripts/deploy_vesting.js` for exact values):

| Arg | Value |
|-----|-------|
| `beneficiaryAddress` | `<BENEFICIARY_1_WALLET>` |
| `startTimestamp` | `<now + 31536000>` (computed by script) |
| `durationSeconds` | `94608000` (1095 days = 3 years) |

**In Remix:**
1. Deploy tab → Environment: **Injected Provider - MetaMask**
2. Confirm MetaMask is on **Base Mainnet** (chainId 8453)
3. Contract: **TTSVestingWallet**
4. Paste constructor args
5. Click **Deploy** → confirm in MetaMask
6. **Record deployed address:** `VESTING_1 = _____________`

**Verify immediately:** BaseScan → contract address → Read:
- `beneficiary()` → should return `<BENEFICIARY_1_WALLET>` ✅
- `start()` → should return cliff-end timestamp ✅
- `duration()` → should return `94608000` ✅

---

## Step 3 — Deploy Instances 2–5 (Bank wallet signs, 4 transactions)

**4 transactions, same constructor pattern as Step 2.**

Repeat Step 2 four times, changing only `beneficiaryAddress` each time.

| Instance | Constructor arg: beneficiaryAddress | Deployed Address |
|----------|-------------------------------------|-----------------|
| 2 | `<BENEFICIARY_2_WALLET>` | `VESTING_2 = ___________` |
| 3 | `<BENEFICIARY_3_WALLET>` | `VESTING_3 = ___________` |
| 4 | `<BENEFICIARY_4_WALLET>` | `VESTING_4 = ___________` |
| 5 | `<BENEFICIARY_5_WALLET>` | `VESTING_5 = ___________` |

**Note:** `startTimestamp` and `durationSeconds` are the same for all instances. Use the same values as Step 2.

---

## Step 4 — Tax-Exempt Batch (Gnosis Safe — 2/2 sign)

**1 multisig transaction. Recommended before funding.**

This adds all 5 VestingWallet contracts to the TTS token's tax-exempt list, eliminating the 1% transfer tax on funding and releases (~2% net saving per beneficiary over 4 years).

**How to execute:**
1. Go to `app.safe.global` → `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`
2. New Transaction → Transaction Builder
3. For each of the 5 VestingWallet addresses, add a call:
   - **To:** `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` (TTS token)
   - **Function:** `setTaxExempt(address account, bool exempt)`
   - **account:** `<VESTING_N_ADDRESS>`
   - **exempt:** `true`
4. Bundle all 5 into one batch transaction
5. Both signers approve → execute

**Verify after execution:**
```
TTS token → Read → isTaxExempt(VESTING_1) → true ✅
TTS token → Read → isTaxExempt(VESTING_2) → true ✅
... (all 5)
```

**If skipping this step:** beneficiaries will receive ~98% of their vested allocation (1% tax on funding, 1% tax on each release). Acceptable if tax-exempt batch is not feasible now — can be done retroactively before the cliff ends.

---

## Step 5 — Fund Each VestingWallet (Bank wallet signs, 5 transactions)

**5 transactions. Bank wallet sends TTS.**

Transfer the TTS allocation to each VestingWallet contract address.

| Transfer | To | Amount |
|----------|-----|--------|
| 1 | `<VESTING_1_ADDRESS>` | `<ALLOCATION_1>` TTS |
| 2 | `<VESTING_2_ADDRESS>` | `<ALLOCATION_2>` TTS |
| 3 | `<VESTING_3_ADDRESS>` | `<ALLOCATION_3>` TTS |
| 4 | `<VESTING_4_ADDRESS>` | `<ALLOCATION_4>` TTS |
| 5 | `<VESTING_5_ADDRESS>` | `<ALLOCATION_5>` TTS |

**How to execute each transfer:**

**Option A — BaseScan Write:**
1. BaseScan → TTS token: `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`
2. Contract → Write → Connect wallet (Bank wallet)
3. `transfer(address to, uint256 amount)`
   - `to`: `<VESTING_N_ADDRESS>`
   - `amount`: `<ALLOCATION_N_WEI>` (18-decimal integer, e.g. `1000000000000000000000000` = 1,000,000 TTS)
4. Confirm in MetaMask

**Option B — MetaMask Send:**
1. Send TTS token directly to `<VESTING_N_ADDRESS>` from MetaMask
2. TTS token address: `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`

**Verify after each transfer:**
- BaseScan → VestingWallet contract → Read → `vestedAmount(TTS_TOKEN, currentTimestamp)`
- Should reflect the funded amount (0 if before cliff end)
- `releasable(TTS_TOKEN)` → 0 (nothing claimable until cliff ends)

---

## Step 6 — Verify on BaseScan (5 contracts)

**No transaction. Verification action.**

For each VestingWallet contract:

1. BaseScan → `<VESTING_N_ADDRESS>` → **Verify and Publish**
2. Compiler: `0.8.20` | License: `MIT` | Optimization: `Yes (200)` | via IR: `Yes`
3. Source code: paste full contents of `contracts/TTSVestingWallet.sol`
4. Constructor args: ABI-encoded `(beneficiaryAddress, startTimestamp, durationSeconds)`

**Getting ABI-encoded constructor args:**
- Remix deploy dialog shows the constructor args at the bottom after deployment
- Or use `cast abi-encode "constructor(address,uint64,uint64)" <addr> <start> <duration>`

**Verification confirms:**
- Source is public and immutable
- No hidden backdoors
- Beneficiaries can independently verify their vesting schedule

---

## Step 7 — Sanity Check (no transaction)

Run the following reads on each VestingWallet after all steps complete:

| Check | Function | Expected |
|-------|----------|---------|
| Correct beneficiary | `beneficiary()` | Real wallet address ✅ |
| Cliff not yet hit | `releasable(TTS_TOKEN)` | `0` ✅ |
| Funding arrived | `vestedAmount(TTS_TOKEN, cliffEndTimestamp)` | `allocation × (0 / RELEASE_SECONDS) = 0` ✅ |
| Full vest amount | `vestedAmount(TTS_TOKEN, cliffEnd + RELEASE_SECONDS)` | Full allocation ✅ |
| Tax-exempt | TTS token → `isTaxExempt(vestingAddr)` | `true` ✅ |

---

## Post-Deployment Checklist

- [ ] All 5 addresses confirmed correct via `beneficiary()` read
- [ ] All 5 contracts funded and balances confirmed on BaseScan
- [ ] All 5 contracts tax-exempt (if batch executed)
- [ ] All 5 contracts verified on BaseScan (source published)
- [ ] Contract addresses recorded in CLAUDE.md
- [ ] Setup guide sent to each beneficiary (how to claim when cliff ends)

---

## Claiming Reference (for beneficiaries)

When the cliff ends and tokens are vesting, beneficiaries claim via:

1. **BaseScan** → their VestingWallet address → **Contract** → **Write**
2. Connect MetaMask with their wallet
3. `release(address token)` → `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`
4. Confirm → tokens arrive in their wallet

Cliff end date: computed at deploy time — see `start()` read on each contract.

---

## Emergency Notes

- **No admin key.** Once deployed and funded, only the beneficiary can receive tokens.
- **Tokens cannot be clawed back** by the Bank wallet after the cliff starts.
- **Before cliff end:** all tokens remain in each contract. If a beneficiary address is wrong, the Bank wallet can deploy a new contract (correct address) and do NOT fund the wrong one — or do not fund until confirmed. Tokens in an unfunded contract are safe.
- **After cliff + funding:** tokens belong to the beneficiary. No recovery path exists.
