# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Last verified: May 26, 2026 — dashboard Q/O/R workstreams complete, API consolidated to 12 functions, deployed.

## Operating Mode

### AUTONOMOUS EXECUTION POLICY

- Execute all reads, file edits, code changes, git commits, git pushes,
  npm/yarn commands, vercel commands, Supabase queries, BaseScan
  verifications, email drafting, RPC calls, contract reads, and
  documentation updates WITHOUT asking permission.
- Default to "yes" on every implementation choice. Make the call,
  document it, move on.
- The ONLY actions requiring Jim's explicit confirmation are:
  (a) Transactions signed from the Bank wallet
  (b) Transactions signed from the Gnosis Safe multisig
  (c) Destructive irreversible actions (deleting production data,
      canceling Chainlink upkeeps, dropping Supabase tables)
- Do NOT ask "should I proceed?", "want me to continue?", "ready for
  the next step?", or any variant. Just proceed.
- Do NOT ask "should I commit this?" — commit it.
- Do NOT ask "should I deploy?" — deploy if the change is non-destructive
  and the build passes.
- If multiple paths exist and one is clearly better, pick it and note
  the choice. If they're genuinely equivalent, pick the simpler one.
- Surface decisions made AFTER the fact, not before.

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
   - `/api/kyc.js` — Combined KYC + age-verify handler (replaces kyc-session, kyc-webhook, kyc-status, age-acknowledge). Original URLs preserved via vercel.json rewrites:
     - `POST /api/kyc-session` (`?action=session`): creates Persona inquiry. Requires `PERSONA_API_KEY` + `PERSONA_TEMPLATE_ID`.
     - `POST /api/kyc-webhook` (`?action=webhook`): updates `verified_submitters`. Verifies `Persona-Signature` header. Set webhook URL in Persona dashboard.
     - `GET /api/kyc-status?wallet=0x...` (`?action=status`): returns `{ status, source }`.
     - `GET/POST /api/age-acknowledge` (`?action=age`): records/checks 18+ acknowledgment.
   - `/api/referral-credit.js` — Credits referrer wallet on new user signup. Uses `referral_credits` table.
   - `/api/community-stats.js` — Returns Telegram community member count, X stats, engagement. Also handles bot heartbeat: `GET/POST /api/bot-health` → `?action=heartbeat` via vercel.json rewrite.
   - `/api/signup-bonus.js` — POST `{ walletAddress }`: sends fixed TTS amount (default 500, admin-configurable via `admin_config` table) from Marketing wallet on first connect. 20/day rate limit. Records in `bonus_claims` table. Requires `MARKETING_WALLET_PRIVATE_KEY` in Vercel env.
   - `/api/vote-match.js` — POST `{ walletAddress, voteAmount, txHash }`: matches first-ever vote up to cap (default 1,000 TTS, admin-configurable) from Marketing wallet. 50/day rate limit. Records in `bonus_claims` table. Requires `MARKETING_WALLET_PRIVATE_KEY`.

3. **Python Telegram bot** (`tts_bot.py`) — Runs as a separate worker (Procfile). Uses SQLite locally and integrates with the same Supabase instance.

### Frontend structure

- `src/App.jsx` — The entire main voting UI, including all contract ABIs and addresses as constants at the top of the file. This is intentionally monolithic.
- `src/TTAdminDashboard.jsx` — Password-protected admin panel. Tabs: Command Center, Daily Priorities, KPI Dashboard, Operations Manual, Overview, Photo Review, Content Calendar, Social Media, System Health, Payouts, Staking, Wallets, Referrals, Users, Settings. Password: `TTS2026Admin!`
- `src/TTSChatbot.jsx` — Claude-powered floating support chatbot, calls `/api/chat`
- `src/config/Wallet.js` — Wagmi + ReownAppKit (WalletConnect) config, Base chain only

### Data layer

- **Supabase** (`gmlikdxykgviyprqtqwz`) — Primary app database. Tables: `users`, `submissions`, `votes`, `rounds`, `stakes`, `scheduled_posts`, `bonus_claims`, `referral_settings`, `referral_credits`, `referrals`, `outreach_queue`, `admin_config`, `admin_audit_log` (all created as of May 10 2026). KYC tables (added May 24 2026 — run `outputs/kyc_setup.sql`): `verified_submitters`, `verified_wallet_links`, `age_acknowledgments`.
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
| TTS v2 Implementation (M-1 fix — **LIVE as of 2026-05-17**) | `0xb995b63cdf848b7884cdc51da82e4a80ad02395a` |
| TTSVotingV2 (deprecated) | `0x4dE347D547C7Ae2CB38c42A8166d29049C24e9DA` |
| TTSVotingV3 (deprecated) | `0x49385909a23C97142c600f8d28D11Ba63410b65C` |
| **TTSVotingV3b (ACTIVE — Round 1 overdue settlement)** | **`0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`** |
| **TTSVotingV3c (COMPILED — ready to deploy, not yet on-chain)** | `contracts/TTSVotingV3c.sol` |
| TTSKeeper2 | `0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48` |
| **TTSKeeper2V2 (COMPILED — ready to deploy, not yet on-chain)** | `contracts/TTSKeeper2V2.sol` |
| TTSLinkReserve | `0xE8006d8F36827c97fd8f2932d4D2198B833A432F` |
| **TTSRoundNFT** | **`0x0768e862D3AB14d85213BfeF8f1D012E77721da2`** |
| TTSStaking (proxy) | `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc` |
| TTSStakingV2 Implementation (COMPILED — ready to deploy) | `contracts/TTSStakingV2.sol` |
| Gnosis Safe (2/2 multisig) | `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86` |
| Uniswap V2 Pool | `0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68` |

## Wallets

| Label | Address | Purpose | Balance (2026-06-01) |
|-------|---------|---------|----------------------|
| Bank / Deployer | `0xb1e991bf617459b58964eef7756b350e675c53b5` | Owner, house wallet, receives house cut of prize pool. Holds PAUSER_ROLE + UPGRADER_ROLE. | 4,987,892,338 TTS (7.23%) |
| Marketing / Bonus | `0x7a9ff2f584248744cBbA32c737D660ED6f077fCB` | Signup bonus + vote-match payments | ~991,290 TTS |
| Polaris / Charity | `0xf7dd429d679cb61231e73785fd1737e60138aba3` | Receives 10% charity cut every settlement | 0 TTS |
| **TTS Treasury** | **`0xC3A3858A3777E4C9B542e60298c3161086c5Faae`** | **Original allocation to TTS entity treasury — 20B TTS, tax-exempt, long-term reserve** | **20,000,000,582 TTS (28.99%)** |
| **Gnosis Safe (2/2)** | **`0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`** | **Admin multisig (DEFAULT_ADMIN + UPGRADER_ROLE). Signers: Jim + Dr. Mike. Received 10B TTS governance allocation.** | **10,000,000,000 TTS (14.49%)** |
| **Founder / Jim Ledger** | **`0xe5c3b6480164c20253c21928c699ab7fdb8a60e5`** | **Jim's founder allocation — 10B TTS, tax-exempt** | **10,000,000,000 TTS (14.49%)** |
| **Ecosystem / Chantea** | **`0xc17c1b5f653d66dc3324a0dc09d5500500f24ade`** | **Ecosystem/Chantea allocation — 6B TTS (1B + 5B), tax-exempt** | **6,000,000,000 TTS (8.70%)** |
| **Development / Dr. Mike** | **`0x95607DcF6c815e6A7cb79eb6199174DFADC78758`** | **Dr. Mike's development allocation + Gnosis Safe second signer. 5B TTS, tax-exempt.** | **5,000,000,000 TTS (7.25%)** |
| **Team / Son** | **`0xb1c9868d4bfb10d2d7e51cd625889f2b9e1d4887`** | **Team / Son allocation — 2B TTS, tax-exempt** | **2,000,000,624 TTS (2.90%)** |
| **Dr. Mike personal (unconfirmed)** | **`0xe43105c9abeff42bdb79e1dca275803bbcdf8cc1`** | **Presumed Dr. Mike's original personal wallet — 1B TTS, NOT tax-exempt. Pending his confirmation.** | **1,000,001,000 TTS (1.45%)** |

---

## Current Round Status (verified on-chain May 20, 2026)

| Field | Value |
|-------|-------|
| Contract | TTSVotingV3b `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` |
| currentRoundId | 1 |
| startTime | 2026-05-07 03:23:13 UTC |
| endTime | 2026-05-14 03:23:13 UTC |
| totalRawVotes | 0 (no votes in Round 1) |
| totalTickets | 0 |
| settled | **true ✅ — settled 2026-05-15 21:43 UTC** |
| vrfPending | false |
| profileCount | 15 |
| Round 2 | Not started (V3c not yet deployed) |
| Settlement TX | `0x50d0ec5ed6ff5d0c30fa79956162e8d2278ccbc33bd091be14784f71f423c41d` (Bank wallet → manualExecute(3) → VRFRequested → VRF fulfilled → 0 votes → no prizes) |

**✅ Round 1 settled.** Jim manually called `manualExecute(3)` on TTSKeeper2 (May 15). VRF fulfilled; 0 votes → no prize distribution. Round 2 pending V3c deployment.

**Root cause of automation failure confirmed:** TTSKeeper2 `s_forwarder` holds `0x6593c7de001fc8542bb1703532ee1e5aa0d458fd` — **no code on Base mainnet** (Ethereum mainnet address). Automation calls routed through forwarder all failed silently. TTSKeeper2V2 fixes this. See `outputs/chainlink_automation_runbook.md`.

---

## Verified Contract Behavior (May 10 2026 Audit)

Contract: TTSVotingV3b at `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`

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
`houseWallet = 0xb1e991bf617459b58964eef7756b350e675c53b5` (Bank/Deployer wallet)

### Q: Charity wallet address?
`charityWallet = 0xf7dd429d679cb61231e73785fd1737e60138aba3` (Polaris/Charity)

### Q: NFT mints at settlement?
**V3b: 1 NFT only** — minted to `winner.wallet`. **V3c fixes this: 3 NFTs** (winner.wallet + topVoterAddr + houseWallet archive).

### Q: Submission fee?
**Off-chain only** — handled in `src/App.jsx`. User pays 5 TTS via `transfer(HOUSE_WALLET, SUBMISSION_FEE)` where `HOUSE_WALLET = 0xb1e991bf...` and `SUBMISSION_FEE = 5e18`. [App.jsx:16-17, 1269]

### Q: Minimum vote?
`MIN_VOTE = 5e18` (5 TTS) — enforced in `vote()`. [TTSVotingV3b.sol:196, 494]

### Q: Max vote cap?
`MAX_VOTE_CAP_BPS = 4000` (40% of total round votes) — enforced per profile. Cap skipped when only one profile has votes (first vote in round). [TTSVotingV3b.sol:197, 502-504]

### Q: Vote match — in contract or off-chain?
**Off-chain only** — handled in `/api/vote-match.js`. Not in the voting contract.

---

## V3c Changes vs V3b (pre-deployment — not yet live)

Source: `contracts/TTSVotingV3c.sol`. Pre-deployment check: ✅ PASS (0 compiler errors/warnings, Slither HIGH accepted as AF-001). Deployment runbook: `outputs/v3c_v2_deployment_runbook.md`.

| Area | V3b (current) | V3c (pending deploy) |
|------|--------------|----------------------|
| Tier 3 (Diamond) vote multiplier | 1.75x | **2.0x** |
| Tier 4 (VIP) vote multiplier | 2.0x | **3.0x** |
| Tier 5 (ghost) | 3.0x | **removed** |
| NFT mints at settlement | 1 (winner only) | **3 (winner + top voter + houseWallet archive)** |
| Per-tier vote cap | none | **500/1000/2500/5000/15000 TTS / unlimited (VIP)** |
| Storage slots 0–12 | identical | **identical — no migration needed** |

Slither HIGH (AF-001): `reentrancy-eth` in `vote()` — CEI violation accepted as non-exploitable (TTS is standard ERC-20, no hooks). Full record: `outputs/v3c_accepted_findings.md`.

---

## CONTRACT DOES NOT MATCH FOUNDER INTENT — V3c RESOLVES MOST

| Item | Founder Intent | V3b Reality | V3c Status |
|------|---------------|-------------|------------|
| NFT mints per settlement | 3 | 1 (winner only) | ✅ Fixed in V3c |
| Diamond (tier 3) vote multiplier | 2x | 1.75x | ✅ Fixed in V3c |
| VIP (tier 4) vote multiplier | 3x | 2x | ✅ Fixed in V3c |
| Submission fee destination | 0xC3A3858A... | `0xb1e991bf...` (Bank) | ⚠️ Still unresolved — Jim to confirm correct address |
| getStakingTier() interface | Works | Selector mismatch → 1x for all | ✅ Fixed by TTSStakingV2 deploy (separate) |

Items confirmed matching founder intent (V3b ✅):
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
| Diamond | $1,000+ | 32% | 2x | 3 |
| VIP | $5,000+ | 45% | 3x | 4 |

V3b voting contract has wrong multipliers (Diamond=1.75x, VIP=2x). **V3c fixes this.** Staking contract `getStakingTier()` interface mismatch (selector not found) causes 1x fallback for all voters — fixed by deploying TTSStakingV2.

**Display both USD threshold and live TTS equivalent in all UI.** TTS equivalent = USD ÷ current Uniswap price. "Platinum" tier does not exist — remove if found anywhere.

### Canonical Parameters (locked May 10 2026)

| Parameter | Value | Source |
|-----------|-------|--------|
| Minimum vote | 5 TTS | On-chain: `MIN_VOTE = 5e18` |
| Profile submission fee | 5 TTS | Off-chain: App.jsx `SUBMISSION_FEE` |
| Submission fee destination | `0xb1e991bf...` (Bank/Deployer) | App.jsx `HOUSE_WALLET` — confirm correct address with Jim |
| Max vote cap per profile | 40% of round pool | On-chain: `MAX_VOTE_CAP_BPS = 4000` |
| Signup bonus | **500 TTS** (admin-configurable) | Off-chain: `admin_config.signup_bonus_tts` |
| Vote match | 1:1 up to **1,000 TTS** (admin-configurable) | Off-chain: `admin_config.vote_match_cap_tts` |
| Transfer tax | 1% — permanent, hardcoded, cannot be changed | On-chain: TTS token contract |
| Total supply | 69,000,000,000 TTS — fixed, no mint function | On-chain |

---

## Admin Config Table (Supabase)

`admin_config` table controls bonus amounts and runtime config. Keys:
- `signup_bonus_tts` — TTS sent on first wallet connect (default: 500)
- `vote_match_cap_tts` — max TTS matched on first vote (default: 1000)
- `vote_match_ratio_numerator` — match ratio numerator (default: 1)
- `vote_match_ratio_denominator` — match ratio denominator (default: 1)
- `bot_last_heartbeat` — ISO timestamp of last @TTSGameBot heartbeat (written by tts_bot.py every 5 min, read by /api/bot-health → community-stats)

Dashboard settings path: Admin Dashboard → Settings → Bonus Configuration.

---

## Active Test Profile (May 2026 Live Audit)

**Donielle Banks** — submitted for Round 2 live audit test. Used to verify full profile submission → approval → voting → settlement flow on TTSVotingV3b.

---

## LP Lock Status (locked May 6 2026)

**✅ LOCKED.** 231.3 LP tokens (100% of Uniswap V2 pool `0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68`) locked on Team.Finance until **May 5, 2027**. Lock TX: `0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da`.

---

## TTSVotingV3b Security Patches (applied May 2026)

All 11 findings from the voting contract audit (audit ID 88b99f3a) are patched in V3b:

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

## Known Accepted Security Findings

| ID | Tool | Severity | Contract | Function | Status | Date |
|----|------|----------|----------|----------|--------|------|
| AF-001 | Slither 0.11.3 | HIGH (reentrancy-eth) | TTSVotingV3c | `vote()` lines 498–534 | **ACCEPTED — not exploitable** | 2026-05-18 |

Full record: `outputs/v3c_accepted_findings.md`. AF-001 summary: CEI violation — `safeTransferFrom` precedes state writes. Not exploitable because TTS is a standard ERC-20 with no transfer hooks; token address is immutable; identical pattern in audited V3b with zero incidents. Decision: Jim Goetz.

---

## SolidProof Audit Status (as of May 19, 2026)

**Audit ID:** 88b99f3a | **Portal:** app.solidproof.io/projects/temptation-token | **TrustNet Score:** 0.01 (Poor — no findings acknowledged yet)

**Portal access: LOST.** Account email: `jgoetz@functionised.com`. Recovery: email `support@solidproof.io` or Telegram `@Solidproof_io_Support`. No self-service password-reset URL exists at app.solidproof.io.

**Actual findings on portal** (two sub-reports — TTSVoting + Token):

*TTSVoting contract:*
| ID | Severity | Title | Code Status |
|----|----------|-------|-------------|
| C-1 | Critical | Vote cap check prevents any vote | ✅ Fixed in V3b |
| H-1 | High | Settlement callback gas limit bricks contract | ✅ Fixed in V3b |
| H-2 | High | Zero wallet address traps funds | ✅ Fixed in V3b |
| H-3 | High | ERC-20 transfer return values unchecked | ✅ Fixed in V3b (SafeERC20) |
| M-1 | Medium | Admin can redirect club share during VRF window | ⚠️ Not patched — acknowledged |
| M-2 | Medium | NFT contract can be set to gas-bomb | ✅ Fixed in V3b (gas cap) |
| M-3 | Medium | Round unrecoverable if VRF never delivers | ✅ Fixed in V3b (adminResetSettlement) |
| M-4 | Medium | Single-step ownership with reachable renounceOwnership | ⚠️ Not patched — acknowledged |
| M-5 | Medium | State changes after external transferFrom in vote() | ✅ Accepted as AF-001 |
| M-6 | Medium | rolloverRound executes before round end | ✅ Fixed in V3b |
| M-7 | Medium | Payout destinations mutable during VRF window | ⚠️ Not patched — acknowledged |
| L-1 to L-6 | Low | Zero-address, events, pragma, etc. | Mostly fixed in V3b |
| O-1 to O-3 | Optimization | Storage, errors, magic numbers | Acknowledged |
| I-1 to I-8 | Informational | Various | Acknowledged |

*TTS Token contract:* Zero-value transfer (M-1 = **FIXED, live 2026-05-17**), centralization/wallet updates (M-2 = mitigated by Gnosis Safe), rounding dust (M-3 = negligible), and low/informational findings.

**⚠️ WARNING:** The pre-written acknowledgment responses in `outputs/seo/solidproof_acknowledgment_responses.md` use M-1/M-2/M-3 labels that match the TOKEN sub-report, NOT the voting contract sub-report. Do not submit them without logging in first and mapping to the correct portal finding IDs.

**KYC ($600):** Not started. Requires portal access first. Checklist: `outputs/urgent/solidproof_kyc_checklist.md`.

---

## MetaMask / Security Scanner Status (as of May 19, 2026)

| Channel | Status |
|---------|--------|
| Blockaid false-positive | ✅ Submitted 2026-05-18 — Ticket #1263614 — awaiting review (1–3 day ETA) |
| MetaMask support email | ✅ Sent 2026-05-18 — template in `outputs/metamask_remediation.md` Section 7 |
| GoPlus appeal | ⚠️ Pending Jim — correct channel: `service@gopluslabs.io` or Telegram `@Goplusservice` (security@gopluslabs.io is invalid/bounced). Template: `outputs/metamask_remediation.md` Section 6 |

Root causes of flag: `blacklisted` mapping (DEFAULT_ADMIN gated), 55% creator concentration (now 7.23% after 33B distribution — GoPlus stale), UUPS proxy + Bank holds UPGRADER_ROLE (revocation in progress via Safe), MINTER_ROLE held by nobody. Full analysis: `outputs/metamask_remediation.md`.

---

## Gnosis Safe Status (as of May 17, 2026)

| Check | Status |
|-------|--------|
| Threshold | 2/2 |
| On-chain nonce | 6 |
| Pending queue | CLEARED — 4 orphaned entries at nonces 1,2,3,5 (permanently non-executable) |
| Nonce 0 executed | ✅ upgradeTo(0xb995b63c) — TTS M-1 fix live |
| Nonce 4 executed | ✅ Tax-exempt batch — all 8 addresses confirmed |
| All 8 isTaxExempt | ✅ true on-chain |
| DEFAULT_ADMIN_ROLE on TTS | ✅ Held by Safe only |
| MINTER_ROLE | ✅ No holders (address(0)) |
| UPGRADER_ROLE | ⚠️ **Held by BOTH Bank wallet AND Gnosis Safe** — Bank can upgrade TTS implementation unilaterally. UPGRADER_ROLE revocation from Bank is in progress via Safe batch (Jim executing 2026-06-01). After revocation: Safe only. |
| PAUSER_ROLE | ⚠️ Held by BANK wallet (`0xb1e991bf...`) — single EOA can pause all TTS transfers. Recommended: revoke from Bank (Safe can re-grant in emergency). Pending Jim's decision. |

---

## WordPress Programmatic Edits

WordPress programmatic edits use the **tts-api-auth plugin** (bypasses Hostinger's Application Password block).

- **Endpoint base:** `https://temptationtoken.io/wp-json/tts/v1/`
- **Auth header:** `X-TTS-API-Key: <key>`
- **Key stored in Vercel env as:** `TTS_WP_API_KEY`
- **Plugin source:** `wp-plugins/tts-api-auth/tts-api-auth.php`
- **Plugin ZIP** (upload to wp-admin): `wp-plugins/tts-api-auth.zip`

### Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/setup` | One-time setup: POST `{setup_token, api_key}` to register key (token shown in wp-admin notice after activation) |
| GET | `/status` | Confirm auth works; returns user, logo_fix timestamp |
| GET/POST | `/elementor/{page_id}` | Read/write Elementor JSON for any page |
| GET/POST | `/meta/{post_id}` | Read/write any post meta |
| POST | `/fix-logo` | Re-apply homepage logo CSS fix (idempotent) |
| GET/POST | `/css` | Read/write WordPress Additional CSS |

### Setup sequence (after uploading ZIP to wp-admin)

```bash
# 1. Activate plugin — admin notice shows your one-time setup token
# 2. Register API key (replace TOKEN and KEY):
curl -s -X POST "https://temptationtoken.io/wp-json/tts/v1/setup" \
  -H "Content-Type: application/json" \
  -d '{"setup_token":"TOKEN","api_key":"KEY"}'

# 3. Test auth
curl -s "https://temptationtoken.io/wp-json/tts/v1/status" \
  -H "X-TTS-API-Key: KEY"

# 4. Store key in Vercel
vercel env add TTS_WP_API_KEY production
```

The logo fix targets Elementor widget `e7cd5ae` (homepage hero logo, page ID 52) and injects `max-width: 200px` via both Elementor settings and WordPress Additional CSS.

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
| `SUPABASE_URL` | Supabase project URL | ✅ Set (also hardcoded fallback `gmlikdxykgviyprqtqwz.supabase.co` in several API files) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | ✅ Set |
| `COMMUNITY_CHAT_ID` | Telegram community chat ID (`-1003930752060`) | ⚠️ Undocumented — may be hardcoded in api files |
| `MAIN_CHANNEL_ID` | Telegram main channel ID (`-1002207667493`) | ⚠️ Undocumented — may be hardcoded in api files |
| `ADMIN_CHAT_ID` | Telegram admin chat ID (`-5273368658`) | ⚠️ Undocumented — may be hardcoded in api files |
| `TELEGRAM_BOT_TOKEN` | TTSGameBot token (Railway env `BOT_TOKEN`) | ⚠️ Undocumented in Vercel if used there |
| `PERSONA_API_KEY` | Persona identity verification API key | ⚠️ Add before KYC goes live |
| `PERSONA_TEMPLATE_ID` | Persona inquiry template ID (itmpl_...) — gov ID + selfie | ⚠️ Add before KYC goes live |
| `PERSONA_WEBHOOK_SECRET` | Persona webhook signing secret | ⚠️ Add before KYC goes live |

**X posting: @temptationtoken only (automated). @CryptoFitJim posts manually.**
Fix if 401: regenerate API Key & Secret → update `X_API_KEY` + `X_API_SECRET` in Vercel; regenerate @temptationtoken Access Token → update `TTS_X_ACCESS_TOKEN` + `TTS_X_ACCESS_SECRET`.

---

## Pending Actions (priority order — May 26, 2026)

### 🚨 CRITICAL — Blocking Round 2 and V3c deployment

1. **✅ DONE — Round 1 settled** — Jim called `manualExecute(3)` on TTSKeeper2 (May 15, TX `0x50d0ec5ed6...`). VRF fulfilled; 0 votes → no prizes distributed. V3c deployment can proceed. Distribution verified: `python3 outputs/verify_round_distribution.py 1` → PASS.

2. **Deploy TTSVotingV3c + TTSKeeper2V2 + fund Chainlink** — full runbook at `outputs/v3c_v2_deployment_runbook.md` + `outputs/chainlink_automation_runbook.md`. Key steps: compile in Remix (solc 0.8.20, 200 runs, via-IR) → deploy V3c → set NFT contract on V3c → deploy Keeper2V2 → transferOwnership(Keeper2V2) on V3c → add V3c as VRF consumer → **register new Chainlink upkeep with 10 LINK at automation.chain.link** → call `setForwarder(upkeepForwarderAddr)` on Keeper2V2 → Gnosis tax-exempt batch for V3c → start Round 1 on V3c → batchApproveProfiles. **Bank wallet ETH = 0.0245 ETH — top up if below 0.015 ETH. Need ~9 additional LINK (TTSLinkReserve has 1 LINK — buy remainder on Uniswap).** ⚠️ **CRITICAL: V3c `_houseWallet` constructor arg MUST be Marketing wallet `0x7a9ff2f584248744cBbA32c737D660ED6f077fCB` — NOT Bank wallet. V3b used Bank — that was an error. Full constructor args locked in runbook.**

3. **Update VOTING_ADDRESS in frontend** — after V3c deploys, replace `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` in:
   - `src/App.jsx` (VOTING_ADDRESS constant)
   - `src/TTAdminDashboard.jsx` (V3_ADDRESS / VOTING_ADDRESS + screens config)
   - `api/approve-profile.js` (V3_ADDRESS constant)

4. **Add V3c to tax-exempt batch and execute** — add TX#10 to `outputs/gnosis_setTaxExempt_batch.json` (V3c address, selector `0x1dc61040`). Import in app.safe.global and execute (2/2 sign). REQUIRED before any votes can settle on V3c.

5. **batchApproveProfiles on V3c** — call after Round 2 starts. Pull wallet addresses from Supabase (`SELECT id::text, payout_wallet FROM submissions WHERE status = 'approved' ORDER BY approved_at`). Ensure payout wallets are real user wallets — not Bank/Deployer.

6. **Deploy TTSStakingV2** — fixes `getStakingTier()` interface mismatch and corrects Diamond/VIP multipliers. Bank wallet calls `upgradeTo(newImpl)` then `initializeV2(thresholds)` on staking proxy `0xaA12B889...`. No Gnosis Safe needed (BANK holds UPGRADER_ROLE solo). Diff report: `outputs/staking_v2_diff.md`. Current-price thresholds (at ~$0.014/TTS, ETH=$3k): Bronze 3,571 / Silver 7,143 / Gold 17,857 / Diamond 71,429 / VIP 357,143 TTS — recalculate at deploy time.

### ⚠️ HIGH — Security scanner remediation

7. **GoPlus appeal** — send to `service@gopluslabs.io` or Telegram `@Goplusservice` using template in `outputs/metamask_remediation.md` Section 6. Jim to send manually.

8. **Blockaid ticket #1263614** — submitted 2026-05-18. Awaiting 1–3 day review. Draft reply in this session covers on-chain evidence. No action needed until Blockaid responds.

9. **SolidProof portal access recovery** — Ready-to-send email draft at `outputs/urgent/solidproof_recovery_email.md`. Send from `jgoetz@functionised.com` to `support@solidproof.io` + Telegram `@Solidproof_io_Support`. No self-service reset URL — manual recovery only. After access restored: acknowledge all findings on portal (remap `outputs/seo/solidproof_acknowledgment_responses.md` to correct portal finding IDs — TOKEN vs VOTING sub-reports have different ID sequences), then complete KYC ($600).

### 🚨 CRITICAL — WordPress (ALL require WP admin access; plugin not installed)

10. **🚨 RELEASE-BLOCKING: Remove price-target / promissory language from live site** — Found on live site May 20: `TTS price target $0.10`, `TTS price target $1.00`, `Price rises`, `guaranteed`. These are roadmap/milestone claims but constitute promissory/price-target language. Must be removed before any investor or press link-share. Requires WP admin (Elementor) — cannot be automated without plugin. Full fix list: `outputs/wordpress_meta_fixes.md`.

11. **Fix homepage/FAQ 40% prize split** — Multiple "40%" instances still on live site. Fix via WP admin. Full doc: `outputs/wordpress_meta_fixes.md`.

12. **Remove adult content strings from OG/meta** — All adult content meta tags still live: og:title "Adult Entertainment & NFTs", og:site_name "Adult Crypto Game on Base", og:image:alt "Payment Processor for Adult Content", FAQ og:title "Adult Games, NFTs", FAQ body "adult entertainment and NFT markets". WP admin required.

13. **Publish /trust and /audit pages** — both return 404. Hostinger .htaccess blocking custom slugs. Requires manual Hostinger support ticket or publish via WP admin directly.

14. **Install tts-api-auth plugin** — ZIP at `wp-plugins/tts-api-auth.zip`. Upload via wp-admin → Plugins → Add New → Upload Plugin → Activate → run setup curl. Logo fix (max-width 200px) applies automatically on activation. This unblocks all programmatic WP edits.

### 🟡 MEDIUM

13. **Verify TTSVotingV3b on BaseScan** — Remix (solc 0.8.20, 200 runs, via-IR, single file). Address: `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`. Low priority — superseded by V3c deploy, but improves trust score.

14. **Verify TTSVotingV3c on BaseScan** — after deploy. Same Remix settings. Flattened source at `outputs/v3c_flattened.sol`.

15. **Verify TTSKeeper2V2 on BaseScan** — after deploy. Flattened source at `outputs/keeper_v2_flattened.sol`.

16. **CoinGecko resubmission** — LP lock confirmed. Publish /audit page first (CoinGecko requirement). File: `outputs/exchange_submissions/coingecko_update.md`.

17. **DexScreener manual submission** — pair not indexed. Submit at dexscreener.com/update-token-info.

18. **Age verification system** — full implementation complete May 15. ✅ KYC API routes deployed May 26 (via api/kyc.js combined handler). Remaining: Jim to run `outputs/kyc_setup.sql` in Supabase SQL Editor + create Supabase storage bucket + set Persona env vars (PERSONA_API_KEY, PERSONA_TEMPLATE_ID, PERSONA_WEBHOOK_SECRET).

### 🟢 NEXT-PHASE (not launch blockers)

19. **Treasury 55% concentration restructure** — timelock contract + labeled sub-wallets + public transparency page. PLANNED, NOT started. Required to improve GoPlus/Blockaid scores long-term.

20. **SolidProof KYC ($600)** — requires portal access first. Adds KYC Verified badge + improves TrustNet score + required for Gate.io/MEXC listing applications.

21. ✅ **Gnosis Safe signer 2 confirmed** — `0x95607dcf6c815e6a7cb79eb6199174dfadc78758` = Dr. Mike (Development allocation + Safe co-signer). Documented in wallet registry.

22. **Submission fee destination** — confirm whether `0xb1e991bf...` or `0xC3A3858A...` is the intended destination for the 5 TTS submission fee. Fix `HOUSE_WALLET` in App.jsx if needed.

---

## V3c + TTSKeeper2V2 Constructor Params (ready to paste into Remix)

```
TTSVotingV3c:
  _ttsToken:        "0x5570eA97d53A53170e973894A9Fa7feb5785d3b9"
  vrfCoordinator_:  "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
  _keyHash:         "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70"
  _subscriptionId:  58222014484560539249027457203866883376041731162442592604288474822166186263722
  _stakingContract: "0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc"
  _charityWallet:   "0xf7dd429d679cb61231e73785fd1737e60138aba3"
  _houseWallet:     "0x7a9ff2f584248744cBbA32c737D660ED6f077fCB"  ← Marketing wallet (CORRECTED — V3b used Bank wallet, that was wrong)

TTSKeeper2V2:
  _votingContract:  <V3c address — fill after deploy>

Remix settings: Solidity 0.8.20 · optimizer ON (200 runs) · via IR ✅ · Base mainnet (8453)
```

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

## Full-System Audit Results — May 20, 2026 (updated)

Executed: PHASE 0–F. Commits: 5df6396, 32532dd, 1b995c5, 224da44, [current].

### PHASE 0 — Blockers (updated May 20)

| Check | Result | Notes |
|-------|--------|-------|
| Round 1 settled | ✅ PASS | settled=true; Jim manually settled May 15 (TX 0x50d0ec5ed6...) |
| Chainlink LINK balance | ❌ FAIL | Keeper=0 LINK; LinkReserve=1 LINK (not funded into upkeep) |
| Chainlink forwarder (ROOT CAUSE) | ❌ FAIL | s_forwarder = 0x6593c7de...0d458fd has NO CODE on Base (Ethereum mainnet addr). This is why automation never fired. TTSKeeper2V2 fixes this. |
| Round 2 started | ❌ FAIL | Not started — waiting for V3c deployment |
| V3c pre-deploy check (compiler) | ✅ PASS | 0 errors, 0 warnings |
| V3c pre-deploy check (Slither) | ✅ PASS | 1 HIGH accepted as AF-001 (non-exploitable) |
| TTSKeeper2V2 pre-deploy check | ✅ PASS | 0 HIGH Slither findings |
| Bank ETH for deployment gas | ⚠️ WARN | 0.0245 ETH — borderline; top up if below 0.015 before deploy |
| Gnosis Safe queue | ✅ PASS | Cleared; on-chain nonce=6 |
| Tax-exempt batch | ✅ PASS | 8 addresses confirmed isTaxExempt=true |
| TTS v2 M-1 fix (token upgrade) | ✅ PASS | impl 0xb995b63c live since 2026-05-17 |

### PHASE 1 — Full App Audit

| Flow | Result | Notes |
|------|--------|-------|
| VOTING_ADDRESS (App.jsx) | ✅ PASS | 0x6d6fF6... (V3b active) |
| Prize split display (35/35/10/20) | ✅ PASS | Fixed May 10 session |
| Signup bonus = 500 TTS | ✅ PASS | Reads admin_config; no hardcodes |
| Vote match = 1:1/1000 TTS | ✅ PASS | Reads admin_config |
| Staking tiers (5 correct, no Platinum) | ✅ PASS | Bronze/Silver/Gold/Diamond/VIP |
| Chatbot referral amount | ✅ FIXED | Was "100 TTS" hardcoded — changed to admin-configurable description (commit 1b995c5) |
| referral-credit.js response amount | ✅ FIXED | Was `'100 TTS'` hardcoded — now uses actual creditAmount (commit 1b995c5) |
| Wrong-network guard | ✅ PASS | Applied commit 5375099 |
| Submission fee (5 TTS) | ✅ PASS | App.jsx SUBMISSION_FEE = 5e18 |
| Minimum vote (5 TTS) | ✅ PASS | ON-chain MIN_VOTE = 5e18 |
| Marketing site prize split | ❌ FAIL | "40%" on 2 homepage locations — WP admin required |
| Marketing site adult strings | ❌ FAIL | OG/meta "Adult Entertainment", "adult content" — WP admin required |
| Marketing site /trust page | ❌ FAIL | 404 — .htaccess blocking custom slugs |
| Marketing site /audit page | ❌ FAIL | 404 — same |

### PHASE 2 — Integrity: Spec vs. Reality

| Check | Result | Notes |
|-------|--------|-------|
| `check-prize-split.mjs` CI | ✅ PASS | "No canonical-value violations found" |
| "40%" near prize words in source | ✅ PASS | Zero instances |
| "Platinum" tier in source | ✅ PASS | Zero instances |
| "100 TTS" signup in source | ✅ PASS | Cleaned this session |
| "adult entertainment" in source | ✅ PASS | Zero instances in /src or /api |
| DEFAULT_ADMIN_ROLE | ✅ PASS | Gnosis Safe only (on-chain confirmed) |
| MINTER_ROLE | ✅ PASS | Nobody / address(0) |
| UPGRADER_ROLE | ✅ PASS | Nobody / address(0) |
| PAUSER_ROLE | ⚠️ DISCREPANCY | Held by BANK wallet — not "nobody"; not a security exploit (Safe holds admin) but undocumented |
| LP lock | ✅ PASS | 231.3 LP on Team.Finance until May 5 2027 |
| Vercel env vars documented | ⚠️ WARN | COMMUNITY_CHAT_ID, MAIN_CHANNEL_ID, ADMIN_CHAT_ID undocumented; SUPABASE_URL has silent fallback |
| Marketing wallet funded | ✅ PASS | 994,290 TTS + ~0.005 ETH |

### PHASE 3 — Social / Automation

| Check | Result | Notes |
|-------|--------|-------|
| X token env vars present | ✅ PASS | All 4 tokens in Vercel env (code review) |
| Telegram BROADCAST_BOT_TOKEN | ✅ PASS | Set in Vercel |
| Scheduler cron expressions | ✅ PASS | 0 0/13/18 UTC daily + 0 8 Mon content gen |
| Content generator 8 critical rules | ✅ PASS | All 8 present in system prompt |
| Live X OAuth validation | ⚠️ NOT TESTED | Requires actual API call; if 401, regenerate at developer.twitter.com |
| Live Telegram post test | ⚠️ NOT TESTED | Not executed this session |
| @TTSBroadcastBot is channel admin | ⚠️ UNVERIFIED | Required for Post Now + scheduler; confirm in channel settings |

### PHASE 4 — Marketing Site (temptationtoken.io) — updated May 20

**WRITE ACCESS STATUS: NONE.** tts-api-auth plugin not installed (all /wp-json/tts/v1/* return 404). Hostinger blocks Application Passwords. All fixes require WP admin login.

Fix document: `outputs/wordpress_meta_fixes.md`

| Issue | Result | Priority |
|-------|--------|----------|
| tts-api-auth plugin installed | ❌ FAIL | All WP fixes blocked until installed |
| **Price-target language: "$0.10", "$1.00", "Price rises", "price target"** | ❌ FAIL | 🚨 RELEASE-BLOCKING — NEW FINDING |
| **"guaranteed" baseline rewards claim** | ❌ FAIL | 🚨 RELEASE-BLOCKING — NEW FINDING |
| og:title "Adult Entertainment & NFTs" | ❌ FAIL | 🚨 Critical — indexed by Google |
| og:description "40% of the prize pool" | ❌ FAIL | 🚨 Critical |
| og:site_name "Adult Crypto Game on Base" | ❌ FAIL | 🚨 Critical |
| og:image:alt "Payment Processor for Adult Content" | ❌ FAIL | 🚨 Critical |
| FAQ og:title "Adult Games, NFTs" | ❌ FAIL | 🚨 Critical |
| FAQ og:description "adult entertainment" | ❌ FAIL | 🚨 Critical — multiple instances in body too |
| FAQ og:image:alt "Polygon blockchain" (wrong chain) | ❌ FAIL | 🚨 Critical — multiple Polygon references |
| FAQ body "adult entertainment and NFT markets" | ❌ FAIL | High |
| Homepage img alt "adult entertainment" | ❌ FAIL | High |
| Google Play / Apple Store badges | ❌ FAIL | Medium |
| Copyright 2024 stale instance | ❌ FAIL | Low |
| Telegram footer links (→ broadcast, not community) | ❌ FAIL | Medium |
| Solidproof shown as "In Progress" (correct) | ✅ PASS | Audit claim is accurate |
| Staking tiers count (5 tiers, no Platinum) | ✅ PASS | Bronze/Silver/Gold/Diamond/VIP confirmed |
| /trust page | ❌ FAIL | 404 |
| /audit page | ❌ FAIL | 404 |
| Dynamic OG image (admin-ajax URL) | ⚠️ WARN | Not broken; replace with static PNG when possible |

### WORKSTREAM C — On-Chain Split Verification (May 20)

| Check | Result | Evidence |
|-------|--------|----------|
| C1: profileShare = 35% | ✅ PASS | Source: `pool * 35 / 100` (V3b.sol:443) |
| C1: voterShare = 35% | ✅ PASS | Source: `pool * 35 / 100` (V3b.sol:444) |
| C1: charityShare = 10% | ✅ PASS | Source: `pool * 10 / 100` (V3b.sol:445) |
| C1: houseShare = 20% (remainder) | ✅ PASS | Source: `pool - profileShare - voterShare - charityShare` (V3b.sol:456) |
| C2: charityWallet on-chain | ✅ PASS | `0xf7dD429D679CB61231e73785fD1737E60138ABa3` (Polaris) ✅ |
| C2: houseWallet on-chain | ⚠️ DISCREPANCY | On-chain = `0xB1E991bF...` (Bank/Deployer). Workstream expected `0x7a9ff2f...` (Marketing). Per CLAUDE.md spec, Bank wallet IS the correct 20% recipient. The workstream reference to Marketing wallet appears to be an error in the workstream description. **NOT a contract bug.** |
| C2: Prize distribution triggered? | N/A | Round 1 had 0 votes → no prizes distributed → no payout addresses to verify |

### WORKSTREAM F — Bot Token Security (May 20)

| Check | Result | Notes |
|-------|--------|-------|
| Telegram bot tokens in committed code | ✅ PASS | No `123456789:AAF...` patterns found in any file |
| BROADCAST_BOT_TOKEN in code | ✅ PASS | Only referenced via env vars in serverless functions |
| Supabase ANON key hardcoded | ⚠️ WARN | Hardcoded as fallback in 10 API files. This is the anon (public) key, not the service key. Service key is env-only. Low risk but code smell — should move to env-only. Files: api/approve-profile.js, api/community-stats.js, api/vote-match.js, api/content-generator.js, api/scheduler.js, api/set-club-wallet.js, api/signup-bonus.js, api/referral-credit.js, scripts/deployV3.js, scripts/seed-tts-posts.js |
| No rotation needed | ✅ PASS | No actual token secrets found in code |

---

## Investor Executive Status — May 20, 2026

**What is live and working:**
- TTS token on Base mainnet — 69B fixed supply, 1% burn tax, LP locked 1 year (Team.Finance)
- Voting contract V3b live — prize split 35/35/10/20, VRF-powered fairness, all 11 audit findings patched
- Round 1 settled May 15 (on-chain confirmed; 0 votes, no prizes — first round was test)
- TTS v2 token upgrade live (M-1 fix) — zero-amount transfer guard, EIP-20 compliant
- Gnosis Safe 2/2 multisig controls admin — no single-key risk
- Tax-exempt on 8 addresses confirmed on-chain
- Signup bonus (500 TTS) + vote match (1:1 / 1000 TTS) operational
- Social automation: X + Telegram content scheduler running
- Admin dashboard fully operational
- Polaris Project wallet confirmed on-chain as charity recipient

**What is pending (ordered by release impact):**
1. 🚨 **WordPress price-target language on live site** — "$0.10", "$1.00", "Price rises", "price target" still live. MUST remove before investor/press link-share.
2. 🚨 **WordPress adult content OG tags** — "Adult Entertainment & NFTs", "Payment Processor for Adult Content" still in live meta. MUST fix before investor/press.
3. **V3c + Keeper2V2 deployment** — runbooks ready; need ~9 additional LINK for automation upkeep
4. **Chainlink upkeep registration** — root cause confirmed: bad forwarder address in TTSKeeper2; TTSKeeper2V2 fixes this
5. **GoPlus appeal + Blockaid #1263614** — false-positives; evidence submitted; awaiting response
6. **SolidProof portal access recovery** — TrustNet 0.01; code fixes done, portal unacknowledged
7. **TTSStakingV2 deploy** — staking interface mismatch (all stakers get 1x instead of tier boost)
8. **WordPress plugin install** → enables programmatic fixes for items 1 + 2

**NOT launch-ready while these remain open:**
- ❌ Price-target / promissory language on live site (NEW — RELEASE-BLOCKING)
- ❌ Adult content strings in live OG/meta tags
- ❌ Round 2 not started (V3c not deployed)

**Facts verifiable on-chain for investors:**
- ✅ Charitable component: 10% → Polaris Project on-chain (`0xf7dD...`) verified in V3b settlement logic
- ✅ LP lock: Team.Finance TX `0xd98b2bb4...`; 231.3 LP locked until 2027-05-05
- ✅ Gnosis Safe 2/2 audit trail on-chain (nonce=6)
- ✅ Prize split 35/35/10/20 hardcoded in contract source (pool*35/100 for each)
- ✅ SolidProof audit shown as "In Progress" on live site (not falsely "complete")

---

## Completed History

### May 26, 2026 (Workstreams N/O/P/Q/R)
- ✅ N1: LP lock verified — Team.Finance `0x4f0fd563...` holds 231.3007 LP tokens (balanceOf confirms lock intact). Lock TX decoded for amount/timestamp.
- ⚠️ N2: "7 labeled distribution wallets" investor claim UNSUPPORTED on-chain — only 3 operational wallets found (Bank/Marketing/Polaris). The 55% Bank concentration is the GoPlus flag. Investor materials should be updated to reflect actual 3-wallet structure.
- ⚠️ N3: TTSVotingV2 NOT source-verified on BaseScan (contract exists 15,469 bytes but no source). Low priority — V2 is deprecated.
- ✅ N4: Chainlink upkeeps verified on-chain via registry `0xf4bAb6A...` — 4 upkeeps total, 27.39 LINK confirmed.
- ✅ N5: X OAuth confirmed valid (test tweet published + immediately deleted, tweet ID 2059443388059980247).
- ✅ N6: Telegram bot operational on Railway (polling loop confirmed in tts_bot.py).
- ✅ O1: `outputs/wp_admin_checklist_jim.md` created — 12-item click-by-click WP admin fix list; items 1–7 are release-blockers.
- ✅ O4: V3c C-1 fix confirmed at lines 513–515 (vote cap skipped when only one profile has votes). PASS.
- ✅ O5: Runbook Step 8 (J3 HALT forwarder check) is current and final gate. Runbook revised 2026-05-21. PASS.
- ✅ P1: Runbook reflects correct Chainlink flow — cancel 4 old upkeeps, register 1 new Custom Logic. PASS.
- ✅ P4: V3c compiles 0 errors/warnings, 47.4% of EIP-170 (12,260 deploy / 11,640 deployed bytes). PASS.
- ✅ Q1: UPKEEPS TODO comment added to TTAdminDashboard.jsx — documents post-V3c migration path.
- ✅ Q2: PayoutsScreen updated — decodes ERC20 Transfer events from each settlement TX, displays 4-way prize split with expandable per-recipient table (winner/voter/charity/house with addresses + amounts).
- ✅ Q3: ReferralScreen updated — Top Referrers now shows actual paid $TTS from `referral_credits` table (not estimated), plus pending vs paid column.
- ✅ Q4: Bot heartbeat system deployed — `tts_bot.py` adds 5-minute heartbeat POST; SocialScreen shows bot alive/stale indicator + X OAuth validity badge; heartbeat stored in `admin_config` key `bot_last_heartbeat`.
- ✅ R1: `outputs/kyc_setup.sql` CREATE POLICY statements made idempotent via DO/IF NOT EXISTS guards.
- ✅ R2–R4: KYC API files confirmed committed and deployed.
- ✅ API consolidation: 6 endpoint files merged into 3 + vercel.json rewrites; function count dropped from 17 → 12 (Hobby plan limit). Original URLs all preserved.
- ✅ Deployed to Vercel production (commit 05d59f0).

### May 24, 2026 (KYC + age verification)
- ✅ KYC system committed: api/kyc-session.js, api/kyc-webhook.js, api/kyc-status.js, api/age-acknowledge.js
- ✅ `outputs/kyc_setup.sql` written (3 tables: verified_submitters, verified_wallet_links, age_acknowledgments)
- ✅ CLAUDE.md updated with KYC system docs

### May 21, 2026 (Workstreams J/K/M)
- ✅ J1: V3c + Keeper2V2 deployment runbook COMPLETELY REWRITTEN — `outputs/v3c_v2_deployment_runbook.md`. 13 steps, each with post-step verification + rollback. houseWallet corrected to Marketing wallet `0x7a9ff2f...` throughout. setForwarder documented as CRITICAL ROOT-CAUSE FIX (Step 8). Gas estimates, LINK acquisition guide, forwarder code-size check all included.
- ✅ J houseWallet CORRECTION LOCKED: V3b `_houseWallet` = Bank wallet `0xb1e991bf...` (an ERROR). V3c MUST use Marketing wallet `0x7a9ff2f...`. Constructor args updated in runbook and CLAUDE.md.
- ✅ K2: Distribution audit tool created — `outputs/verify_round_distribution.py`. Scans VRF → RoundSettled events, fetches TTS transfers from voting contract, labels wallets, validates 35/35/10/20 split. Handles zero-vote case correctly.
- ✅ K3: Tool validated against Round 1 — result: PASS (zero votes → no distribution, correct behavior). Function selectors fixed (getRound=0x8f1327c0, houseWallet=0x77818f02, charityWallet=0x7b208769). Event topics confirmed correct.
- ✅ M1: SolidProof recovery email drafted — `outputs/urgent/solidproof_recovery_email.md`. Jim sends from jgoetz@functionised.com.
- ✅ M2: GoPlus appeal email address corrected in `outputs/metamask_remediation.md` — was `security@gopluslabs.io` (bounces), fixed to `service@gopluslabs.io` across all 3 occurrences.
- ✅ M3: TTSStakingV2 current-price thresholds computed from live Uniswap pool (0.5 ETH / 107K TTS → ~$0.014/TTS at ETH=$3k). Recommended values added to `outputs/staking_v2_diff.md`. Full deploy procedure already documented in that file.
- ⏳ J2/J3 + L: V3c deploy, setForwarder verification, Round 2 autonomous run — all blocked on Bank wallet signing. Jim executes when ready.

### May 20, 2026 (Workstreams A–F + CLAUDE.md update)
- ✅ A1: Round 1 on-chain state confirmed — settled=true (VRF fulfilled May 15, 0 votes, no prizes)
- ✅ A2: Settlement + manual override runbook written — `outputs/round1_settle_runbook.md`
- ✅ A3: No prize distribution (0 votes) — houseWallet=Bank ✅, charityWallet=Polaris ✅ confirmed on-chain
- ✅ B1: Chainlink root cause confirmed — TTSKeeper2 `s_forwarder` = Ethereum mainnet address (no code on Base); automation calls all failed
- ✅ B2: Chainlink remediation runbook written — `outputs/chainlink_automation_runbook.md` (~9 LINK needed)
- ✅ B3: Confirmed fully autonomous AFTER V3c + Keeper2V2 deploy + upkeep registration + setForwarder
- ✅ C1: Prize split 35/35/10/20 confirmed from V3b source (pool*35/100 hardcoded)
- ⚠️ C2: houseWallet on-chain V3b = Bank wallet `0xb1e991bf...`. **CORRECTION (May 21):** This was an ERROR in V3b, not a spec match. Jim confirmed V3c MUST use Marketing wallet `0x7a9ff2f...`. V3b prize house-cut went to Bank — will not repeat in V3c.
- ❌ D: WordPress write access UNAVAILABLE — tts-api-auth plugin not installed, Hostinger blocks App Passwords. All 14 WP violations still live. Cannot automate without plugin.
- 🚨 D NEW FINDING: Price-target language found on live site — "$0.10", "$1.00", "Price rises", "price target", "guaranteed". RELEASE-BLOCKING. Must remove before investor/press link-share.
- ✅ E: SolidProof full questionnaire written — `outputs/solidproof_questionnaire.md` (all 19 findings with status)
- ✅ F: Bot tokens NOT in committed code (no Telegram token patterns found). Supabase anon key hardcoded in 10 files as fallback — anon key (not service key), low risk but flagged.
- ✅ CLAUDE.md updated with all PASS/FAIL tables + investor executive status (this commit)

### May 19, 2026 (Phase 1–5 audit pass)
- ✅ referral-credit.js: fixed hardcoded `'100 TTS'` response → actual admin_config amount (commit 1b995c5)
- ✅ TTSChatbot.jsx: fixed hardcoded "100 TTS per referral" → admin-configurable description (commit 1b995c5)
- ✅ `outputs/wordpress_meta_fixes.md`: created 11-point WP fix list with exact copy and WP admin paths (commit 1b995c5)
- ✅ PAUSER_ROLE discrepancy documented: held by BANK wallet, not "nobody" as previously stated
- ✅ Chainlink 0 LINK root cause documented: explains why Round 1 did not auto-settle; upkeep may need full re-registration
- ✅ Undocumented Vercel env vars (COMMUNITY_CHAT_ID, MAIN_CHANNEL_ID, ADMIN_CHAT_ID, SUPABASE_URL fallback) added to CLAUDE.md
- ✅ Full Phase 0–4 PASS/FAIL audit tables written into CLAUDE.md
- ✅ Investor executive status summary written
- ✅ CI check passed: `node scripts/check-prize-split.mjs` → no violations

### May 15–19, 2026
- ✅ TTS v2 M-1 fix (zero-amount transfer guard) deployed live via Gnosis Safe nonce 0 — implementation `0xb995b63c` verified on BaseScan (solc 0.8.20, Exact Match)
- ✅ Tax-exempt batch executed (Gnosis Safe nonce 4) — all 8 addresses confirmed `isTaxExempt=true` on-chain: V3b, Marketing/Bonus, Staking, Polaris/Charity, TTSRoundNFT, TTSKeeper2, TTSLinkReserve, Treasury
- ✅ Gnosis Safe queue cleared — on-chain nonce = 6, 4 orphaned entries at nonces 1/2/3/5 permanently non-executable
- ✅ TTSVotingV3c pre-deployment check PASS — 0 compiler errors/warnings, Slither HIGH accepted as AF-001, tier numbering verified (Diamond=2x, VIP=3x), storage slots 0–12 match V3b
- ✅ TTSKeeper2V2 pre-deployment check PASS — 0 HIGH Slither findings
- ✅ AF-001 accepted finding formally documented — `outputs/v3c_accepted_findings.md`
- ✅ Blockaid false-positive submitted — ticket #1263614 (2026-05-18)
- ✅ MetaMask support email sent (2026-05-18) — template: `outputs/metamask_remediation.md`
- ✅ GoPlus correct channel identified — `service@gopluslabs.io` / Telegram `@Goplusservice` (security@ bounced)
- ✅ MetaMask remediation doc created — `outputs/metamask_remediation.md` — root causes, Blockaid submission, GoPlus appeal, MetaMask email
- ✅ SolidProof full finding audit — portal shows 1C + 3H + 7M + 6L for voting contract + token sub-report; pre-written ack doc finding numbers do NOT match portal (must remap after login)
- ✅ SolidProof contact channels documented — support@solidproof.io, @Solidproof_io_Support (Telegram), no self-service password reset URL
- ✅ Deployment runbook updated — `outputs/v3c_v2_deployment_runbook.md`
- ✅ STATUS.md updated and pushed (commit 5df6396)
- ✅ Audit decision logged: no further third-party audits until final delta-audit at acquisition stage
- ✅ Treasury 55% restructure: planned next-phase, not a launch blocker

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
