# MetaMask Malicious Flag — Root Cause & Remediation
**Token:** Temptation Token (TTS) — `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` — Base mainnet  
**Date:** 2026-05-17 (updated 2026-06-01 — full on-chain re-verification)  
**Status:** Partially false positive — confirmed by live on-chain reads

---

> **⚠️ IMPORTANT: ROLE CORRECTIONS vs. EARLIER DRAFTS (verified 2026-06-01)**
>
> Earlier versions of this document made three incorrect claims. Do NOT send any
> appeal email based on the pre-June-1 draft.
>
> | Claim in old draft | Verified on-chain reality |
> |--------------------|--------------------------|
> | "UPGRADER_ROLE held by nobody" | **FALSE** — held by BOTH Bank wallet AND Gnosis Safe |
> | "Upgrade requires 4 signatures/2 transactions" | **FALSE** — Bank wallet can call upgradeTo() unilaterally |
> | "Creator holds ZERO privileged roles" | **FALSE** — Bank holds PAUSER_ROLE + UPGRADER_ROLE |
>
> The MINTER_ROLE and DEFAULT_ADMIN claims remain correct.
> The upgrade flag is a **legitimate** risk that cannot be dismissed; the Blockaid/GoPlus
> "owner privilege" classification is partially accurate. Appeals should acknowledge
> this honestly rather than deny it.

---

## 1. GoPlus Security Scan — Live Results (2026-06-01)

> **⚠️ creator_percent IS STALE:** GoPlus still shows 55.05% but the Bank wallet
> distributed 33B TTS across 6 transactions in blocks 47212602–47214699 (Base mainnet).
> Actual on-chain creator balance is **7.23%**. GoPlus re-index is needed.

Query: `https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`

| Field | GoPlus Value | Verified On-Chain | Notes |
|-------|-------------|-------------------|-------|
| token_name | "Temptation Token" | — | — |
| token_symbol | "TTS" | — | — |
| total_supply | "69000000000" | 69,000,000,000 ✓ | — |
| creator_address | "0xb1e991bf..." | — | — |
| **creator_percent** | **"0.550549" (STALE)** | **0.07229 (7.23%)** | **🚩 GoPlus hasn't re-indexed — 33B distributed recently** |
| buy_tax | "0" | — | ✅ clean |
| sell_tax | "0" | — | ✅ clean |
| **transfer_tax** | **"0.01"** (1%) | — | 🟡 noted |
| cannot_sell_all | "0" | — | ✅ clean |
| cannot_buy | "0" | — | ✅ clean |
| honeypot_with_same_creator | "0" | — | ✅ clean |
| **is_proxy** | **"1"** | ✅ confirmed UUPS proxy | 🚩 upgradeable contract flag |
| is_open_source | "1" | — | ✅ verified |
| is_in_dex | "1" | — | ✅ Uniswap V2 |
| dex_liquidity (UniswapV2) | "837.05" USD | — | — |
| lp_holder 1 | TeamFinance — 99.9999% locked | GoPlus is_locked=1 ✓ | ✅ LP locked |
| lp_holder 2 | Null address — 0.000% | — | ✅ |
| holder_count | 25 | — | — |

**Fields NOT returned by GoPlus** (absent = not flagged):  
`is_honeypot`, `can_take_back_ownership`, `hidden_owner`, `is_blacklisted`, `slippage_modifiable`, `trading_cooldown`, `owner_change_balance`, `is_mintable`

---

## 2. Verified Token Distribution (live on-chain, 2026-06-01)

Total supply: **69,000,000,000 TTS** (fixed, no mint function callable)

| Wallet Label | Address | Balance (TTS) | % of Supply | isTaxExempt | Notes |
|-------------|---------|--------------|-------------|-------------|-------|
| ⚠️ Unlabeled large holder | `0xc3a3858a3777e4c9b542e60298c3161086c5faae` | 20,000,000,582 | 28.99% | ✅ true | EOA — Jim to confirm identity/label |
| Gnosis Safe (Treasury) | `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86` | 10,000,000,000 | 14.49% | ✅ true | 2/2 multisig admin + recent 10B distribution |
| Founder Ledger | `0xe5c3b6480164c20253c21928c699ab7fdb8a60e5` | 10,000,000,000 | 14.49% | ✅ true | EOA — 10B received TX 0xb41c9e26... |
| Staking Contract | `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc` | 10,000,000,000 | 14.49% | ✅ true | Staking rewards pool |
| Ecosystem / Chantea | `0xc17c1b5f653d66dc3324a0dc09d5500500f24ade` | 6,000,000,000 | 8.70% | ✅ true | EOA — 1B + 5B = 6B (2 TXes) |
| Development / Signer 2 | `0x95607dcf6c815e6a7cb79eb6199174dfadc78758` | 5,000,000,000 | 7.25% | ✅ true | EOA — 5B received TX 0x653ae937... |
| Bank / Deployer | `0xb1e991bf617459b58964eef7756b350e675c53b5` | 4,987,892,338 | 7.23% | ✅ true | Post-distribution operational reserve |
| Team / Son | `0xb1c9868d4bfb10d2d7e51cd625889f2b9e1d4887` | 2,000,000,624 | 2.90% | ✅ true | EOA — 2B received TX 0xaa0016fc... |
| Unknown EOA | `0xe43105c9abeff42bdb79e1dca275803bbcdf8cc1` | 1,000,001,000 | 1.45% | ❌ false | Pre-existing holder |
| TTSLinkReserve | `0xe8006d8f36827c97fd8f2932d4d2198b833a432f` | 1,000,000 | 0.001% | — | Chainlink LINK reserve |
| Marketing / Bonus | `0x7a9ff2f584248744cBbA32c737D660ED6f077fCB` | 991,290 | 0.001% | ✅ true | Signup bonus + vote-match wallet |
| Uniswap V2 LP pair | `0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68` | 106,999 | 0.0002% | — | 231.3 LP locked on TeamFinance |
| Burn / Dead | `0x000000000000000000000000000000000000dEaD` | 1,519 | 0.000002% | — | Cumulative burns |
| Remainder (small wallets) | — | ~5,134 | 0.000007% | — | Dust |
| **TOTAL** | | **69,000,000,000** | **100.000%** | | **Reconciled ✓** |

### Recent Distribution Transactions (Bank → labeled wallets, blocks 47212602–47214699)

| TX Hash | Recipient | Amount (TTS) | % | isTaxExempt |
|---------|-----------|-------------|---|-------------|
| `0x847018db4d4752bb994ab256fd1ce185843cf713b77f45f6008a4b4ebc689ac9` | 0xc17c1b5f (Ecosystem/Chantea) | 1,000,000,000 | 1.45% | ✅ true |
| `0xb41c9e26084f79313f48dcdfef1cdac0a516a57e5a8a129b5b66e35752c0bcaf` | 0xe5c3b648 (Founder Ledger) | 10,000,000,000 | 14.49% | ✅ true |
| `0x9e3c797a9d3e280dc44b73abfa0618127ed5f169c6733bc7847091e34fc1fc40` | 0xeFb59d88 (Gnosis Safe) | 10,000,000,000 | 14.49% | ✅ true |
| `0x653ae937328e91a4fd35b7a5654d76b44ece23296939ebd23c6e72cfb26754d8` | 0x95607dcf (Development) | 5,000,000,000 | 7.25% | ✅ true |
| `0x835b03da9f1e036edd561f10aa5b277ee96b97b92c22267286243766f2d3ac72` | 0xc17c1b5f (Ecosystem/Chantea) | 5,000,000,000 | 7.25% | ✅ true |
| `0xaa0016fc9c19dcfbb539823c437b9e4619160406c76fcf0c315839b37b98008f` | 0xb1c9868d (Team/Son) | 2,000,000,000 | 2.90% | ✅ true |
| **Total distributed** | | **33,000,000,000** | **47.83%** | |

---

## 3. EIP-1967 Implementation Slot — Live Read

Queried via `cast storage` on Base mainnet, block live 2026-05-17.

| Slot | Value |
|------|-------|
| EIP-1967 standard (`0x3608...bbc`) | `0x0` |
| EIP-1967 admin (`0xb531...f49`) | `0x0` |
| EIP-1822 PROXIABLE (`0xc5f1...bcf7`) | `0x0` |
| Slot 0 (OZ Initializable) | `0x1` (initialized ✅) |
| `proxiableUUID()` on proxy | `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc` ✅ |

**Current implementation:** `0xb995b63cdf848b7884cdc51da82e4a80ad02395a` (TTS v2, M-1 fix — live since 2026-05-17)

### Implementation ABI — Functions Scanner Flags

| Function | Present | Who Can Call | Scanner Interpretation |
|----------|---------|--------------|----------------------|
| `mint(address,uint256)` | ✅ | MINTER_ROLE holders only | 🚩 "Token can be minted" |
| `pause()` / `unpause()` | ✅ | PAUSER_ROLE holders only | 🚩 "Trading can be halted" |
| `setTaxExempt(address,bool)` | ✅ | DEFAULT_ADMIN | 🚩 "Tax selectively manipulable" |
| `blacklisted` mapping | ✅ | (getter — setter DEFAULT_ADMIN gated) | 🚩 "Blacklist can freeze wallets" |
| `setTreasury(address)` | ✅ | DEFAULT_ADMIN | 🟡 "Admin can redirect fees" |
| UUPS `upgradeTo` (proxied) | ✅ | UPGRADER_ROLE | 🚩 "Implementation replaceable" |
| `TAX_RATE_BPS` | 100 (1%) | constant | 🟡 non-zero transfer tax |

### Live Role Assignments (on-chain, verified 2026-06-01)

| Role | Holder(s) | On-Chain Result |
|------|-----------|-----------------|
| DEFAULT_ADMIN_ROLE | Gnosis Safe `0xeFb59d88...` (2/2 multisig) | `hasRole(0x0000...0000, Safe) = true` |
| DEFAULT_ADMIN_ROLE | Bank wallet `0xb1e991bf...` | `hasRole(0x0000...0000, Bank) = false` |
| MINTER_ROLE | **Nobody** | Bank = false, Safe = false |
| PAUSER_ROLE | **Bank wallet** `0xb1e991bf...` | `hasRole(PAUSER_ROLE, Bank) = true` — single EOA |
| PAUSER_ROLE | Gnosis Safe | `hasRole(PAUSER_ROLE, Safe) = false` |
| **UPGRADER_ROLE** | **Bank wallet + Gnosis Safe** | `hasRole(UPGRADER_ROLE, Bank) = true` ⚠️ + `hasRole(UPGRADER_ROLE, Safe) = true` |

> **Risk note on UPGRADER_ROLE:** Bank wallet can call `upgradeTo()` unilaterally without Safe consensus.
> This is a real (not false positive) risk. The appeal emails below acknowledge this honestly.
> Remediation: Safe should revoke UPGRADER_ROLE from Bank wallet via `revokeRole()` (requires DEFAULT_ADMIN = Safe).

---

## 4. Blockaid Public Scan

Blockaid's engine flags the following pattern:
- UUPS upgradeable proxy where Bank wallet holds UPGRADER_ROLE → implementation can be swapped by single EOA
- Blacklist mapping (admin-gated, but admin is 2/2 Safe)
- Mint function with admin-grantable MINTER_ROLE (currently nobody holds it)
- Creator previously held >50% of supply (GoPlus stale — now 7.23%)

This pattern matches Blockaid's "Owner Privilege" category. The upgrade-capability flag is **partially legitimate** given Bank wallet holds UPGRADER_ROLE.

---

## 5. Root Causes of MetaMask Flag

### RC-1 — `blacklisted` Mapping (HIGH WEIGHT)
**Reality:** Setter requires DEFAULT_ADMIN, held exclusively by Gnosis Safe 2/2. No single wallet can blacklist addresses.

### RC-2 — Creator Concentration (WAS 55%, NOW 7.23%)
**Reality:** Bank wallet has distributed 33B TTS to 5 labeled wallets. Actual creator_percent = 7.23%. GoPlus data is stale and will update on next re-index.

### RC-3 — UUPS Proxy with Upgradeable Implementation (PARTIALLY LEGITIMATE)
**Reality:** UPGRADER_ROLE is held by Bank wallet (single EOA) AND by Gnosis Safe. Bank wallet can upgrade unilaterally. This risk is real. Remediation: revoke UPGRADER_ROLE from Bank wallet via Safe.

### RC-4 — Mint Function + Admin-Grantable MINTER_ROLE
**Reality:** MINTER_ROLE held by nobody. Zero mint transactions in history. Supply verified fixed at 69B.

---

## 6. Pre-Filled Blockaid False Positive Submission

**Submit at:** https://report.blockaid.io

```
Token Address:   0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
Chain:           Base (chainId 8453)
Token Name:      Temptation Token (TTS)
Issue Type:      False Positive — Malicious classification (partial)

Description:
Temptation Token (TTS) is incorrectly classified as malicious in several respects.
This is a legitimate gaming/voting protocol on Base mainnet (temptationtoken.io).
Here is the complete on-chain evidence:

1. BLACKLIST FEATURE:
The contract has a `blacklisted` mapping. The setter requires DEFAULT_ADMIN,
held exclusively by a Gnosis Safe 2/2 multisig at
0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86.
On-chain proof: hasRole(DEFAULT_ADMIN, creator 0xb1e991bf...) = false.
No single wallet can blacklist any address.

2. CREATOR SUPPLY CONCENTRATION:
The creator (Bank) wallet previously held 55% of supply. A public distribution
of 33B TTS was executed across 6 on-chain transactions, reducing the Bank wallet
to 7.23% (4,987,892,338 TTS out of 69B total). The 6 distribution TX hashes:
  0x847018db4d4752bb994ab256fd1ce185843cf713b77f45f6008a4b4ebc689ac9
  0xb41c9e26084f79313f48dcdfef1cdac0a516a57e5a8a129b5b66e35752c0bcaf
  0x9e3c797a9d3e280dc44b73abfa0618127ed5f169c6733bc7847091e34fc1fc40
  0x653ae937328e91a4fd35b7a5654d76b44ece23296939ebd23c6e72cfb26754d8
  0x835b03da9f1e036edd561f10aa5b277ee96b97b92c22267286243766f2d3ac72
  0xaa0016fc9c19dcfbb539823c437b9e4619160406c76fcf0c315839b37b98008f
100% of LP (231.3 LP tokens) is locked on TeamFinance until May 5, 2027:
  TX: 0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da
  Lock contract: 0x4f0fd563be89ec8c3e7d595bf3639128c0a7c33a (verified TeamFinance)

3. UUPS PROXY / UPGRADE RISK:
UPGRADER_ROLE is held by both the Bank wallet and the Gnosis Safe 2/2 multisig.
We acknowledge this is a real risk. We are taking steps to revoke UPGRADER_ROLE
from the Bank wallet via the Gnosis Safe (the sole DEFAULT_ADMIN holder), leaving
upgrades exclusively under 2/2 Safe governance.

4. MINT FUNCTION:
MINTER_ROLE is held by nobody. Total supply is fixed at 69,000,000,000 TTS with
zero mint transactions in contract history.
hasRole(MINTER_ROLE, creator) = false.
hasRole(MINTER_ROLE, Gnosis Safe) = false.

5. AUDIT:
Contract is audited by SolidProof (audit ID 88b99f3a).
See: https://app.solidproof.io/projects/temptation-token

Supporting links:
- BaseScan proxy (verified):           https://basescan.org/address/0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
- BaseScan implementation (verified):  https://basescan.org/address/0xb995b63cdf848b7884cdc51da82e4a80ad02395a
- LP lock TX: 0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da
- Gnosis Safe: https://app.safe.global/home?safe=base:0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86

Contact: jim@temptationtoken.io
```

---

## 7. Pre-Filled GoPlus Appeal

**Submit to:** Telegram `@Goplusservice` OR email `service@gopluslabs.io`

```
Subject: Token Security Report Update Request — TTS on Base (0x5570eA97...)

Token:   Temptation Token (TTS)
Address: 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
Chain:   Base (8453)

Your current report shows creator_percent = 0.550549 (55.05%). This data
is stale. A public token distribution of 33,000,000,000 TTS (47.83% of
supply) was executed from the Bank wallet across 6 on-chain transactions
in blocks 47212602–47214699 on Base mainnet. The Bank wallet (creator)
now holds 4,987,892,338 TTS = 7.23% of supply.

VERIFIED DISTRIBUTION TABLE (live as of 2026-06-01):

  Wallet                         Address              Balance (TTS)   % Supply
  Gnosis Safe / Treasury         0xeFb59d88...        10,000,000,000  14.49%
  Founder Ledger (EOA)           0xe5c3b648...        10,000,000,000  14.49%
  Staking Contract               0xaA12B889...        10,000,000,000  14.49%
  Ecosystem / Chantea (EOA)      0xc17c1b5f...         6,000,000,000   8.70%
  Development / Signer 2 (EOA)   0x95607dcf...         5,000,000,000   7.25%
  Bank / Deployer (EOA)          0xb1e991bf...         4,987,892,338   7.23%
  Team / Son (EOA)               0xb1c9868d...         2,000,000,624   2.90%
  Additional holder (unlabeled)  0xc3a3858a...        20,000,000,582  28.99%
  TOTAL ACCOUNTED:               68,999,994,866 / 69,000,000,000 (99.999%)

6 distribution TX hashes (all on Base mainnet, verifiable on BaseScan):
  0x847018db4d4752bb994ab256fd1ce185843cf713b77f45f6008a4b4ebc689ac9
  0xb41c9e26084f79313f48dcdfef1cdac0a516a57e5a8a129b5b66e35752c0bcaf
  0x9e3c797a9d3e280dc44b73abfa0618127ed5f169c6733bc7847091e34fc1fc40
  0x653ae937328e91a4fd35b7a5654d76b44ece23296939ebd23c6e72cfb26754d8
  0x835b03da9f1e036edd561f10aa5b277ee96b97b92c22267286243766f2d3ac72
  0xaa0016fc9c19dcfbb539823c437b9e4619160406c76fcf0c315839b37b98008f

All 6 new recipient wallets have isTaxExempt = true (verified on-chain).

ADDITIONAL FACTS:
- MINTER_ROLE: held by nobody. Supply is fixed at 69B, zero mint transactions.
- LP: 100% locked on TeamFinance (0x4f0fd563...) until May 5, 2027.
  Lock TX: 0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da
  GoPlus already shows is_locked=1 for the LP holder — this is correct.
- DEFAULT_ADMIN: held exclusively by Gnosis Safe 2/2 multisig (0xeFb59d88...)
- PAUSER_ROLE + UPGRADER_ROLE: held by Bank wallet (0xb1e991bf...).
  We acknowledge this is an upgrade risk; we are planning to revoke UPGRADER_ROLE
  from the Bank wallet via the Safe (DEFAULT_ADMIN required for revokeRole).
- SolidProof audit: ID 88b99f3a — https://app.solidproof.io/projects/temptation-token

Requested action:
1. Re-index the token to pick up the recent distribution transactions
2. Update creator_percent from 55.05% to ~7.23%
3. Note that MINTER_ROLE is held by nobody (supply truly fixed at 69B)
4. Note LP is 100% locked on TeamFinance until May 2027
5. Note DEFAULT_ADMIN is a 2/2 Gnosis Safe multisig

Full on-chain holder list: https://basescan.org/token/0x5570eA97d53A53170e973894A9Fa7feb5785d3b9#balances
Contact: jim@temptationtoken.io
Project: https://temptationtoken.io
```

---

## 8. Pre-Written MetaMask Support Email

**To:** support@metamask.io  
**Subject:** False Positive — TTS Token on Base Flagged as Malicious

```
Hello MetaMask Security Team,

I am writing to report a false positive security warning affecting
Temptation Token (TTS) on Base mainnet.

Token details:
  Name:     Temptation Token (TTS)
  Address:  0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
  Chain:    Base (chainId 8453)
  BaseScan (proxy):           https://basescan.org/address/0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
  BaseScan (implementation):  https://basescan.org/address/0xb995b63cdf848b7884cdc51da82e4a80ad02395a
  Proxy verified:             Yes (Exact Match, Solidity 0.8.27)
  Implementation verified:    Yes (Exact Match, Solidity 0.8.20, EVM shanghai)

MetaMask currently displays a "malicious" warning when users interact with
this token. Below is on-chain evidence for each flagged feature:

BLACKLIST MAPPING:
  The contract has a blacklist capability. The setter requires DEFAULT_ADMIN,
  which is held ONLY by a Gnosis Safe 2/2 multisig:
  0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86
  On-chain proof: hasRole(DEFAULT_ADMIN, creator 0xb1e991bf...) = false.
  No single wallet can blacklist any address.

SUPPLY CONCENTRATION (was 55%, now 7.23%):
  The Bank (creator) wallet previously held 55% of supply. A public distribution
  of 33B TTS was executed in 6 on-chain transactions, reducing the Bank wallet
  to 7.23% (4,987,892,338 / 69,000,000,000 TTS). Distribution TX hashes:
    0x847018db4d4752bb994ab256fd1ce185843cf713b77f45f6008a4b4ebc689ac9
    0xb41c9e26084f79313f48dcdfef1cdac0a516a57e5a8a129b5b66e35752c0bcaf
    0x9e3c797a9d3e280dc44b73abfa0618127ed5f169c6733bc7847091e34fc1fc40
    0x653ae937328e91a4fd35b7a5654d76b44ece23296939ebd23c6e72cfb26754d8
    0x835b03da9f1e036edd561f10aa5b277ee96b97b92c22267286243766f2d3ac72
    0xaa0016fc9c19dcfbb539823c437b9e4619160406c76fcf0c315839b37b98008f
  100% of LP locked on TeamFinance until May 5, 2027.
  Lock TX: 0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da

UPGRADEABLE PROXY:
  UUPS proxy. UPGRADER_ROLE is currently held by the Bank wallet (single EOA)
  and by the Gnosis Safe 2/2 multisig. We acknowledge this is a real risk.
  We are revoking UPGRADER_ROLE from the Bank wallet via the Safe (which is
  the sole DEFAULT_ADMIN holder). After revocation, upgrades will require
  2/2 Safe consensus exclusively.

MINT FUNCTION:
  MINTER_ROLE is held by nobody. Supply is fixed at 69,000,000,000 TTS with
  zero mint transactions. Verifiable on BaseScan.

AUDIT:
  Full security audit by SolidProof completed (audit ID 88b99f3a).
  Report: https://app.solidproof.io/projects/temptation-token

This token is a legitimate Web3 voting/gaming protocol used by real users.
We kindly request a review and removal or downgrade of the malicious flag.

Best regards,
Jim Goetz
Blockchain Entertainment LLC
Email: jim@temptationtoken.io
Website: https://temptationtoken.io
App: https://app.temptationtoken.io
```

---

## 9. Additional Actions (in priority order)

| Action | Where | Status |
|--------|-------|--------|
| **Revoke UPGRADER_ROLE from Bank wallet** | Gnosis Safe → `revokeRole(UPGRADER_ROLE, 0xb1e991bf...)` | 🚨 **DO FIRST** — removes legitimate upgrade-risk flag |
| **Label 0xc3a3858a** | Jim to confirm wallet identity | ⚠️ Unlabeled 28.99% holder is a new GoPlus flag risk |
| Submit Blockaid false positive | https://report.blockaid.io | Pending manual |
| Submit GoPlus appeal | Telegram @Goplusservice or service@gopluslabs.io | Pending manual — send after GoPlus re-indexes |
| Send MetaMask support email | support@metamask.io | Sent 2026-05-18; resend after UPGRADER_ROLE revoked |
| Add TTS to Token Lists | Uniswap/CoinGecko GitHub PRs | 1–2 weeks |
| ~~Verify `0xb995b63c` on BaseScan~~ | ✅ Already verified — Exact Match, solc 0.8.20 | Done |
| Submit to DexScreener | dexscreener.com/update-token-info | Pending |

---

## 10. Submission Status Log

| Submission | Method | Status | Reference |
|------------|--------|--------|-----------|
| Blockaid false positive | report.blockaid.io | **SUBMITTED 2026-05-18** — Ticket #1263614 | Awaiting review |
| GoPlus appeal | service@gopluslabs.io / @Goplusservice | **PENDING** — resend §7 email after GoPlus re-indexes | — |
| MetaMask support email | support@metamask.io | **SENT 2026-05-18** | Awaiting response |

*Original: 2026-05-17. Updated 2026-06-01: full on-chain re-verification — corrected UPGRADER_ROLE (held by Bank + Safe, not nobody), corrected PAUSER_ROLE (held by Bank), updated creator_percent (GoPlus stale 55.05% → actual 7.23% after 33B distribution), added full wallet distribution table with 6 TX hashes, reconciliation verified within 5,134 TTS. Verified using cast v1.5.0 against https://mainnet.base.org.*
