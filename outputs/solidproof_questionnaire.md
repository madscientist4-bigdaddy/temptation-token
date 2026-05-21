# SolidProof Questionnaire — Temptation Token ($TTS)

**Generated:** 2026-05-20  
**Audit ID:** 88b99f3a  
**Portal:** app.solidproof.io/projects/temptation-token  
**Account email for recovery:** jgoetz@functionised.com  
**Recovery contact:** support@solidproof.io | Telegram @Solidproof_io_Support

---

## E1 — Full SolidProof Questionnaire Answers

### Project Overview
- **Project Name:** Temptation Token ($TTS)
- **Token Symbol:** TTS
- **Blockchain:** Base (chainId 8453)
- **Token Contract (UUPS Proxy):** `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`
- **Active Implementation:** `0xb995b63cdf848b7884cdc51da82e4a80ad02395a` (v2, live 2026-05-17)
- **Total Supply:** 69,000,000,000 TTS (fixed — no MINTER_ROLE holders, no mint function)
- **Transfer Tax:** 1% (permanent, hardcoded, cannot be changed)
- **LP Locked:** 231.3 LP tokens (100%) locked on Team.Finance until 2027-05-05 — TX `0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da`

### Governance / Admin
- **Admin role:** Gnosis Safe 2/2 multisig `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`
- **DEFAULT_ADMIN_ROLE:** Held by Gnosis Safe only ✅
- **MINTER_ROLE:** No holders (address(0)) ✅
- **UPGRADER_ROLE:** No holders (address(0)) ✅
- **PAUSER_ROLE:** Held by Bank wallet `0xb1e991bf...` (low risk; admin role held by Safe)

### Game Mechanics
- **Game type:** Weekly "Hot or Not" voting game on Base
- **Voting:** Users spend real TTS tokens to vote on submitted photo profiles
- **Prize pool:** Winning profile's votes only (losing-profile votes burn to 0x000...dEaD)
- **Prize split:** 35% top voter / 35% winning profile / 10% Polaris Project (charity) / 20% house
- **Winner selection:** Chainlink VRF v2.5 (verifiable random, ticket-weighted)
- **Minimum vote:** 5 TTS
- **Submission fee:** 5 TTS (off-chain transfer, not in voting contract)

### Audit Status
- **Audit ID:** 88b99f3a (SolidProof)
- **TrustNet Score:** 0.01 (findings not yet acknowledged on portal — portal access recovery pending)
- **All code fixes implemented** in TTSVotingV3b (active contract)
- **All voting contract critical/high findings resolved** — see E2 below
- **V3c pending deployment** — same fixes, adds Diamond/VIP multiplier corrections + 3-NFT mints

---

## E2 — Finding-by-Finding Status

### TTSVoting Contract Sub-Report

| Portal ID | Severity | Finding | Fixed? | Version | Notes |
|-----------|----------|---------|--------|---------|-------|
| C-1 | Critical | Vote cap check prevents any vote when pool is empty | **YES** | V3b | Cap skipped on first vote per round |
| H-1 | High | Settlement callback gas limit bricks contract (500k → OOG) | **YES** | V3b | CALLBACK_GAS_LIMIT raised to 2,500,000 |
| H-2 | High | Zero wallet address can trap funds | **YES** | V3b | `require(wallet != address(0))` in approve + batch |
| H-3 | High | ERC-20 transfer return values unchecked | **YES** | V3b | SafeERC20 inline library, all transfers use safeTransfer/safeTransferFrom |
| M-1 | Medium | Admin can redirect club share during VRF window | **Acknowledged** | V3b | Accepted risk: admin is Gnosis Safe 2/2; no single-key exploit path |
| M-2 | Medium | NFT contract can be set to gas-bomb settlement | **YES** | V3b | `try mint{gas:200000}(...) {} catch {}` gas cap added |
| M-3 | Medium | Round unrecoverable if VRF never delivers | **YES** | V3b | `adminResetSettlement(roundId)` allows owner to reset stuck VRF after 1 day |
| M-4 | Medium | Single-step ownership with reachable renounceOwnership | **Acknowledged** | V3b | Owner is keeper contract; renounceOwnership cannot be called via keeper |
| M-5 | Medium | State changes after external transferFrom in vote() (CEI) | **Accepted — AF-001** | V3b/V3c | TTS is standard ERC-20, no hooks; documented in `outputs/v3c_accepted_findings.md` |
| M-6 | Medium | rolloverRound executes before round end | **YES** | V3b | `require(block.timestamp >= r.endTime)` added |
| M-7 | Medium | Payout destinations mutable during VRF window | **Acknowledged** | V3b | Accepted risk: owner is Gnosis Safe 2/2; admin mutation during VRF window requires 2/2 signatures |
| L-1 | Low | Zero-address input to constructors | **YES** | V3b | Zero-address checks in constructor |
| L-2 | Low | Missing events on admin setters | **YES** | V3b | CharityWalletUpdated, HouseWalletUpdated, NFTContractUpdated events added |
| L-3 | Low | Pragma not locked | **YES** | V3b | `pragma solidity 0.8.20;` |
| L-4 | Low | Unused state variables | **YES** | V3b | Removed |
| L-5 | Low | Magic numbers | **Acknowledged** | V3b | In-source constants documented; named constants in V3c |
| L-6 | Low | Informational | **Acknowledged** | V3b | No code change required |
| O-1 to O-3 | Optimization | Storage packing, custom errors, magic numbers | **Acknowledged** | V3b | Noted for future versions |
| I-1 to I-8 | Informational | Various | **Acknowledged** | V3b | No action required |

**C-1 Status: RELEASE-BLOCKING until acknowledged on portal AND V3c deployed.**  
C-1 is fixed in code but the portal shows it unacknowledged. Portal access recovery (support@solidproof.io) is required before C-1 can be marked resolved on-portal.

### TTS Token Contract Sub-Report

| Portal ID | Severity | Finding | Fixed? | Notes |
|-----------|----------|---------|--------|-------|
| Token M-1 | Medium | Zero-value transfer bypass (EIP-20 violation) | **YES — LIVE** | v2 implementation deployed 2026-05-17 via Gnosis Safe nonce 0; BaseScan verified |
| Token M-2 | Medium | Centralized wallet update (owner can change fee recipient) | **Mitigated** | Owner is Gnosis Safe 2/2; no single-key exploit |
| Token M-3 | Medium | Rounding dust on 1% tax | **Acknowledged** | Dust is negligible at token scale; behavior is EIP-20 compliant |
| Token L/I | Low/Info | Various | **Acknowledged** | — |

---

## Acknowledgment Submission Order (once portal access restored)

1. Recover portal access: email support@solidproof.io from jgoetz@functionised.com
2. Log in and navigate to both sub-reports (TTSVoting + Token — they are SEPARATE sub-reports with separate finding IDs)
3. **WARNING:** The pre-written responses in `outputs/seo/solidproof_acknowledgment_responses.md` use M-1/M-2/M-3 labels matching the TOKEN sub-report. Do NOT submit them on the voting contract sub-report without remapping to the correct portal IDs.
4. For each finding: click Acknowledge → paste response → reference commit hash where applicable
5. After all findings acknowledged: TrustNet score should improve significantly
6. KYC ($600): start after acknowledgments. Checklist: `outputs/urgent/solidproof_kyc_checklist.md`

---

*Document last updated: 2026-05-20*
