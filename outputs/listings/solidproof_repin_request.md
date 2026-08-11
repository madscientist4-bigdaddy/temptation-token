# SolidProof — re-pin / scope-extension request

**To:** the SolidProof contact on the original engagement thread (audit ID `88b99f3a`).
If that thread is gone: `support@solidproof.io`, with the audit ID in the first line.

**Why this exists:** the published report records no contract address, no network and no
compiler version, so it cannot be shown to cover the bytecode actually deployed at
`0x5570eA97…`. Blockaid and CoinGecko both check that. Until it is pinned, the report is
not usable as evidence — which is why the Blockaid correction explicitly declines to cite
it (`outputs/listings/blockaid_correction.md`).

**Two asks, in priority order:** (1) re-pin the existing report to the exact deployed
address/compiler — cheap, fast, fixes the evidentiary gap; (2) extend scope to the
contracts audited after the report was issued. Ask 1 alone unblocks the listings work.

---

## Email body — copy from here

**Subject:** `Audit 88b99f3a — request to re-pin report to deployed address + scope extension`

Hello,

We engaged SolidProof for audit **88b99f3a** (Temptation Token / $TTS). We have two
requests, and I want to be direct about what is driving them.

**1. Please re-pin the report to the exact deployed contracts.**

As published, the report does not state a contract address, a network, or a compiler
version. That means it cannot be shown to cover any particular deployment. Two external
reviewers — a security vendor and an exchange listing team — have both raised this, and
we have had to tell them we cannot cite the report as evidence for our live contracts.
We would much rather fix that than keep saying it.

Concretely, we are asking for a revision that names, for each audited contract:

- the deployed address and chain ID,
- the compiler version and optimizer settings the audited source was built with,
- the source hash or verified-source link the review was performed against.

The deployment the report should be pinned to:

| Contract | Address | Chain |
|---|---|---|
| TTS token | `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` | Base, 8453 |
| TTSVotingV3d (current voting contract) | `0x783b8cd80b586b723188c93ef94ee1beede617b4` | Base, 8453 |

Build settings for the voting contract: solc 0.8.20, optimizer ON (200 runs), viaIR OFF,
evmVersion `paris`.

There is one more thing you should know before you re-pin, because it affects what the
revision can honestly say: several findings in the current report do not match the
deployed bytecode — in **both** directions. Some describe behaviour we cannot locate in
the deployed contract, and at least one real capability of the deployed token is not
covered at all. Specifically, the token contains `mint` (gated by `MINTER_ROLE`),
`pause`/`unpause` (gated by `PAUSER_ROLE`), and a `blacklisted` mapping that is read on
the transfer path but has no setter anywhere in the contract. We have documented all three
publicly rather than wait to be caught on them. If the original review did not cover the
token at this address, please say so plainly in the revision instead of pinning around it
— an accurate narrow scope is worth more to us than a broad one we cannot defend.

**2. Please quote for extending scope to the contracts deployed since.**

These are live on Base mainnet and are outside the current report:

| Contract | Address | Notes |
|---|---|---|
| TTSVotingV3d | `0x783b8cd80b586b723188c93ef94ee1beede617b4` | current voting contract; Chainlink VRF consumer; holds prize distribution |
| TTSKeeper3 | `0x363ce4960e3b459f5892587a37ae1ff2ed04442c` | Chainlink Automation; owns V3d |
| TTSStaking (UUPS proxy) | `0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d` | holds a 10B TTS reward pool; impl `0x147f4a12…`, Sourcify exact_match |
| Staking TimelockController | `0xa4fbf397485763e39102dcfaefcbf9794df55875` | 2-day delay; holds `UPGRADER_ROLE` on the staking proxy |
| TTSRoundNFT (trophy) | `0x02DDd0e63DC2A5F66Fdb5a46F5981191959AC9A5` | minted by V3d on settlement |

For context on privileged control, current on-chain state as of 2026-08-11: the token's
`DEFAULT_ADMIN_ROLE` and `UPGRADER_ROLE` are held solely by a 2-of-2 Gnosis Safe
(`0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`); `PAUSER_ROLE` and `MINTER_ROLE` have no
holder; the original deployer wallet has been fully revoked. On the staking proxy,
`DEFAULT_ADMIN` is the Safe and `UPGRADER` is the timelock above.

We also have one accepted finding we would want re-examined rather than quietly carried
forward: Slither reports `reentrancy-eth` in `vote()` on the voting contract. We accepted
it on the grounds that TTS is a standard ERC-20 with no transfer hooks and the token
address is immutable in the voting contract. If you disagree with that reasoning, we would
rather hear it from you now.

Could you send back:

- whether the re-pin in request 1 is possible against the existing engagement, and the
  timeline;
- a quote and lead time for request 2;
- whether you offer a re-audit that supersedes 88b99f3a entirely, and what that costs —
  if the cleanest outcome is a fresh report rather than a patched one, we would consider it.

Thank you,

Jim Goetz
Blockchain Entertainment LLC
jgoetz@functionised.com

## Copy to here

---

## Notes before sending

- **Request 1 is the one that matters.** It costs SolidProof little and removes the exact
  objection Blockaid and CoinGecko raised. Do not let a quote negotiation on request 2
  delay it — if they are slow on 2, ask them to ship 1 on its own.
- **Do not soften the mismatched-findings paragraph.** The Blockaid correction already
  states publicly that the report's findings do not match the deployed bytecode. Telling
  SolidProof something different than we told a security vendor is exactly the failure
  mode this whole correction exists to fix.
- If they decline to re-pin, that answer is itself useful: it settles whether to commission
  the independent audit the Blockaid letter promises, rather than keep both options open.
