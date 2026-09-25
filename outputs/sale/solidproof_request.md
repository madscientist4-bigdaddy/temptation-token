# SolidProof — quote request (draft for Jim to send)

**To:** contact@solidproof.io (cc support@solidproof.io)
**Subject:** Re-audit quote — Temptation Token (Base), existing project 88b99f3a

---

Hello,

We have an existing SolidProof audit for Temptation Token (audit `88b99f3a`, listed at
app.solidproof.io/projects/temptation-token). I'd like a quote to re-audit against what
is actually deployed today, and I want to be direct about why.

**The audited contract is not the contract that is running.** The report covers
TTSVoting. Since then we deployed TTSVotingV3c and then V3d, and V3d is what settles
every round. We also believed a token fix had shipped as an upgrade; on re-checking the
chain this week we found the token is not behind a proxy at all, so that upgrade never
took effect and the deployed token has never matched any audited source.

I'd rather pay to have that stated correctly than keep a report that points at the wrong
address.

**Phase 1 — the live game**
| Contract | Address | Notes |
|---|---|---|
| $TTS token | `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` | ERC-20, 1% transfer tax, AccessControl. **Deployed directly, not behind a proxy** — please confirm independently. |
| TTSVotingV3d | `0x783b8cd80b586b723188c93ef94ee1beede617b4` | Weekly rounds, Chainlink VRF settlement, 35/35/10/20 split, NFT minting |
| TTSKeeper3 | `0x363ce4960e3b459f5892587a37ae1ff2ed04442c` | Owns V3d; `manualExecute` is `onlyOwner` |

**Phase 2 — later, separately quoted**
| Contract | Address |
|---|---|
| TTSStaking proxy | `0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d` (impl `0x147f4a12…`) |
| Trophy NFT | `0x02DDd0e63DC2A5F66Fdb5a46F5981191959AC9A5` |

All on Base mainnet (8453), all verified on BaseScan.

**Findings we already know about, so you can price accurately rather than discover them:**
1. `mint()` exists and is gated on MINTER_ROLE, which has no members — but
   DEFAULT_ADMIN_ROLE (a 2-of-2 Gnosis Safe) can grant it. Supply is governed, not fixed.
   We are moving admin behind a 48-hour OpenZeppelin TimelockController.
2. A transfer of exactly zero tokens between two non-tax-exempt addresses reverts with
   an arithmetic panic. Because the token is not upgradeable, we cannot patch this; we
   intend to disclose it rather than hide it.
3. The contract checks a `blacklisted` mapping on every transfer but contains **no
   function that can write to it**. We would value an explicit statement to that effect
   in the report — automated scanners flag the mapping, and an auditor confirming it is
   unreachable is the cleanest way to resolve those flags.
4. A reentrancy pattern in `vote()` that we have accepted as non-exploitable: $TTS has no
   transfer hooks and its address is immutable in the voting contract. Recorded as AF-001.

**What I'm asking for**
1. Price and lead time for phase 1, and separately phase 2.
2. Whether an expedited turnaround is available, and what it costs.
3. Confirmation the report will be **pinned to the deployed addresses above and to a
   named git commit**, so the audited artifact and the running artifact are the same
   thing this time.
4. Pricing for KYC — our TrustNet score is 0.01 and I understand KYC is most of that gap.

**One correction to your listing:** the TrustNet page for us still describes the prize
split as "40% of the weekly prize pool. Winners take 40%." It has been 35% top voter /
35% winning profile / 10% charity / 20% house for some time. Could you update it?

Docs and source are ready to send on request.

Thanks,
Jim Goetz
Blockchain Entertainment LLC
jim@temptationtoken.io
