# PHASE 4 — Staking launch announcement (DRAFT ONLY — HOLD until Jim says "announce")

All numbers below are the values encoded on-chain or in `staking/src/TTSStaking.sol`.
Nothing here is posted. Do not post without the explicit word "announce".

**Verify immediately before posting** (they change with migration progress):
- `TTS.balanceOf(0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d)` == 10,000,000,000 TTS
- `V3d.stakingContract()` == `0x7848cc…` · `paused()` == false
- staking page live on `app.temptationtoken.io` (`STAKING_ENABLED` flipped)

Placeholders `{{POOL}}` / `{{TVL}}` must be replaced with real reads, not estimates.

---

## X / Twitter — @temptationtoken

**Post 1 — launch**

> $TTS staking is live.
>
> Stake $TTS → earn $TTS, and multiply your voting power in the weekly round.
>
> • Bronze 6,000 TTS — 8% APR — 1.1× votes
> • Silver 12,000 TTS — 12% APR — 1.25× votes
> • Gold 30,000 TTS — 18% APR — 1.5× votes
> • Diamond 120,000 TTS — 32% APR — 2× votes
> • VIP 600,000 TTS — 45% APR — 3× votes
>
> Your principal is never locked. Unstake any time.
>
> app.temptationtoken.io

**Post 2 — the 7-day rule (post ~1h later, quote-tweet Post 1)**

> One rule worth knowing:
>
> Rewards start accruing the second you stake. The vote multiplier unlocks after 7 days
> at that amount — and topping up restarts that 7-day clock.
>
> Principal is NEVER locked. Unstake whenever you want, tier or no tier.

**Post 3 — trust / contracts (post ~1 day later)**

> Where the staking rewards come from, and who can touch them:
>
> • 10,000,000,000 $TTS reward pool, funded on-chain — not minted, no mint function exists
> • Staked principal is accounted separately and can never be paid out as rewards
> • Upgrades sit behind a 2-of-2 Gnosis Safe + a 2-day timelock
> • Contract verified on Base
>
> Staking: 0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d
> Impl: 0x147f4a1238f600eee143a90aba91f6b66f8fb53b

---

## Telegram — @temptationtoken channel

> **🔓 $TTS STAKING IS LIVE**
>
> Stake $TTS. Earn $TTS. Vote harder.
>
> **Tiers — stake amount · APR · vote multiplier**
> 🥉 Bronze — 6,000 TTS — 8% — 1.1×
> 🥈 Silver — 12,000 TTS — 12% — 1.25×
> 🥇 Gold — 30,000 TTS — 18% — 1.5×
> 💎 Diamond — 120,000 TTS — 32% — 2×
> 👑 VIP — 600,000 TTS — 45% — 3×
>
> **How it works**
> • Rewards accrue from the moment you stake, paid in $TTS
> • The vote multiplier activates after **7 days** at that stake amount — adding more
>   restarts the 7-day clock
> • **Your principal is never locked** — unstake any time, rewards or tier aside
> • Claim rewards whenever you like
>
> **The reward pool**
> 10,000,000,000 $TTS is funded into the staking contract as the rewards budget. $TTS has
> no mint function — nothing is being printed for this. Staked principal is tracked
> separately from the reward surplus, so it can never be paid out to someone else.
>
> **Security**
> Contract verified on Base. Upgrade authority is a 2-of-2 Gnosis Safe behind a 2-day
> timelock — no single key can change the contract.
>
> Staking contract: `0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d`
>
> 👉 Stake now: app.temptationtoken.io

---

## Copy rules honored
- No prize-split numbers mentioned → no "40% near prize words" risk (`check-prize-split.mjs` safe).
- APRs stated as the on-chain `aprBps` values; no compounding or USD projections claimed.
- Tier thresholds stated in **TTS**, not USD — the Uniswap pool (last swap 2026-04-02,
  ~$1.9k liquidity) is not a credible price oracle, so no "$50 to start" style claim.
- APRs are governance-adjustable via `setAprBps`; copy says what they are today, and
  makes no promise that they are permanent.
