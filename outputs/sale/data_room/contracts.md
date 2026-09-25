# Contracts — Temptation Token (Base mainnet, chain id 8453)
Read from chain 2026-09-25. BaseScan: `https://basescan.org/address/<addr>`

| Contract | Address | Role | Upgradeable |
|---|---|---|---|
| $TTS token | `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` | ERC-20, 69B supply, 1% transfer tax | **No — deployed directly, no proxy** |
| TTSVotingV3d | `0x783b8cd80b586b723188c93ef94ee1beede617b4` | Rounds, VRF settlement, payouts, NFT mint | No |
| TTSKeeper3 | `0x363ce4960e3b459f5892587a37ae1ff2ed04442c` | Owns V3d; calendar-pinned settlement | No |
| Trophy NFT | `0x02DDd0e63DC2A5F66Fdb5a46F5981191959AC9A5` | 3 minted | No |
| TTSStaking proxy | `0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d` | Holds the 10B reward pool; **gated off in all clients** | **Yes** → `0x147f4a1238f600eee143a90aba91f6b66f8fb53b` |
| Staking timelock | `0xa4fbf397485763e39102dcfaefcbf9794df55875` | 2-day delay, Safe proposer/executor | — |
| Gnosis Safe 2/2 | `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86` | DEFAULT_ADMIN, UPGRADER | — |
| Uniswap v2 pool | `0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68` | WETH/TTS, LP locked to 2027-05-05 | — |

## Retired — do not use
`TTSVotingV3b 0x6d6fF6A0…`, `TTSVotingV3c 0x916984DB…`, `TTSVotingV2 0x4dE347D5…`,
`TTSKeeper2 0xB17b3842…`, `TTSRoundNFT 0x0768e862…` (6 legacy mints),
`TTSStaking old proxy 0xaA12B889…` (drained to zero).

## Two addresses a technical buyer should look at
- `0xb995b63cdf848b7884cdc51da82e4a80ad02395a` — a token implementation deployed
  2026-05-17 intending to fix the zero-value-transfer defect. **Nothing delegates to it.**
  It is orphaned, and its `initialize()` is unprotected. Never point a proxy at it.
- `0x7f52386781Cd5c01a1f6A0B4fB028ab7598a3Bd1` — an empty Uniswap v3 WETH/TTS pool at the
  1% fee tier, initialized at an implausible price with zero liquidity and no tax
  exemption. Harmless while empty. Never fund it.

## Wallets
| Label | Address | Holds |
|---|---|---|
| Bank / Deployer | `0xb1e991bf617459b58964eef7756b350e675c53b5` | house cut, PAUSER, keeper signer |
| Marketing / Bonus | `0x7a9ff2f584248744cBbA32c737D660ED6f077fCB` | signup bonus + vote match payer |
| Polaris / Charity | `0xf7dd429d679cb61231e73785fd1737e60138aba3` | 10% charity cut |
| Treasury | `0xC3A3858A3777E4C9B542e60298c3161086c5Faae` | 20B TTS — **an ordinary wallet, not Safe-controlled** |
| Gnosis Safe | `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86` | 10B TTS + admin |
