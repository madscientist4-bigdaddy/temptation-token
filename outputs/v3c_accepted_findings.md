# TTSVotingV3c — Accepted Security Findings

Findings listed here have been reviewed, assessed non-exploitable, and formally accepted by the project decision-maker. They are retained as a permanent audit record. Each finding must be re-evaluated if the contract's token dependency, external integrations, or access model changes.

---

## AF-001 — Slither HIGH: Reentrancy-ETH in `TTSVotingV3c.vote()`

| Field | Value |
|-------|-------|
| **Tool** | Slither 0.11.3 |
| **Detector** | `reentrancy-eth` (reentrancy-vulnerabilities-1) |
| **Severity** | HIGH (Slither classification) |
| **Location** | `contracts/TTSVotingV3c.sol`, function `vote()`, lines 498–534 |
| **Status** | **ACCEPTED — not exploitable** |
| **Decision by** | Jim Goetz |
| **Decision date** | 2026-05-18 |

### Finding Description

Slither flags a CEI (Checks-Effects-Interactions) violation: an external call to `ttsToken.safeTransferFrom(msg.sender, address(this), amount)` at line 517 precedes state writes (`p.rawVotes`, `p.totalTickets`, `r.totalRawVotes`, `r.totalTickets`, `_voterTotals`) at lines 521–526. In a classic reentrancy scenario, a malicious token could call back into `vote()` before state is updated, allowing a voter to cast inflated votes.

### Why It Is Not Exploitable

1. **No reentrant call vector in TTS.** The token at `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` is a standard OpenZeppelin ERC-20. Its `transferFrom` function does not call any external hook, callback, or `onTokenReceived`. There is no ERC-777 receiver interface, no flash-loan callback, and no arbitrary external call path triggered during transfer.

2. **Token source is controlled and known.** `ttsToken` is set at constructor time as an immutable-equivalent state variable and cannot be changed. It points to the audited TTS contract. An attacker cannot substitute a malicious token.

3. **Identical pattern in audited V3b.** TTSVotingV3b (`0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`) has been live on Base mainnet since **2026-05-06** with the same CEI pattern in `vote()`. SolidProof's audit of V3b (audit ID `88b99f3a`, all findings resolved) did not raise this as a required remediation, confirming external review agreement that the pattern is safe given the token dependency.

4. **Zero incidents since V3b deployment.** No reentrancy exploit or anomalous vote inflation has been observed across all rounds on V3b.

### Conditions for Re-evaluation

This accepted finding must be re-evaluated if:
- The TTS token implementation is upgraded to one that introduces transfer hooks or callbacks
- `stakingContract` is replaced with a contract that makes external calls during `getStakingTier()`
- A new ERC-777 or similar token is used in place of TTS

### Remediation (if ever required)

Apply CEI by moving `ttsToken.safeTransferFrom(...)` to after all state writes, or add a `nonReentrant` modifier (requires adding OZ ReentrancyGuard or inline mutex). No code change is required at this time.

---

*Document last updated: 2026-05-18*
