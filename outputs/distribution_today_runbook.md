# TTS Distribution Runbook
**Generated:** 2026-06-07  
**Signer:** Bank/Deployer wallet `0xb1e991bf617459b58964eef7756b350e675c53b5`  
**Token:** TTS proxy `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`  
**Total supply:** 69,000,000,000 TTS  
**Total distributed today:** 32,000,000,000 TTS  

---

## ⚠️ DO THIS FIRST — Gnosis Safe batch (setTaxExempt)

Before executing the 5 transfers, submit the `gnosis_taxexempt_5wallets.json` batch via app.safe.global so each recipient can move their TTS freely without paying the 1% transfer tax.

**Steps:**
1. Open https://app.safe.global — connect as one of the 2/2 signers
2. Go to **New Transaction → Transaction Builder**
3. Click **Import** → select `outputs/gnosis_taxexempt_5wallets.json`
4. For each placeholder entry (marked with `_note`), click the transaction → set the `account` field to the real address from your Notes
5. Review all 5 calls, confirm each calls `setTaxExempt(addr, true)` on `0x5570eA97...`
6. Submit batch → get second signature → execute
7. Wait for the batch TX to confirm before proceeding with the 5 transfers below

**Why first:** The Bank wallet is already tax-exempt (confirmed on-chain). The *recipients* are not. While the 1% tax won't reduce the amounts Jim sends (tax is checked on the sender), making recipients exempt now means they won't lose 1% on every future transfer — staking deposits, vote transactions, etc. Running the Gnosis Safe batch takes ~5 minutes and is worth doing before the large transfers.

---

## Prerequisites

- [ ] Bank wallet has ≥ 0.01 ETH for gas (current: 0.0245 ETH ✓ — sufficient)
- [ ] MetaMask connected to **Base mainnet (chain 8453)**
- [ ] Gnosis Safe setTaxExempt batch confirmed on-chain (step above)
- [ ] All 5 recipient addresses collected from Jim's Notes

---

## BaseScan Write Proxy URL (use this for all 5 transactions)

```
https://basescan.org/address/0x5570eA97d53A53170e973894A9Fa7feb5785d3b9#writeProxyContract
```

**How to connect MetaMask on BaseScan:**
1. Open the URL above
2. Click **Connect to Web3** (top of the Write as Proxy tab)
3. MetaMask pops up → select Bank wallet `0xb1e991...` → approve
4. Confirm MetaMask shows **Base Mainnet** in the network dropdown

---

## Transaction 1 of 5 — Founder

| Field | Value |
|-------|-------|
| **Recipient** | **[JIM_LEDGER_ADDRESS]** — fill from Notes |
| **Amount** | 10,000,000,000 TTS |
| **Amount in wei** | `10000000000000000000000000000` |
| **Function** | `transfer(address to, uint256 amount)` |

**Steps:**
1. On the BaseScan Write as Proxy page (connected as Bank wallet)
2. Expand the **`transfer`** function
3. `to (address)` → paste `[JIM_LEDGER_ADDRESS]`
4. `amount (uint256)` → paste `10000000000000000000000000000`
5. Click **Write** → MetaMask opens
6. Confirm the transaction details: no ETH value, recipient is your Ledger address
7. Click **Confirm** in MetaMask

**Expected post-tx state:**
- Bank wallet balance decreases by exactly 10,000,000,000 TTS (no tax deducted — Bank is already exempt)
- `[JIM_LEDGER_ADDRESS]` balance increases by exactly 10,000,000,000 TTS

**Gas estimate:** ~80,000–120,000 gas × 0.001–0.01 gwei ≈ **< $0.01** on Base mainnet

---

## Transaction 2 of 5 — Investor Reserve (Gnosis Safe)

| Field | Value |
|-------|-------|
| **Recipient** | `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86` (Gnosis Safe 2/2) |
| **Amount** | 10,000,000,000 TTS |
| **Amount in wei** | `10000000000000000000000000000` |
| **Function** | `transfer(address to, uint256 amount)` |

**Steps:**
1. Same BaseScan page, same Bank wallet connection
2. Expand **`transfer`**
3. `to (address)` → `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`
4. `amount (uint256)` → `10000000000000000000000000000`
5. Click **Write** → Confirm in MetaMask

**Expected post-tx state:**
- Bank wallet balance decreases by exactly 10,000,000,000 TTS
- Gnosis Safe `0xeFb59d88...` balance increases by exactly 10,000,000,000 TTS

**Gas estimate:** < $0.01 on Base mainnet

---

## Transaction 3 of 5 — Development (Dr. Mike)

| Field | Value |
|-------|-------|
| **Recipient** | **[DR_MIKE_ADDRESS]** — fill from Notes |
| **Amount** | 5,000,000,000 TTS |
| **Amount in wei** | `5000000000000000000000000000` |
| **Function** | `transfer(address to, uint256 amount)` |

**Steps:**
1. Same BaseScan page, same Bank wallet connection
2. Expand **`transfer`**
3. `to (address)` → paste `[DR_MIKE_ADDRESS]`
4. `amount (uint256)` → `5000000000000000000000000000`
5. Click **Write** → Confirm in MetaMask

**Expected post-tx state:**
- Bank wallet balance decreases by exactly 5,000,000,000 TTS
- `[DR_MIKE_ADDRESS]` balance increases by exactly 5,000,000,000 TTS

**Gas estimate:** < $0.01 on Base mainnet

---

## Transaction 4 of 5 — Ecosystem (Chantea)

| Field | Value |
|-------|-------|
| **Recipient** | **[CHANTEA_ADDRESS]** — fill from Notes |
| **Amount** | 5,000,000,000 TTS |
| **Amount in wei** | `5000000000000000000000000000` |
| **Function** | `transfer(address to, uint256 amount)` |

**Steps:**
1. Same BaseScan page, same Bank wallet connection
2. Expand **`transfer`**
3. `to (address)` → paste `[CHANTEA_ADDRESS]`
4. `amount (uint256)` → `5000000000000000000000000000`
5. Click **Write** → Confirm in MetaMask

**Expected post-tx state:**
- Bank wallet balance decreases by exactly 5,000,000,000 TTS
- `[CHANTEA_ADDRESS]` balance increases by exactly 5,000,000,000 TTS

**Gas estimate:** < $0.01 on Base mainnet

---

## Transaction 5 of 5 — Team (Son)

| Field | Value |
|-------|-------|
| **Recipient** | **[SON_ADDRESS]** — fill from Notes |
| **Amount** | 2,000,000,000 TTS |
| **Amount in wei** | `2000000000000000000000000000` |
| **Function** | `transfer(address to, uint256 amount)` |

**Steps:**
1. Same BaseScan page, same Bank wallet connection
2. Expand **`transfer`**
3. `to (address)` → paste `[SON_ADDRESS]`
4. `amount (uint256)` → `2000000000000000000000000000`
5. Click **Write** → Confirm in MetaMask

**Expected post-tx state:**
- Bank wallet balance decreases by exactly 2,000,000,000 TTS
- `[SON_ADDRESS]` balance increases by exactly 2,000,000,000 TTS

**Gas estimate:** < $0.01 on Base mainnet

---

## Verification — run after all 5 transactions confirm

Replace `$JIM`, `$SAFE`, `$DRMIKE`, `$CHANTEA`, `$SON` with the actual addresses before running.

```bash
RPC="https://mainnet.base.org"
TTS="0x5570eA97d53A53170e973894A9Fa7feb5785d3b9"
BANK="0xb1e991bf617459b58964eef7756b350e675c53b5"

# Replace these with real addresses:
JIM="[JIM_LEDGER_ADDRESS]"
SAFE="0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86"
DRMIKE="[DR_MIKE_ADDRESS]"
CHANTEA="[CHANTEA_ADDRESS]"
SON="[SON_ADDRESS]"

# Bank wallet — must be ≤ 6,003,000,000 TTS (8.7% of 69B) after all 5 txs
echo "=== Bank wallet balance ==="
cast call $TTS "balanceOf(address)(uint256)" $BANK --rpc-url $RPC | \
  python3 -c "import sys; raw=int(sys.stdin.read()); tts=raw/10**18; print(f'{tts:,.0f} TTS ({tts/69_000_000_000*100:.2f}% of supply)')"

echo ""
echo "=== Recipient balances ==="

echo "Founder (Jim Ledger):"
cast call $TTS "balanceOf(address)(uint256)" $JIM --rpc-url $RPC | \
  python3 -c "import sys; raw=int(sys.stdin.read()); print(f'{raw/10**18:,.0f} TTS (expected 10,000,000,000)')"

echo "Investor Reserve (Gnosis Safe):"
cast call $TTS "balanceOf(address)(uint256)" $SAFE --rpc-url $RPC | \
  python3 -c "import sys; raw=int(sys.stdin.read()); print(f'{raw/10**18:,.0f} TTS (expected ≥ 10,000,000,000)')"

echo "Development (Dr. Mike):"
cast call $TTS "balanceOf(address)(uint256)" $DRMIKE --rpc-url $RPC | \
  python3 -c "import sys; raw=int(sys.stdin.read()); print(f'{raw/10**18:,.0f} TTS (expected 5,000,000,000)')"

echo "Ecosystem (Chantea):"
cast call $TTS "balanceOf(address)(uint256)" $CHANTEA --rpc-url $RPC | \
  python3 -c "import sys; raw=int(sys.stdin.read()); print(f'{raw/10**18:,.0f} TTS (expected 5,000,000,000)')"

echo "Team (Son):"
cast call $TTS "balanceOf(address)(uint256)" $SON --rpc-url $RPC | \
  python3 -c "import sys; raw=int(sys.stdin.read()); print(f'{raw/10**18:,.0f} TTS (expected 2,000,000,000)')"

echo ""
echo "=== 8.7% concentration check ==="
echo "Threshold: 6,003,000,000 TTS  (8.7% × 69B total supply)"
echo "Bank balance (from above) must be ≤ 6,003,000,000 TTS"

echo ""
echo "=== Tax-exempt status check — all 5 recipients should be true ==="
cast call $TTS "isTaxExempt(address)(bool)" $JIM    --rpc-url $RPC
cast call $TTS "isTaxExempt(address)(bool)" $SAFE   --rpc-url $RPC
cast call $TTS "isTaxExempt(address)(bool)" $DRMIKE --rpc-url $RPC
cast call $TTS "isTaxExempt(address)(bool)" $CHANTEA --rpc-url $RPC
cast call $TTS "isTaxExempt(address)(bool)" $SON    --rpc-url $RPC
```

### Expected results

| Wallet | Expected balance after distribution |
|--------|-------------------------------------|
| Bank wallet | ≤ 6,003,000,000 TTS (≤ 8.7% of 69B supply) |
| Founder (Jim Ledger) | 10,000,000,000 TTS |
| Investor Reserve (Safe) | ≥ 10,000,000,000 TTS |
| Development (Dr. Mike) | 5,000,000,000 TTS |
| Ecosystem (Chantea) | 5,000,000,000 TTS |
| Team (Son) | 2,000,000,000 TTS |

---

## Notes

- **No tax deduction on sends:** Bank wallet is already tax-exempt (`isTaxExempt[0xb1e991...] = true` — confirmed from Gnosis Safe nonce 4 batch). All 5 recipients receive exact stated amounts.
- **Gnosis Safe (Investor Reserve):** The Gnosis Safe itself will also receive the 10B TTS, so check the Safe token balance in addition to running the verification above.
- **BaseScan may cache balances:** If a balance looks wrong immediately after the TX, wait 30 seconds and refresh.
- **Gas wallet:** Bank wallet has 0.0245 ETH. Each transfer uses ~100,000 gas. At Base gas prices this is approximately $0.001–$0.01 per transfer; 5 transfers total ≈ $0.05 worst case. No top-up needed.
