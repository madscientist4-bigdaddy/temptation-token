# TTS Vesting Setup Guide

**Contract:** `contracts/TTSVestingWallet.sol`  
**Deploy script:** `node scripts/deploy_vesting.js`  
**Full transaction runbook:** `outputs/vesting_runbook.md`  
**Status:** Ready for deployment — placeholder addresses must be replaced first.

---

## What This Does

Five separate `TTSVestingWallet` contracts are deployed — one per beneficiary. Each contract:

- Holds TTS tokens sent to it by the Bank wallet
- Releases tokens linearly starting **1 year after deployment** (the cliff)
- Fully vested **4 years after deployment**
- Beneficiary calls `release(TTS_TOKEN)` at any time to claim whatever has vested

The beneficiary address is the only thing on-chain. There are no names, labels, or relationships recorded in the contract.

---

## Vesting Schedule

| Milestone | Timing | % Vested |
|-----------|--------|----------|
| Deploy | Day 0 | 0% |
| Cliff end | Day 365 (1 year) | 0% — nothing vests during cliff |
| Mid-vest | Day 730 (2 years) | ~33% |
| Mid-vest | Day 1095 (3 years) | ~67% |
| Full vest | Day 1460 (4 years) | 100% |

Linear release from day 365 to day 1460 (3-year linear period).

---

## Before You Deploy — Replace Placeholder Addresses

The script currently uses placeholder addresses `0xDeAd0000...0001` through `...0005`. These will not work on mainnet. Replace them before running the deploy script.

Open `scripts/deploy_vesting.js` and edit the `BENEFICIARIES` array:

```js
const BENEFICIARIES = [
  '0x<REAL_WALLET_1>',  // Beneficiary 1
  '0x<REAL_WALLET_2>',  // Beneficiary 2
  '0x<REAL_WALLET_3>',  // Beneficiary 3
  '0x<REAL_WALLET_4>',  // Beneficiary 4
  '0x<REAL_WALLET_5>',  // Beneficiary 5
]
```

Also set the TTS allocation per beneficiary in `ALLOCATIONS_TTS`:

```js
const ALLOCATIONS_TTS = [
  1_000_000n * 10n**18n,  // Beneficiary 1: 1,000,000 TTS
  // ... etc
]
```

Run `node scripts/deploy_vesting.js` after editing to see updated params.

---

## Deployment Steps (Summary)

**Full detailed runbook with exact constructor params:** `outputs/vesting_runbook.md`

1. **Replace placeholders** in `scripts/deploy_vesting.js` (see above)
2. **Compile** `contracts/TTSVestingWallet.sol` in Remix (0.8.20, 200 runs, via IR)
3. **Deploy 5 instances** from Bank wallet — one per beneficiary, same constructor params except address
4. **Note all 5 contract addresses** from Remix/MetaMask after deployment
5. **Add to tax-exempt list** via Gnosis Safe (saves ~2% loss per beneficiary over 4 years)
6. **Fund each contract** — transfer TTS allocation from Bank wallet to each contract address
7. **Verify** on BaseScan — call `releasable(TTS_TOKEN)` (should return 0 until cliff ends)

---

## About the 1% Transfer Tax

TTS has a permanent 1% transfer tax. If vesting contracts are **not** on the tax-exempt list:
- Funding transfer: Bank sends X TTS → contract receives 0.99X (1% burned)
- Release transfer: contract sends Y TTS → beneficiary receives 0.99Y (1% burned)
- Net: beneficiary receives ~98% of intended allocation over 4 years

If contracts **are** on the tax-exempt list (recommended):
- No tax on inbound funding or outbound releases
- Beneficiary receives 100% of vested allocation

**To add to tax-exempt list:** Gnosis Safe → import existing batch JSON → add 5 new `setTaxExempt(contractAddr, true)` calls → 2/2 sign. The tax-exempt batch process is documented in `outputs/gnosis_setTaxExempt_CLEAN.json`.

---

## After Deployment — What Beneficiaries Do

Each beneficiary interacts with their own `TTSVestingWallet` contract on BaseScan.

**To check what is available to claim:**
1. Go to BaseScan → their VestingWallet contract address
2. Contract → Read → `releasable(token)` → enter TTS token address: `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`
3. Returns the amount of TTS currently claimable (0 before cliff ends)

**To claim vested tokens:**
1. BaseScan → their VestingWallet → Contract → Write → `release(token)`
2. Enter TTS token: `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`
3. Connect MetaMask → Submit → tokens transfer to their wallet

**Anyone can call `release()`** — tokens always go to the beneficiary address. The beneficiary does not need to call it themselves.

---

## Updating Beneficiary Addresses

If a beneficiary wallet is lost or needs to change, there is **no admin function** to update the address. The beneficiary is immutable by design (no rug-pull vector). Options:
- Deploy a new VestingWallet with the correct address before funding
- Transfer any remaining tokens out (only the beneficiary can do this once any amount is vested) to a new contract

Plan: **confirm all 5 addresses before sending TTS.** Once funded, the allocation belongs to that address.

---

## BaseScan Verification

After deployment, verify each contract:

1. Go to `https://basescan.org/address/<CONTRACT_ADDRESS>#code`
2. Click **Verify and Publish**
3. Settings:
   - Compiler: Solidity 0.8.20
   - License: MIT
   - Optimization: Yes, 200 runs
   - EVM version: Default
   - Via IR: Yes
4. Paste the full source from `contracts/TTSVestingWallet.sol`
5. Constructor args: ABI-encode `(beneficiaryAddress, startTimestamp, durationSeconds)`
   - Use the ABI encoder at `abi.hashex.org` or copy from Remix deploy dialog

---

## Contract Addresses (fill in after deployment)

| Instance | Beneficiary | Contract Address |
|----------|-------------|-----------------|
| 1 | (private) | TBD |
| 2 | (private) | TBD |
| 3 | (private) | TBD |
| 4 | (private) | TBD |
| 5 | (private) | TBD |

Update this table and `CLAUDE.md` after deployment.

---

## Key Contract Facts

| Parameter | Value |
|-----------|-------|
| Solidity version | 0.8.20 |
| Optimizer | 200 runs, via IR |
| Chain | Base mainnet (8453) |
| TTS token | `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` |
| Cliff | 365 days from deployment |
| Linear period | 1095 days (3 years) after cliff |
| Total vest | 1460 days (4 years) |
| Admin functions | None — immutable after deploy |
| Upgradeability | None |
| Multisig required | Yes (Gnosis Safe for tax-exempt batch only) |
