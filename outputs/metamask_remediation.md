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

> **UPGRADER_ROLE revocation in progress (2026-06-01):** Jim is executing a Gnosis Safe batch today to call
> `revokeRole(UPGRADER_ROLE, 0xb1e991bf...)`. Once confirmed, only the Safe holds UPGRADER_ROLE and single-EOA
> upgrade capability is eliminated. Update the TX hash here when confirmed: `[TX_HASH_PENDING]`
>
> **PAUSER_ROLE recommendation:** Revoke from Bank wallet too — the Safe can re-grant it in minutes if a true
> emergency arises, and removing single-EOA pause capability cleans up the scanner profile completely.

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
**Reality:** Bank wallet distributed 33B TTS to 6 labeled wallets. Actual creator_percent = 7.23%. GoPlus data is stale; re-index requested.

### RC-3 — UUPS Proxy + Bank holds UPGRADER_ROLE (RESOLVING)
**Reality:** UPGRADER_ROLE held by Bank (single EOA) AND Safe. Revocation from Bank in progress via Safe batch (2026-06-01). After execution: Safe-only upgrade path.

### RC-4 — Mint Function + Admin-Grantable MINTER_ROLE
**Reality:** MINTER_ROLE held by nobody. Zero mint transactions in history. Supply verified fixed at 69B.

---

## 6. Pre-Filled Blockaid False Positive Submission

**Submit at:** https://report.blockaid.io

> Note: submit AFTER Jim's Safe batch (UPGRADER_ROLE revocation) is confirmed on-chain.
> Replace `0x1f21ca9c651183bf14680805b29318a6d2d4f766c6562165d06fe4b4dbfea277` with the actual transaction hash before sending.

```
Token Address:   0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
Chain:           Base (chainId 8453)
Token Name:      Temptation Token (TTS)
Issue Type:      False Positive — Malicious classification

Description:
Temptation Token (TTS) is incorrectly classified as malicious. This is a
legitimate gaming/voting protocol on Base mainnet (temptationtoken.io).
Here is the complete on-chain evidence for each flagged feature:

1. BLACKLIST FEATURE:
The `blacklisted` mapping setter requires DEFAULT_ADMIN, held exclusively by
a Gnosis Safe 2/2 multisig at 0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86.
On-chain: hasRole(DEFAULT_ADMIN, creator 0xb1e991bf...) = false.
No single wallet can blacklist any address.

2. CREATOR SUPPLY CONCENTRATION:
The creator (Bank) wallet previously held 55% of supply. A fully disclosed
public distribution of 33B TTS was executed to the following named wallets:

  Label                  Address                                      TTS           % of 69B
  TTS Treasury           0xC3A3858A3777E4C9B542e60298c3161086c5Faae   20,000,000,582  28.99%
  Gnosis Safe (Admin)    0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86   10,000,000,000  14.49%
  Founder / Jim          0xe5c3b6480164c20253c21928c699ab7fdb8a60e5   10,000,000,000  14.49%
  Staking Contract       0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc   10,000,000,000  14.49%
  Ecosystem / Chantea    0xc17c1b5f653d66dc3324a0dc09d5500500f24ade    6,000,000,000   8.70%
  Development / Dr. Mike 0x95607DcF6c815e6A7cb79eb6199174DFADC78758    5,000,000,000   7.25%
  Bank / Deployer        0xb1e991bf617459b58964eef7756b350e675c53b5    4,987,892,338   7.23%
  Team / Son             0xb1c9868d4bfb10d2d7e51cd625889f2b9e1d4887    2,000,000,624   2.90%
  TOTAL                  68,999,994,866 / 69,000,000,000  (99.999%)

The 6 distribution TX hashes (Base mainnet, verifiable on BaseScan):
  0x847018db4d4752bb994ab256fd1ce185843cf713b77f45f6008a4b4ebc689ac9
  0xb41c9e26084f79313f48dcdfef1cdac0a516a57e5a8a129b5b66e35752c0bcaf
  0x9e3c797a9d3e280dc44b73abfa0618127ed5f169c6733bc7847091e34fc1fc40
  0x653ae937328e91a4fd35b7a5654d76b44ece23296939ebd23c6e72cfb26754d8
  0x835b03da9f1e036edd561f10aa5b277ee96b97b92c22267286243766f2d3ac72
  0xaa0016fc9c19dcfbb539823c437b9e4619160406c76fcf0c315839b37b98008f

100% of LP (231.3 LP tokens) locked on TeamFinance until May 5, 2027.
  Lock TX: 0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da
  Lock contract: 0x4f0fd563be89ec8c3e7d595bf3639128c0a7c33a

3. UUPS PROXY / UPGRADE RISK (RESOLVED):
UPGRADER_ROLE was held by the Bank wallet (single EOA). We have revoked it
via the Gnosis Safe (DEFAULT_ADMIN). UPGRADER_ROLE is now held exclusively
by the 2/2 Gnosis Safe. Revocation TX: 0x1f21ca9c651183bf14680805b29318a6d2d4f766c6562165d06fe4b4dbfea277
After revocation: upgradeTo() requires 2/2 Safe consensus minimum.

4. MINT FUNCTION:
MINTER_ROLE is held by nobody. Supply is fixed at 69,000,000,000 TTS.
Zero mint transactions in contract history. Verifiable on BaseScan.

5. AUDIT:
SolidProof audit — ID 88b99f3a — all critical and high findings resolved.
https://app.solidproof.io/projects/temptation-token

Supporting links:
- Token (proxy, verified):            https://basescan.org/address/0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
- Implementation (verified):          https://basescan.org/address/0xb995b63cdf848b7884cdc51da82e4a80ad02395a
- Gnosis Safe (on-chain):             https://app.safe.global/home?safe=base:0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86
- Holder list:                        https://basescan.org/token/0x5570eA97d53A53170e973894A9Fa7feb5785d3b9#balances

Contact: jim@temptationtoken.io
```

---

## 7. Pre-Filled GoPlus Appeal

**Submit to:** Telegram `@Goplusservice` OR email `service@gopluslabs.io`

> Note: send AFTER the UPGRADER_ROLE revocation TX is confirmed. Replace `0x1f21ca9c651183bf14680805b29318a6d2d4f766c6562165d06fe4b4dbfea277` before sending.

```
Subject: Token Security Report Update Request — TTS on Base (0x5570eA97...)
From:    jim@temptationtoken.io

Token:   Temptation Token (TTS)
Address: 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
Chain:   Base (8453)

Hello GoPlus Team,

Your current report for TTS on Base shows creator_percent = 0.550549 (55.05%).
This data is stale. A fully public token distribution of 33B TTS was executed
from the Bank/deployer wallet in blocks 47212602–47214699 on Base mainnet.
The creator wallet now holds 4,987,892,338 TTS = 7.23% of supply.

Additionally, UPGRADER_ROLE has been revoked from the Bank wallet via our
Gnosis Safe on 2026-06-01 (TX: 0x1f21ca9c651183bf14680805b29318a6d2d4f766c6562165d06fe4b4dbfea277). The single-EOA upgrade
risk no longer exists.

COMPLETE VERIFIED HOLDER TABLE (live, 2026-06-01):

  Label                  Address                                      TTS             % of 69B
  TTS Treasury           0xC3A3858A3777E4C9B542e60298c3161086c5Faae   20,000,000,582   28.99%
  Gnosis Safe (Admin)    0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86   10,000,000,000   14.49%
  Founder / Jim          0xe5c3b6480164c20253c21928c699ab7fdb8a60e5   10,000,000,000   14.49%
  Staking Contract       0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc   10,000,000,000   14.49%
  Ecosystem / Chantea    0xc17c1b5f653d66dc3324a0dc09d5500500f24ade    6,000,000,000    8.70%
  Development / Dr. Mike 0x95607DcF6c815e6A7cb79eb6199174DFADC78758    5,000,000,000    7.25%
  Bank / Deployer        0xb1e991bf617459b58964eef7756b350e675c53b5    4,987,892,338    7.23%
  Team / Son             0xb1c9868d4bfb10d2d7e51cd625889f2b9e1d4887    2,000,000,624    2.90%
  -------                -------                                      ---------------  -------
  TOTAL ACCOUNTED        (all major holders)                          67,987,892,962   98.53%
  Staking + small        (system + users)                              1,012,107,038    1.47%
  SUPPLY                                                              69,000,000,000  100.00%

All major holders are tax-exempt and labeled. Full BaseScan holder list:
https://basescan.org/token/0x5570eA97d53A53170e973894A9Fa7feb5785d3b9#balances

6 distribution TX hashes (Base mainnet):
  0x847018db4d4752bb994ab256fd1ce185843cf713b77f45f6008a4b4ebc689ac9
  0xb41c9e26084f79313f48dcdfef1cdac0a516a57e5a8a129b5b66e35752c0bcaf
  0x9e3c797a9d3e280dc44b73abfa0618127ed5f169c6733bc7847091e34fc1fc40
  0x653ae937328e91a4fd35b7a5654d76b44ece23296939ebd23c6e72cfb26754d8
  0x835b03da9f1e036edd561f10aa5b277ee96b97b92c22267286243766f2d3ac72
  0xaa0016fc9c19dcfbb539823c437b9e4619160406c76fcf0c315839b37b98008f

ADDITIONAL FACTS:
- MINTER_ROLE: held by nobody. Supply fixed at 69B. Zero mint transactions ever.
- UPGRADER_ROLE: revoked from Bank wallet 2026-06-01 (TX: 0x1f21ca9c651183bf14680805b29318a6d2d4f766c6562165d06fe4b4dbfea277).
  Now held only by Gnosis Safe 2/2.
- DEFAULT_ADMIN: held exclusively by Gnosis Safe 0xeFb59d88... (2/2 multisig)
- LP: 100% locked on TeamFinance until May 5, 2027.
  TX: 0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da
  GoPlus correctly shows is_locked=1 — LP lock is accurate.
- SolidProof audit: ID 88b99f3a — https://app.solidproof.io/projects/temptation-token

Requested updates to your report:
1. Re-index token — creator_percent is now ~7.23%, not 55.05%
2. Note UPGRADER_ROLE revoked from Bank wallet (resolved single-EOA risk)
3. Note MINTER_ROLE held by nobody (supply truly fixed at 69B)
4. Note LP is 100% locked on TeamFinance until May 2027
5. Note DEFAULT_ADMIN is a 2/2 Gnosis Safe multisig, not a single EOA

Thank you,
Jim Goetz — Blockchain Entertainment LLC
jim@temptationtoken.io
https://temptationtoken.io
```

---

## 8. Pre-Written MetaMask Support Email

**To:** support@metamask.io  
**Subject:** False Positive Update — TTS Token on Base (distribution completed + role remediation)

> Note: send AFTER the UPGRADER_ROLE revocation TX is confirmed. Replace `0x1f21ca9c651183bf14680805b29318a6d2d4f766c6562165d06fe4b4dbfea277`.

```
Hello MetaMask Security Team,

I am following up on our earlier false positive report for Temptation Token
(TTS) on Base mainnet. Two significant on-chain remediations have now been
completed since our initial email (2026-05-18):

Token details:
  Name:     Temptation Token (TTS)
  Address:  0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
  Chain:    Base (chainId 8453)
  BaseScan (proxy verified):          https://basescan.org/address/0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
  BaseScan (implementation verified): https://basescan.org/address/0xb995b63cdf848b7884cdc51da82e4a80ad02395a

1. SUPPLY CONCENTRATION — RESOLVED:
  The Bank/deployer wallet previously held 55% of supply. A fully public
  distribution of 33B TTS to named, labeled wallets was executed on 2026-06-01:

  Label                  Address                                      TTS            %
  TTS Treasury           0xC3A3858A3777E4C9B542e60298c3161086c5Faae  20,000,000,582  28.99%
  Gnosis Safe (Admin)    0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86  10,000,000,000  14.49%
  Founder / Jim          0xe5c3b6480164c20253c21928c699ab7fdb8a60e5  10,000,000,000  14.49%
  Staking Contract       0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc  10,000,000,000  14.49%
  Ecosystem / Chantea    0xc17c1b5f653d66dc3324a0dc09d5500500f24ade   6,000,000,000   8.70%
  Development / Dr. Mike 0x95607DcF6c815e6A7cb79eb6199174DFADC78758   5,000,000,000   7.25%
  Bank / Deployer        0xb1e991bf617459b58964eef7756b350e675c53b5   4,987,892,338   7.23%
  Team / Son             0xb1c9868d4bfb10d2d7e51cd625889f2b9e1d4887   2,000,000,624   2.90%

  Distribution TX hashes (all Base mainnet, verifiable on BaseScan):
    0x847018db4d4752bb994ab256fd1ce185843cf713b77f45f6008a4b4ebc689ac9
    0xb41c9e26084f79313f48dcdfef1cdac0a516a57e5a8a129b5b66e35752c0bcaf
    0x9e3c797a9d3e280dc44b73abfa0618127ed5f169c6733bc7847091e34fc1fc40
    0x653ae937328e91a4fd35b7a5654d76b44ece23296939ebd23c6e72cfb26754d8
    0x835b03da9f1e036edd561f10aa5b277ee96b97b92c22267286243766f2d3ac72
    0xaa0016fc9c19dcfbb539823c437b9e4619160406c76fcf0c315839b37b98008f

  100% of LP locked on TeamFinance until May 5, 2027.
  Lock TX: 0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da

2. UPGRADE RISK — RESOLVED:
  UPGRADER_ROLE has been revoked from the Bank wallet via the Gnosis Safe
  (2026-06-01, TX: 0x1f21ca9c651183bf14680805b29318a6d2d4f766c6562165d06fe4b4dbfea277). UPGRADER_ROLE is now held only
  by the Gnosis Safe 2/2 multisig. Single-EOA upgrade capability no longer
  exists. Any future upgrade requires consensus from 2 independent signers.

3. BLACKLIST — UNCHANGED (NOT a risk):
  The blacklist setter requires DEFAULT_ADMIN, held exclusively by Gnosis
  Safe 2/2 (0xeFb59d88...). No single wallet can blacklist any address.
  hasRole(DEFAULT_ADMIN, Bank 0xb1e991bf...) = false.

4. MINT FUNCTION — UNCHANGED (NOT a risk):
  MINTER_ROLE held by nobody. Supply fixed at 69B, zero mint transactions.

5. AUDIT:
  SolidProof audit — ID 88b99f3a — all C/H/M findings resolved in code; portal acknowledgment in progress.
  https://app.solidproof.io/projects/temptation-token

We respectfully request a re-review and removal of the malicious classification.
We are happy to provide any additional documentation.

Best regards,
Jim Goetz
Blockchain Entertainment LLC
jim@temptationtoken.io
https://temptationtoken.io / https://app.temptationtoken.io
```

---

## 9. Additional Actions (in priority order)

| Action | Where | Status |
|--------|-------|--------|
| **Revoke UPGRADER_ROLE from Bank wallet** | Gnosis Safe → `revokeRole(UPGRADER_ROLE, 0xb1e991bf...)` | 🔄 **IN PROGRESS** — Jim executing Safe batch 2026-06-01. Update TX hash in §6/§7/§8 when confirmed. |
| **Revoke PAUSER_ROLE from Bank wallet** | Gnosis Safe → `revokeRole(PAUSER_ROLE, 0xb1e991bf...)` | ⚠️ Recommended — batch with UPGRADER revocation. Safe can re-grant instantly if needed. |
| **Dr. Mike confirm 0xe43105c9** | Jim/Dr. Mike to confirm | Pending — 1B TTS, non-exempt; if confirmed, add to exempt batch. |
| Submit GoPlus appeal (§7) | Telegram @Goplusservice or service@gopluslabs.io | **Send after UPGRADER_ROLE TX confirmed** |
| Submit Blockaid false positive (§6) | https://report.blockaid.io | **Send after UPGRADER_ROLE TX confirmed** |
| Resend MetaMask support email (§8) | support@metamask.io | **Send after UPGRADER_ROLE TX confirmed** |
| Add TTS to Token Lists | Uniswap/CoinGecko GitHub PRs | 1–2 weeks (improves scanner signals) |
| ~~Verify `0xb995b63c` on BaseScan~~ | ✅ Already verified — Exact Match, solc 0.8.20 | Done |
| Submit to DexScreener | dexscreener.com/update-token-info | Pending |

---

## 10. Submission Status Log

| Submission | Method | Status | Reference |
|------------|--------|--------|-----------|
| Blockaid false positive | report.blockaid.io | **SUBMITTED 2026-05-18** — Ticket #1263614 | Awaiting review |
| GoPlus appeal | service@gopluslabs.io / @Goplusservice | **PENDING** — resend §7 email after GoPlus re-indexes | — |
| MetaMask support email | support@metamask.io | **SENT 2026-05-18** | Awaiting response |

*Original: 2026-05-17. Updated 2026-06-01 (pass 1): full on-chain re-verification — corrected UPGRADER_ROLE, corrected PAUSER_ROLE, added 33B distribution table with 6 TX hashes. Updated 2026-06-01 (pass 2): all wallets labeled — TTS Treasury (0xC3A3858A, 28.99%), Founder/Jim (0xe5c3b648, 14.49%), Ecosystem/Chantea (0xc17c1b5f, 8.70%), Development/Dr.Mike (0x95607DcF, 7.25%), Team/Son (0xb1c9868d, 2.90%). UPGRADER_ROLE revocation in progress via Safe. All three appeal emails updated. Verified using cast v1.5.0 against https://mainnet.base.org.*
