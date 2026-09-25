# Replacement cost — what a buyer skips
**Built from this repository's git history, 2026-09-25.** Every figure below is either a
count from the repo or a stated rate assumption. Nothing is modelled from revenue,
because there is none.

## What the history says
| | |
|---|---|
| First commit | **2026-03-18** |
| Latest commit | 2026-09-25 |
| Elapsed | **6.3 months** |
| Commits | **364** |
| Contributors | **1** |
| Original code | **46,925 lines across 209 files** |

Vendored dependencies, build output and generated artifacts are excluded. Counting them
would give ~110,000 lines, and it would be a lie — `trophy/lib/forge-std` alone is 77,000
lines of somebody else's code.

Commit cadence: Mar 33 · Apr 61 · May 74 · Jun 42 · Jul 27 · **Aug 114** · Sep 13.

## Original code by component
| Component | Files | Lines |
|---|---|---|
| Web app — React SPA (Vite, wagmi/viem) | 22 | 11,201 |
| Serverless API — 12 Vercel functions | 16 | 5,878 |
| Ops, deploy and verification scripts | 36 | 4,273 |
| Outreach engine — Python (two iterations) | 32 | 7,306 |
| Mobile app — Expo / React Native | 31 | 3,791 |
| Solidity — live contracts | 7 | 3,155 |
| Solidity — superseded versions (V3, V3b, NFT) | 22 | 2,995 |
| Staking tooling | 12 | 1,965 |
| WordPress plugin — PHP | 4 | 1,779 |
| Promo asset tooling | 7 | 1,491 |
| Shared server libraries | 14 | 1,455 |
| Solidity tests | 3 | 1,066 |
| Telegram bot — Python | 1 | 452 |
| **Total** | **209** | **46,925** |

## Replacement estimate
Rates are US/EU contract market, 2026. A buyer should substitute their own.

| Workstream | Basis | Rate | Cost |
|---|---|---|---|
| Solidity: voting, keeper, NFT, staking, VRF integration, 20 tests | 6 weeks senior Solidity | $150/hr × 240h | **$36,000** |
| Security audit (third party, phase 1) | market quote | — | **$8,000–15,000** |
| React web app: wallet connect, gasless, voting, submissions, admin dashboard, chatbot | 8 weeks senior frontend | $110/hr × 320h | **$35,200** |
| Serverless API, 12 functions: KYC, bonuses, referrals with anti-sybil, profile sync, scheduler, keeper autopilot | 5 weeks backend | $120/hr × 200h | **$24,000** |
| Mobile app (Expo, iOS + Android configured, privacy manifests) | 3 weeks | $110/hr × 120h | **$13,200** |
| Telegram bot + Railway deployment | 1 week | $100/hr × 40h | **$4,000** |
| Automation: settlement autopilot, VRF auto-funder, watchdogs, launchd schedules | 2 weeks | $130/hr × 80h | **$10,400** |
| SEO site, WordPress plugin, automated publishing, schema | 2 weeks | $90/hr × 80h | **$7,200** |
| Outreach engine + CRM plumbing | 2 weeks | $100/hr × 80h | **$8,000** |
| Deployment, wallet setup, multisig, LP lock, contract verification | 1 week | $130/hr × 40h | **$5,200** |
| Legal: entity, terms, privacy, DMCA, trademark guide, risk memo | drafted in-house | — | **$3,000–8,000** if bought |
| **Engineering + audit subtotal** | | | **$154,200–168,200** |

### Costs a buyer does not repeat
| Item | Note |
|---|---|
| Six months of elapsed calendar time | The part money cannot compress. Four of the six months were spent finding out what breaks in production — a dead Chainlink integration, a VRF stall, a settlement outage — and each answer is in the repo. |
| Contract deployment gas, LP lock, verification | Sunk, on-chain, done |
| 10-billion-$TTS staking reward pool | Migrated and funded |
| VRF subscription | Funded with 32.76 LINK (~69,000 draws) |
| Chainlink LINK | 43.97 reclaimable + 9.16 in the Bank |
| Google Play / Apple groundwork | iOS compliance complete in-repo; privacy manifests, purpose strings, encryption declaration |
| Operations documentation | `CLAUDE.md` + `CLAUDE_HISTORY.md`, written for AI-assisted maintenance |

## Against the asking price
- Replacement engineering and audit: **$154,200–168,200**
- Asking price: **$95,000 structured** or **$65,000 all-cash**

All-cash is roughly **42%** of the low replacement estimate — and that is before the six
months of calendar time, the deployed contracts, the funded pools and the entity.

**What replacement cost does not buy, and this is the honest caveat:** an audience. The
platform has 23 registered players and 3 lifetime votes. A buyer paying below replacement
cost is buying a working machine and accepting that distribution is entirely their problem.
That is the trade, and it is why the price is what it is.

## Reproduce this
```
git log --reverse --format=%ad --date=short | head -1     # first commit
git rev-list --count HEAD                                 # commits
git log --format=%an | sort -u                            # contributors
```
Line counts exclude any path containing `node_modules/`, `/vendor/`, `/out/`, `/cache/`,
`/artifacts/`, `lib/forge-std`, `lib/openzeppelin`, or `outputs/`.
