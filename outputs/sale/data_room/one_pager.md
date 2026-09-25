# Temptation Token — a turnkey onchain fan-voting platform, for sale

**Blockchain Entertainment LLC · Base mainnet · jim@temptationtoken.io**
Figures verified against chain and production database, 2026-09-25.

## What it is
A weekly fan-voting game on Base. Fans vote for creator profiles with $TTS. Each round
closes on a fixed weekly calendar, Chainlink VRF picks the winner weighted by votes, the
contract splits the pool onchain (35% top voter / 35% winning profile / 10% charity /
20% house), mints three Trophy NFTs, and burns the losing votes. Every creator profile
links straight out to her own link hub.

## Live today
- Web app (`app.temptationtoken.io`), Android build, Telegram bot and channel
- Face ID sign-up with gas-free wallets; card purchases wired through Transak
- **Weekly rounds that close themselves.** Rounds 9–12 each settled within 30 minutes of
  close with no human involvement — four consecutive clean rollovers
- Club self-serve onboarding, referral engine with anti-sybil checks, Social Composer,
  admin dashboard
- SEO site with automated publishing; 21 approved creator profiles on the board

## Proof, including the unflattering parts
| | |
|---|---|
| Rounds run | **13** (12 settled onchain) |
| Settled without human intervention | rounds 9, 10, 11, 12 — consecutively |
| Trophy NFTs minted | **3** (round 7, 2026-08-17 — the first and so far only round with a winner) |
| Votes cast, all time | **3 transactions, 20 $TTS total** |
| Registered players | **23** (5 in the last 7 days) |
| Approved creator profiles | 21, of which 7 are KYC-verified |
| Uniswap v2 liquidity | 0.53 WETH a side |

**This is pre-traction infrastructure, and the numbers say so.** What is built is
complete and runs itself. What has not happened is players. A buyer is purchasing a
finished, self-operating platform and a distribution problem — not a business with
revenue. The asking price reflects that.

## Security, stated plainly
- 2-of-2 Gnosis Safe holds admin. A 48-hour OpenZeppelin timelock is designed and
  scoped, not yet deployed.
- **The token contract cannot be upgraded** — it is deployed directly, not behind a
  proxy. What runs today runs permanently.
- **No address can be blacklisted.** The contract checks a blacklist on every transfer
  but contains no function that can write to it.
- **Supply is governed, not fixed.** `mint()` exists; MINTER_ROLE has no members, but the
  Safe can grant it. We tested this on a mainnet fork. Treat 69B as current supply.
- **Known defect:** a transfer of exactly zero tokens between two non-exempt addresses
  reverts. Not patchable without a token migration, because the token is immutable.
- SolidProof audited an **earlier** voting contract (1 critical, 3 high, 7 medium, 6 low;
  the critical and all three highs remediated in a later version). The contract running
  today post-dates that audit. A re-audit pinned to the live addresses is being arranged.
- LP locked on Team.Finance until 2027-05-05.

Full detail: `outputs/audit/preaudit_2026-09-25.md`. We would rather you read that than
take our word for any of the above.

## Included in the sale
The LLC or its assets, domains, brand, full codebase, contract admin (via Safe transfer),
treasury allocation, apps and builds, brand channels subject to each platform's rules, and
30 days of transition support.

## Why it's for sale
The founder's other companies need his full attention.

## Ask
**$95K structured** (cash + earn-out) or **$65K all-cash**.
Offers reviewed **Friday, October 16, 2026**.

Contact: jim@temptationtoken.io · calendly.com/temptationtoken/phone-meeting
