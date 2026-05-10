# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Last verified: May 10, 2026 — contract audit + canonical value lock.

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build

python tts_bot.py  # Run Telegram bot worker (separate process)
node scripts/check-prize-split.mjs  # CI: check for canonical-value violations
```

## Architecture

**Temptation Token ($TTS)** is a Web3 "Hot or Not" voting game on Base mainnet. Users submit photos, others vote by spending TTS tokens, and stakers earn yield.

### Three distinct systems

1. **React SPA** (`/src`) — Vite + React 19, deployed to Vercel. All on-chain interaction (votes, staking, airdrop claims) happens directly from the frontend via Wagmi/Viem — there is no intermediary server for contract calls.

2. **Vercel serverless** (`/api`) — Routes:
   - `/api/chat.js` — Proxies to Claude Haiku with `web_search` tool for the support chatbot
   - `/api/rpc.js` — Caches RPC calls to Base to reduce provider load
   - `/api/notify.js` — Sends Telegram admin notification on new submission
   - `/api/social-post.js` — Posts to X and/or Telegram; `{type,data}` template mode, `{platform:'telegram',content}` direct Telegram, `{platform:'x_tts',content}` direct @temptationtoken X post
   - `/api/scheduler.js` — Fires at 00, 13, 18, 19 UTC daily (4 Vercel crons): fires approved scheduled_posts + 19:00 Telegram round status + auto-correction alerts
   - `/api/content-generator.js` — Monday 8am UTC: generates @temptationtoken 21 posts for the week (templates, status=approved). POST `{force:true}` or `{tts_bootstrap:true}` to regenerate. @CryptoFitJim posts manually — no auto-generation.
   - `/api/referral-credit.js` — Credits referrer wallet on new user signup. Uses `referral_credits` table.
   - `/api/community-stats.js` — Returns Telegram community member count via bot API
   - `/api/signup-bonus.js` — POST `{ walletAddress }`: sends fixed TTS amount (default 500, admin-configurable via `admin_config` table) from Marketing wallet on first connect. 20/day rate limit. Records in `bonus_claims` table. Requires `MARKETING_WALLET_PRIVATE_KEY` in Vercel env.
   - `/api/vote-match.js` — POST `{ walletAddress, voteAmount, txHash }`: matches first-ever vote up to cap (default 1,000 TTS, admin-configurable) from Marketing wallet. 50/day rate limit. Records in `bonus_claims` table. Requires `MARKETING_WALLET_PRIVATE_KEY`.

3. **Python Telegram bot** (`tts_bot.py`) — Runs as a separate worker (Procfile). Uses SQLite locally and integrates with the same Supabase instance.

### Frontend structure

- `src/App.jsx` — The entire main voting UI, including all contract ABIs and addresses as constants at the top of the file. This is intentionally monolithic.
- `src/TTAdminDashboard.jsx` — Password-protected admin panel. Tabs: Command Center, Daily Priorities, KPI Dashboard, Operations Manual, Overview, Photo Review, Content Calendar, Social Media, System Health, Payouts, Staking, Wallets, Referrals, Users, Settings. Password: `TTS2026Admin!`
- `src/TTSChatbot.jsx` — Claude-powered floating support chatbot, calls `/api/chat`
- `src/config/Wallet.js` — Wagmi + ReownAppKit (WalletConnect) config, Base chain only

### Data layer

- **Supabase** (`gmlikdxykgviyprqtqwz`) — Primary app database. Tables: `users`, `submissions`, `votes`, `rounds`, `stakes`, `scheduled_posts`, `bonus_claims`, `referral_settings`, `referral_credits`, `referrals`, `outreach_queue`, `admin_config`, `admin_audit_log` (all created as of May 10 2026).
- **SQLite** — Used only by the Telegram bot worker.
- **Smart contracts on Base mainnet** — Token, Voting, Staking, Airdrop, NFT. Addresses are hardcoded constants in `App.jsx`.

### Wallet / Web3

- Chain: Base mainnet only (chainId 8453)
- Wallet connection: `@reown/appkit` with Wagmi adapter
- Contract reads/writes: Viem directly from the browser, no backend relay

### AI integration

The chatbot (`/api/chat.js`) uses `claude-haiku-4-5-20251001` with streaming disabled. The model has access to a `web_search` tool. The system prompt is defined inline in the API route.

---

## Active Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| **TTS Token (UUPS Proxy)** | `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` |
| TTS v2 Implementation (M1 fix, pending upgrade) | `0xb995b63cdf848b7884cdc51da82e4a80ad02395a` |
| TTSVotingV2 (deprecated) | `0x4dE347D547C7Ae2CB38c42A8166d29049C24e9DA` |
| TTSVotingV3 (deprecated) | `0x49385909a23C97142c600f8d28D11Ba63410b65C` |
| **TTSVotingV3b (ACTIVE — FINAL, all audit fixes)** | **`0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`** |
| TTSKeeper2 | `0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48` |
| TTSLinkReserve | `0xE8006d8F36827c97fd8f2932d4D2198B833A432F` |
| **TTSRoundNFT** | **`0x0768e862D3AB14d85213BfeF8f1D012E77721da2`** |
| TTSStaking | `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc` |
| Gnosis Safe (2/2 multisig) | `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86` |
| Uniswap V2 Pool | `0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68` |

## Wallets

| Label | Address | Purpose |
|-------|---------|---------|
| Bank / Deployer | `0xb1e991bf617459b58964eef7756b350e675c53b5` | Owner, house wallet, receives house cut of prize pool |
| Marketing / Bonus | `0x7a9ff2f584248744cBbA32c737D660ED6f077fCB` | Signup bonus + vote-match payments |
| Polaris / Charity | `0xf7dd429d679cb61231e73785fd1737e60138aba3` | Receives 10% charity cut every settlement |

---

## Verified Contract Behavior (May 10 2026 Audit)

Contract: TTSVotingV3b at `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`
Source: `/TTSVotingV3b.sol` (local, unverified on BaseScan as of May 10)

### Q: Where do votes go? (vote() function)
`ttsToken.safeTransferFrom(msg.sender, address(this), amount)` — all voted TTS accumulates in the voting contract until settlement. [TTSVotingV3b.sol:508]

### Q: How is the prize pool calculated?
`uint256 pool = winner.rawVotes;` — prize pool = **winning profile's votes only**. Losing-profile votes are NOT included. [TTSVotingV3b.sol:440]

### Q: What happens to losing-profile votes?
After paying out winners: `remaining = ttsToken.balanceOf(address(this)); ttsToken.safeTransfer(0x000000000000000000000000000000000000dEaD, remaining)` — all votes on non-winning profiles are burned to the dead address. [TTSVotingV3b.sol:478-481]

### Q: Prize split percentages?
```
profileShare = pool * 35 / 100   → winner.wallet (winning profile)
voterShare   = pool * 35 / 100   → winner.topVoter (or winner.wallet if no top voter)
charityShare = pool * 10 / 100   → charityWallet
clubShare    = pool * 10 / 100   → clubWallet (only if club code registered)
houseShare   = remainder (20% no club, 10% with club)  → houseWallet
```
[TTSVotingV3b.sol:443-456]

### Q: House wallet address?
`houseWallet = 0xb1e991bf617459b58964eef7756b350e675c53b5` (Bank/Deployer wallet) — verified on-chain May 10.

### Q: Charity wallet address?
`charityWallet = 0xf7dd429d679cb61231e73785fd1737e60138aba3` (Polaris/Charity) — verified on-chain May 10.

### Q: NFT mints at settlement?
**1 NFT only** — minted to `winner.wallet` (winning profile wallet). [TTSVotingV3b.sol:474-476]
`try ITTSRoundNFT(nftContract).mint{gas: 200000}(winner.wallet, roundId, winnerId, pool / 1e18) {} catch {}`

### Q: Submission fee?
**Off-chain only** — handled in `src/App.jsx`. User pays 5 TTS via `transfer(HOUSE_WALLET, SUBMISSION_FEE)` where `HOUSE_WALLET = 0xb1e991bf...` and `SUBMISSION_FEE = 5e18`. No submission-fee function exists in the voting contract. [App.jsx:16-17, 1269]

### Q: Minimum vote?
`MIN_VOTE = 5e18` (5 TTS) — enforced in `vote()`. [TTSVotingV3b.sol:196, 494]

### Q: Max vote cap?
`MAX_VOTE_CAP_BPS = 4000` (40% of total round votes) — enforced per profile. [TTSVotingV3b.sol:197, 504]
Note: cap is skipped when a profile is the only one with votes in the pool (CRITICAL fix #1). [TTSVotingV3b.sol:502-504]

### Q: Vote match — in contract or off-chain?
**Off-chain only** — handled in `/api/vote-match.js`. Not in the voting contract.

---

## CONTRACT DOES NOT MATCH FOUNDER INTENT — REDEPLOYMENT DECISION NEEDED

| Item | Founder Intent | Contract Reality | Severity |
|------|---------------|-----------------|----------|
| NFT mints per settlement | 3 (winning profile, top voter, Blockchain Entertainment LLC archive) | **1** — winning profile wallet only | 🚨 CRITICAL — requires contract + NFT contract changes |
| Submission fee destination | 0xC3A3858A3777E4C9B542e60298c3161086c5Faae | `0xb1e991bf...` (Bank/Deployer) | ⚠️ COSMETIC — fix `HOUSE_WALLET` constant in App.jsx if correct address confirmed |
| Staking multiplier for tier 3 | Diamond (1000+) = 2x | tier 3 = 1.75x (old "Platinum" tier still present in contract) | 🚨 CRITICAL — Diamond stakers get 1.75x not 2x; requires staking contract audit + likely redeploy |

Items that MATCH founder intent (contract confirmed ✅):
- Prize pool = winning-profile votes only ✅
- Losing votes burned to 0x000...dEaD ✅
- Split 35/35/10/20 (no club) or 35/35/10/10/10 (with club) ✅
- Minimum vote 5 TTS ✅
- Max vote cap 40% of round pool per profile ✅
- charityWallet = Polaris Project ✅
- houseWallet = Bank/Deployer ✅

---

## Canonical Game Parameters (locked May 10 2026)

### Round Schedule

| Event | EDT (Canonical) | UTC | Chainlink Cron |
|-------|----------------|-----|----------------|
| Round starts | Monday 12:00 AM EDT | Monday 04:00 UTC | `0 4 * * 1` |
| Round ends | Sunday 11:59 PM EDT | Monday 03:59 UTC | `59 3 * * 1` |
| VRF settlement | Within minutes of round end — automatic | | |
| Confirm new round | Check Monday 04:05 UTC | | |
| @CryptoFitJim posts | manual — Jim posts from content calendar or X directly | — | — |
| @temptationtoken morning | 9am EDT (13:00 UTC) | 13:00 UTC | Vercel cron `0 13 * * *` |
| @temptationtoken afternoon | 2pm EDT (18:00 UTC) | 18:00 UTC | Vercel cron `0 18 * * *` |
| @temptationtoken evening | 8pm EDT (00:00 UTC next day) | 00:00 UTC | Vercel cron `0 0 * * *` |
| Content generated | Monday 8am UTC | 08:00 UTC | Vercel cron `0 8 * * 1` |

**EDT is the canonical timezone for display.** Any UI, dashboard, documentation, or generated content must use EDT.

**✅ Chainlink crons confirmed correct (May 2026):**
- TTS Start Round: `0 4 * * 1` — Monday 04:00 UTC (12:00 AM EDT)
- TTS Settle Or Rollover: `59 3 * * 1` — Monday 03:59 UTC (Sunday 11:59 PM EDT)

Note: During EST (winter, Nov–Mar), rounds drift 1 hour. Unavoidable — Chainlink is UTC-only.

### Prize Distribution (on-chain, verified May 10 2026)

**No club involved (standard):**

| Recipient | Share | Address |
|-----------|-------|---------|
| Top Voter | 35% | Wallet with most raw votes on winning profile |
| Winning Profile | 35% | Profile's registered wallet |
| Polaris Project | 10% | `0xf7dd429d679cb61231e73785fd1737e60138aba3` |
| Blockchain Entertainment LLC | 20% | `0xb1e991bf617459b58964eef7756b350e675c53b5` |

**With club referral (club code set + registered wallet):**

| Recipient | Share |
|-----------|-------|
| Top Voter | 35% |
| Winning Profile | 35% |
| Polaris Project | 10% |
| Club Wallet | 10% |
| Blockchain Entertainment LLC | 10% |

**Pool definition:** winning profile's raw votes only. Losing-profile votes are burned to 0x000...dEaD immediately after payout.

### Staking Tiers (locked April 29 2026)

| Tier | Min Stake (USD) | APR | Vote Boost | Contract Tier # |
|------|----------------|-----|-----------|----------------|
| Bronze | $50+ | 8% | 1.1x | 0 |
| Silver | $100+ | 12% | 1.25x | 1 |
| Gold | $250+ | 18% | 1.5x | 2 |
| Diamond | $1,000+ | 32% | 2x | 3 (⚠️ contract returns 1.75x — MISMATCH) |
| VIP | $5,000+ | 45% | 3x | 4 (contract returns 2x) |

🚨 **STAKING MULTIPLIER MISMATCH**: The voting contract's `_applyMultiplier()` maps tier 3 → 1.75x and tier 4 → 2x, but the canonical spec requires Diamond (tier 3) = 2x and VIP (tier 4) = 3x. This means Diamond stakers are being underserved. **TODO: audit staking contract to confirm tier numbering, then redeploy voting contract with corrected multipliers.**

**Display both USD threshold and live TTS equivalent in all UI.** TTS equivalent = USD ÷ current Uniswap price. "Platinum" tier does not exist — remove if found anywhere.

### Canonical Parameters (locked May 10 2026)

| Parameter | Value | Source |
|-----------|-------|--------|
| Minimum vote | 5 TTS | On-chain: `MIN_VOTE = 5e18` |
| Profile submission fee | 5 TTS | Off-chain: App.jsx `SUBMISSION_FEE` |
| Submission fee destination | `0xb1e991bf...` (Bank/Deployer) | App.jsx `HOUSE_WALLET` |
| Max vote cap per profile | 40% of round pool | On-chain: `MAX_VOTE_CAP_BPS = 4000` |
| Signup bonus | **500 TTS** (admin-configurable) | Off-chain: `admin_config.signup_bonus_tts` |
| Vote match | 1:1 up to **1,000 TTS** (admin-configurable) | Off-chain: `admin_config.vote_match_cap_tts` |
| Transfer tax | 1% — permanent, hardcoded, cannot be changed | On-chain: TTS token contract |
| Total supply | 69,000,000,000 TTS — fixed, no mint function | On-chain |

---

## Admin Config Table (Supabase)

`admin_config` table controls bonus amounts. Keys:
- `signup_bonus_tts` — TTS sent on first wallet connect (default: 500)
- `vote_match_cap_tts` — max TTS matched on first vote (default: 1000)
- `vote_match_ratio_numerator` — match ratio numerator (default: 1)
- `vote_match_ratio_denominator` — match ratio denominator (default: 1)

Create tables: `node scripts/supabase-admin-config.sql` (run SQL in Supabase dashboard).
Dashboard settings path: Admin Dashboard → Settings → Bonus Configuration.

---

## Active Test Profile (May 2026 Live Audit)

**Donielle Banks** — submitted for Round 2 live audit test. Used to verify full profile submission → approval → voting → settlement flow on TTSVotingV3b.

---

## LP Lock Status (locked May 6 2026)

**✅ LOCKED.** 231.3 LP tokens (100% of Uniswap V2 pool `0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68`) locked on Team.Finance until **May 5, 2027**. Lock TX: `0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da`.

---

## TTSVotingV3b Security Patches (applied May 2026)

All 11 findings from the voting contract audit (audit ID 88b99f3a) are patched:

| Fix | Type | Description |
|-----|------|-------------|
| Vote cap guard | CRITICAL | Skip 40% cap check when pool has only one profile (first vote) |
| CALLBACK_GAS_LIMIT | HIGH | 500k → 2500k; MAX_PROFILES_PER_ROUND = 50 |
| Zero-wallet checks | HIGH | require(wallet != address(0)) in approve + batch functions |
| SafeERC20 | HIGH | Inline library — all transfers use safeTransfer/safeTransferFrom |
| NFT mint gas cap | MEDIUM | try mint{gas:200000}(...) {} catch {} |
| adminResetSettlement() | MEDIUM | Owner can reset stuck VRF after 1 day (VRF rescue only — does NOT force early settlement) |
| rolloverRound endTime | MEDIUM | require(block.timestamp >= r.endTime) |
| Constructor guards | LOW | Zero-address checks for token, charity, house |
| Admin setter events | LOW | CharityWalletUpdated, HouseWalletUpdated, NFTContractUpdated |
| MultiplierFallback event | LOW | Emitted in _applyMultiplier catch block |

---

## Infrastructure

| Service | Project/ID |
|---|---|
| Vercel | `temptation-token` (cryptofitjims-projects) |
| Railway | `proud-unity` (Telegram bot, Hobby plan) |
| Supabase | `gmlikdxykgviyprqtqwz` (Pro) |
| GitHub | `madscientist4-bigdaddy/temptation-token` |

## Deploy workflow

```bash
# App (Vercel)
npm run build && npx vercel --prod

# Bot (Railway auto-deploys on push)
git push

# CI check (run before commit)
node scripts/check-prize-split.mjs
```

Always `git add` + commit + push after every change.

## Telegram

- Main bot: `@TTSGameBot` — token in Railway env as `BOT_TOKEN`
- Broadcaster: `@TTSBroadcastBot` — token in Railway env as `BOT2_TOKEN` (BROADCAST_BOT_TOKEN in Vercel)
- Main channel: `@temptationtoken` (ID: `-1002207667493`)
- Community: `@TTSCommunityChat` (ID: `-1003930752060`)
- Admin chat ID: `-5273368658`
- VIP Vault: `https://t.me/+F2lyVRf92n4xMDRh`

**Required: Add @TTSBroadcastBot as admin to both @temptationtoken and @TTSCommunityChat for Post Now and scheduler to function.**

---

## Vercel Environment Variables

| Variable | Purpose | Status |
|----------|---------|--------|
| `DEPLOYER_PRIVATE_KEY` | approve-profile, referral-credit on-chain calls | ✅ Set Apr 22 |
| `MARKETING_WALLET_PRIVATE_KEY` | signup-bonus, vote-match TTS sends | ✅ Set May 1 |
| `ANTHROPIC_API_KEY` | chatbot + content generator | ✅ Set |
| `BROADCAST_BOT_TOKEN` | Telegram @TTSBroadcastBot | ✅ Set |
| `X_API_KEY` | X app credential (shared) | ✅ Set |
| `X_API_SECRET` | X app credential (shared) | ✅ Set |
| `TTS_X_ACCESS_TOKEN` | @temptationtoken user token — all automated X posts | ✅ Set |
| `TTS_X_ACCESS_SECRET` | @temptationtoken user secret | ✅ Set |
| `SUPABASE_URL` | Supabase project URL | ✅ Set |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | ✅ Set |

**X posting: @temptationtoken only (automated). @CryptoFitJim posts manually.**
Fix if 401: regenerate API Key & Secret → update `X_API_KEY` + `X_API_SECRET` in Vercel; regenerate @temptationtoken Access Token → update `TTS_X_ACCESS_TOKEN` + `TTS_X_ACCESS_SECRET`.

---

## Pending Actions (priority order)

1. **🚨 RUN SUPABASE SQL SETUP** — Create `admin_config` and `admin_audit_log` tables. Run `scripts/supabase-admin-config.sql` in Supabase SQL editor. Without this, admin_config reads will silently use defaults (500 TTS / 1000 TTS).
2. **🚨 batchApproveProfiles on V3b** — New contract `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` needs profiles approved for Round 2.
3. **🚨 STAKING MULTIPLIER MISMATCH** — Audit staking contract to confirm tier numbering. If tier 3 ≠ Diamond, redeploy voting contract with corrected `_applyMultiplier()`.
4. **🚨 NFT MINTS MISMATCH** — Contract mints 1 NFT (winning profile only). Founder intends 3 (winning profile + top voter + archive). Requires voting contract + NFT contract changes.
5. **X social media credentials** — X_API_KEY may return 401. Regenerate at developer.twitter.com if needed.
6. **Solidproof pending items** — acknowledge M-1/M-2/M-3 on portal, complete KYC.
7. **Publish website content** — trust_page.html → temptationtoken.io/trust. WordPress .htaccess fix needed (Hostinger).
8. **CoinGecko resubmission** — LP lock complete. File: `outputs/exchange_submissions/coingecko_update.md`.
9. **Verify TTSVotingV3b on BaseScan** — use Remix (solc 0.8.20, 200 runs, via_ir=true). Address: `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`.
10. **Deploy TTS v2 M1 fix** through Gnosis Safe multisig.
11. **Round 1 settlement** — on-chain endTime = May 14 03:23 UTC. Round 1 has 0 votes. No force-settle path exists before endTime. After settlement: manually call keeper `startRound(345960)` to start Round 2 with corrected duration ending May 18 03:59 UTC, restoring canonical Mon-Sun schedule.
12. ✅ Marketing wallet funded — 997,395 TTS + 0.005 ETH.
13. ✅ LP locked.

---

## Round 1 On-Chain Status (May 10 2026)

| Field | Value |
|-------|-------|
| Contract | `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` |
| currentRoundId | 1 |
| startTime | 2026-05-07 03:23:13 UTC |
| endTime | 2026-05-14 03:23:13 UTC (Thu May 13 11:23 PM EDT) |
| totalRawVotes | 0 |
| totalTickets | 0 |
| settled | false |
| vrfPending | false |
| profileCount | 14 |
| TTS in contract | 0 TTS |

**⚠️ Round 1 has 0 votes.** Verify the frontend is pointing to the correct VOTING_ADDRESS and that profiles are visible/voteable. Natural settlement fires May 14 03:23 UTC; VRF callback will early-return with no prizes (totalTickets = 0).

---

## Planned V2 Token Contract Fixes

### Fix 1 — Solidproof Medium Finding #1: Zero-Amount Transfer Guard

Add `if (amount == 0) return true;` at the top of both `transfer()` and `transferFrom()` before any tax calculation. EIP-20 compliance + underflow guard.

**Implementation contract:** `0xb995b63cdf848b7884cdc51da82e4a80ad02395a` (pending upgrade)
**Upgrade path:** Deploy new implementation → Gnosis Safe proposeUpgrade → 2/2 sign → execute

---

## Content Generator CRITICAL RULES (api/content-generator.js)

All 8 rules must be present in the system prompt:
1. ROUND SCHEDULE — canonical Mon 12 AM EDT open, specific close date/time only
2. ZERO STAKERS — frame as opportunity, never state as negative fact
3. STAKING LOCK — staking not tied to round windows, available any day
4. TRANSFER TAX — 1% mandatory in all tokenomics posts
5. PRIZE SPLIT — 35/35/10/20 canonical; 40% anywhere near prize words is FORBIDDEN
6. SIGNUP BONUS — 500 TTS; "100 TTS" is FORBIDDEN
7. VOTE MATCH — 1:1 up to 1,000 TTS admin-configurable
8. BURN MECHANIC — winning-profile votes only form pool; losing votes burn entirely

CI test: `node scripts/check-prize-split.mjs`

---

## Session Start Instruction

**Every session: "Read CLAUDE.md and continue from where we left off."**

Check memory files for any session-specific context.

---

## Completed History

### May 10, 2026
- ✅ Contract audit: verified charityWallet, houseWallet, MIN_VOTE, MAX_VOTE_CAP_BPS, prize split, burn mechanic, NFT mint count
- ✅ Signup bonus 100 → 500 TTS across tts_bot.py, App.jsx, TTSChatbot.jsx
- ✅ admin_config Supabase infrastructure: signup_bonus_tts, vote_match_cap_tts, vote_match_ratio
- ✅ signup-bonus.js: switched from dynamic $5 USD calculation to fixed admin_config amount
- ✅ vote-match.js: cap now reads from admin_config
- ✅ TTAdminDashboard Settings: live BonusConfigSection with save + audit log
- ✅ content-generator.js: added CRITICAL RULES 6-8 (signup bonus, vote match, burn mechanic)
- ✅ check-prize-split.mjs: expanded to check 40% split, 100 TTS signup, "all votes" pool contamination
- ✅ CLAUDE.md: merged + audit-verified rewrite
- ✅ Prize split messaging fixed everywhere (35% not 40%) — all 6 fixes from prior session applied
- ✅ Cashtag deduplication in scheduler.js (prevents X API 403)

### May 6, 2026
- ✅ TTSVotingV3b redeployed at `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` — all 11 audit fixes
- ✅ LP locked — 231.3 LP tokens on Team.Finance until May 5 2027

### May 1, 2026
- ✅ MARKETING_WALLET_PRIVATE_KEY corrected in Vercel
- ✅ Chainlink crons confirmed: `0 4 * * 1` start, `59 3 * * 1` settle
- ✅ Marketing wallet ETH funded (0.005 ETH)

### TTSVotingV3b Constructor Params (for redeploy reference)
```
_ttsToken:        "0x5570eA97d53A53170e973894A9Fa7feb5785d3b9"
vrfCoordinator_:  "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
_keyHash:         "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70"
_subscriptionId:  58222014484560539249027457203866883376041731162442592604288474822166186263722
_stakingContract: "0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc"
_charityWallet:   "0xf7dd429d679cb61231e73785fd1737e60138aba3"
_houseWallet:     "0xb1e991bf617459b58964eef7756b350e675c53b5"
```
Remix settings: Solidity 0.8.20 · optimizations ON (200 runs) · Base mainnet (8453)
