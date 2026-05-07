# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build

python tts_bot.py  # Run Telegram bot worker (separate process)
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
   - `/api/signup-bonus.js` — POST `{ walletAddress }`: sends $5 USD of TTS (min 500, max 50,000) from Marketing wallet on first connect. Live Uniswap price. 20/day rate limit. Records in `bonus_claims` table. Requires `MARKETING_WALLET_PRIVATE_KEY` in Vercel env.
   - `/api/vote-match.js` — POST `{ walletAddress, voteAmount, txHash }`: matches first-ever vote up to 1,000 TTS from Marketing wallet. 50/day rate limit. Records in `bonus_claims` table. Requires `MARKETING_WALLET_PRIVATE_KEY`.

3. **Python Telegram bot** (`tts_bot.py`) — Runs as a separate worker (Procfile). Uses SQLite locally and integrates with the same Supabase instance.

### Frontend structure

- `src/App.jsx` — The entire main voting UI, including all contract ABIs and addresses as constants at the top of the file. This is intentionally monolithic.
- `src/TTAdminDashboard.jsx` — Password-protected admin panel. Tabs: Command Center, Daily Priorities, KPI Dashboard, Operations Manual, Overview, Photo Review, Content Calendar, Social Media, System Health, Payouts, Staking, Wallets, Referrals, Users, Settings. Password: `TTS2026Admin!`
- `src/TTSChatbot.jsx` — Claude-powered floating support chatbot, calls `/api/chat`
- `src/config/Wallet.js` — Wagmi + ReownAppKit (WalletConnect) config, Base chain only

### Data layer

- **Supabase** (`gmlikdxykgviyprqtqwz`) — Primary app database. Tables: `users`, `submissions`, `votes`, `rounds`, `stakes`, `scheduled_posts`, `bonus_claims`, `referral_settings`, `referral_credits`, `referrals`, `outreach_queue` (all created as of May 1 2026).
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
| Bank / Deployer | `0xb1e991bf617459b58964eef7756b350e675c53b5` | Owner, house wallet, receives 10% prize cut |
| Marketing / Bonus | `0x7a9ff2f584248744cBbA32c737D660ED6f077fCB` | Signup bonus + vote-match payments |
| Polaris / Charity | `0xf7dd429d679cb61231e73785fd1737e60138aba3` | Receives 10% charity cut every settlement |

---

## Canonical Game Parameters (never change without explicit instruction)

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

### Prize Distribution (hardcoded in `fulfillRandomWords`)

**No club involved (standard):**

| Recipient | Share | Address |
|-----------|-------|---------|
| Top Voter | 35% | Wallet with most votes on winning profile |
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

**Both splits sum to 100%.** The club's 10% comes from the house allocation. The previously circulated 40/40/10/10 and 60/20/10 splits are wrong and have been removed everywhere.

### Staking Tiers (locked April 29 2026)

| Tier | Min Stake (USD) | APR | Vote Boost |
|------|----------------|-----|-----------|
| Bronze | $50+ | 8% | 1.1x |
| Silver | $100+ | 12% | 1.25x |
| Gold | $250+ | 18% | 1.5x |
| Diamond | $1,000+ | 32% | 2x |
| VIP | $5,000+ | 45% | 3x |

**Display both USD threshold and live TTS equivalent in all UI.** TTS equivalent = USD ÷ current Uniswap price. Tier multipliers are hardcoded — changing tiers requires contract redeployment. "Platinum" tier does not exist — remove if found anywhere.

### Other Parameters

| Parameter | Value |
|-----------|-------|
| Minimum vote | 5 TTS |
| Profile submission fee | 5 TTS |
| Max vote cap per profile | 40% of pool per round |
| Signup bonus | 500–50,000 TTS (~$5 USD) from Marketing wallet |
| Vote match | First vote matched 1:1 up to 1,000 TTS from Marketing wallet |
| Transfer tax | 1% — permanent, hardcoded, cannot be changed |
| Total supply | 69,000,000,000 TTS — fixed, no mint function |

---

## LP Lock Status (locked May 6 2026)

**✅ LOCKED.** 231.3 LP tokens (100% of Uniswap V2 pool `0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68`) locked on Team.Finance until **May 5, 2027**. Lock TX: `0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da`. All exchange files and trust_page.html updated. lp_lock_instructions.md archived.

---

## TTSVotingV3b Security Patches (applied May 2026 — pending redeployment)

All 11 findings from the voting contract audit (audit ID 88b99f3a) are patched in `TTSVotingV3b.sol`:

| Fix | Type | Description |
|-----|------|-------------|
| Vote cap guard | CRITICAL | Skip 40% cap check when pool has only one profile (first vote) |
| CALLBACK_GAS_LIMIT | HIGH | 500k → 2500k; MAX_PROFILES_PER_ROUND = 50 |
| Zero-wallet checks | HIGH | require(wallet != address(0)) in approve + batch functions |
| SafeERC20 | HIGH | Inline library — all transfers use safeTransfer/safeTransferFrom |
| NFT mint gas cap | MEDIUM | try mint{gas:200000}(...) {} catch {} |
| adminResetSettlement() | MEDIUM | Owner can reset stuck VRF after 1 day |
| rolloverRound endTime | MEDIUM | require(block.timestamp >= r.endTime) |
| Constructor guards | LOW | Zero-address checks for token, charity, house |
| Admin setter events | LOW | CharityWalletUpdated, HouseWalletUpdated, NFTContractUpdated |
| MultiplierFallback event | LOW | Emitted in _applyMultiplier catch block |

Foundry tests: 4/4 pass. `forge create` command from May 6 session. Waiting for Jim to deploy.

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
| `X_ACCESS_TOKEN` | @CryptoFitJim — not used by automation (Jim posts manually) | — |
| `X_ACCESS_SECRET` | @CryptoFitJim — not used by automation | — |
| `TTS_X_ACCESS_TOKEN` | @temptationtoken user token — all automated X posts | ✅ Set |
| `TTS_X_ACCESS_SECRET` | @temptationtoken user secret | ✅ Set |
| `SUPABASE_URL` | Supabase project URL | ✅ Set |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | ✅ Set |

**X posting: @temptationtoken only (automated). @CryptoFitJim posts manually.**
- Only credentials needed: `X_API_KEY`, `X_API_SECRET`, `TTS_X_ACCESS_TOKEN`, `TTS_X_ACCESS_SECRET`
- `X_ACCESS_TOKEN` / `X_ACCESS_SECRET` (Jim) are no longer used by any automation
- Fix if 401 (Jim action — developer.twitter.com):
  1. Regenerate API Key & Secret → update `X_API_KEY` + `X_API_SECRET` in Vercel
  2. While logged in as @temptationtoken: Keys & Tokens → Access Token & Secret → update `TTS_X_ACCESS_TOKEN` + `TTS_X_ACCESS_SECRET` in Vercel
  3. Verify: `POST /api/social-post {"_test_x_post":true,"account":"temptationtoken"}`

---

## Pending Actions (priority order)

1. **🚨 batchApproveProfiles on new V3b** — New contract `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` has no approved profiles yet. Jim must run the cast send command (see Task 4 below / Completed History). Without this, voting cannot start in Round 2.
2. **X social media credentials broken** — X_API_KEY (`IbtlJxK5xF...`) returns 401 on all calls. Jim must go to developer.twitter.com, regenerate API Key+Secret, update `X_API_KEY` + `X_API_SECRET` + `X_ACCESS_TOKEN` + `X_ACCESS_SECRET` + `TTS_X_ACCESS_TOKEN` + `TTS_X_ACCESS_SECRET` in Vercel. After fix: `POST /api/social-post {"_test_x_post":true,"account":"cryptofitjim"}` to verify.
3. **Solidproof pending items** — (a) acknowledge M-1/M-2/M-3 on portal, (b) complete $600 KYC (checklist: `outputs/urgent/solidproof_kyc_checklist.md`), (c) resubmit to Blockaid with audit URL.
4. **Publish website content** — trust_page.html → temptationtoken.io/trust, audit_page.html → temptationtoken.io/audit. WordPress REST API requires .htaccess fix for Hostinger (add RewriteRule before WordPress block). Then run `outputs/wordpress_updates/wp_updates.sh`.
5. **CoinGecko resubmission** — LP lock is complete ✅. Ready to submit. File: `outputs/exchange_submissions/coingecko_update.md`.
6. **Verify TTSVotingV3b on BaseScan** via Remix (Foundry bytecode mismatch — use Remix with same compiler settings, solc 0.8.20, 200 runs, via_ir=true). New address: `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`.
7. **Deploy TTS v2 M1 fix** through Gnosis Safe multisig.
8. ✅ **Marketing wallet funded** — 997,395 TTS + 0.005 ETH. Signup bonus (✅ live) + vote-match (✅ live) operational.
9. ✅ **LP locked** — 231.3 LP tokens locked May 6 2026, until May 5 2027. TX: `0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da`.
10. ✅ **New TTSVotingV3b deployed** — `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`, all 11 audit fixes, NFT contract set, keeper owns it.

---

## Planned V2 Token Contract Fixes

These changes are staged for the next UUPS proxy upgrade of the TTS token (0x5570eA97d53A53170e973894A9Fa7feb5785d3b9). Do **not** redeploy without Gnosis Safe 2/2 multisig approval. The upgrade transaction must go through the safe at 0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86.

### Fix 1 — Solidproof Medium Finding #1: Zero-Amount Transfer Guard

**Issue:** In both `transfer()` and `transferFrom()`, the tax logic runs even when `amount == 0`. This creates a risk of arithmetic underflow and violates EIP-20 compliance, which states that zero-value transfers MUST succeed without side effects.

**Fix:** Add an early return at the top of both functions, before any tax calculation:

```solidity
// In transfer():
function transfer(address to, uint256 amount) public override returns (bool) {
    if (amount == 0) return true;  // ADD THIS — EIP-20 compliance + underflow guard
    // ... existing tax logic below
}

// In transferFrom():
function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
    if (amount == 0) return true;  // ADD THIS — EIP-20 compliance + underflow guard
    // ... existing allowance + tax logic below
}
```

**Why:** EIP-20 requires zero-value transfers to succeed. Without this guard, protocols that send 0-value transfers for accounting purposes will revert unexpectedly. Also prevents the `taxAmount = amount * 100 / 10000` calculation from producing unexpected results on edge-case amounts.

**Implementation contract:** 0xb995b63cdf848b7884cdc51da82e4a80ad02395a (M1 fix, pending upgrade)
**Upgrade path:** Deploy new implementation → Gnosis Safe proposeUpgrade transaction → 2/2 sign → execute

---

### ✅ Completed (May 6 2026)
- ✅ TTSVotingV3b redeployed with all 11 audit fixes at `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` — vote cap bug, SafeERC20, gas limits, zero-address checks, NFT gas cap, adminResetSettlement, constructor guards, events
- ✅ LP locked — 231.3 LP tokens on Team.Finance until May 5 2027, TX: `0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da`
- ✅ VOTING_ADDRESS updated in all files: App.jsx, TTAdminDashboard.jsx, approve-profile.js, set-club-wallet.js, content-generator.js, scheduler.js, CLAUDE.md
- ✅ LP lock status updated in all exchange files (coingecko, mexc, gateio, dexscreener, coinmarketcap), trust_page.html (badge, sec-card, cannot section, address row, JSON-LD), Enticement Paper
- ✅ WordPress /audit and /trust page creation blocked by Hostinger stripping Authorization header — fix: add RewriteRule to .htaccess before WordPress block (Jim action)
- ✅ WordPress .htaccess fix confirmed needed (Hostinger shared hosting Apache)

### ✅ Completed (May 1 2026)
- MARKETING_WALLET_PRIVATE_KEY corrected in Vercel (was wallet address, now actual private key)
- All 11 Supabase tables exist (referral_credits, referrals, outreach_queue added May 1)
- Chainlink crons updated: Start `0 4 * * 1`, Settle `59 3 * * 1`
- Marketing wallet ETH funded (0.005 ETH for gas)
- index.html SEO: OG tags, Twitter cards, JSON-LD schema added
- Admin Wallets tab expanded: 8 wallets (added Marketing, Staking, NFT, Keeper)

---

## Session Start Instruction

**Every session: "Read CLAUDE.md and continue from where we left off."**

Check memory files for any session-specific context.

---

## Completed History

### April 28 – May 1, 2026

- ✅ TTSVotingV3b (final, Round 1) deployed at `0xbc54432BB2D1Ef95e940e024dA604dbb9e9846F8` (deprecated — replaced May 6)
- ✅ Round 1 started April 28 21:10 UTC — ends May 5 21:10 UTC — 14 profiles
- ✅ api/signup-bonus.js + api/vote-match.js (bonus system, private key corrected May 1)
- ✅ Marketing wallet ETH funded (May 1); TTS balance still 0 — needs TTS transfer
- ✅ Live NFT display in App.jsx (balanceOf → tokenOfOwnerByIndex → tokenURI → OpenSea links)
- ✅ Admin dashboard full overhaul — 15-tab CENTCOM; Wallets tab expanded to 8 wallets
- ✅ Content Calendar — weekly auto-generation, approve, post
- ✅ Staking tiers canonical update — removed Platinum, locked 5-tier structure
- ✅ Prize distribution fixed everywhere — 40/40/10/10
- ✅ Round schedule fixed everywhere — EDT-based
- ✅ Chainlink crons updated to EDT: `0 4 * * 1` (start), `59 3 * * 1` (settle)
- ✅ Social post timing fixed — 19:00 UTC (2pm EST / 3pm EDT)
- ✅ content-generator.js Supabase insert fixed (normalized row keys)
- ✅ All 11 Supabase tables present (referral_credits, referrals, outreach_queue added May 1)
- ✅ index.html SEO: meta description, OG tags, Twitter cards, JSON-LD schema
- ✅ @TTSBroadcastBot confirmed admin on both channels
- ✅ Operations Manual staking reference added
- ✅ Outputs folder: daily_operations.md, blog posts (5), social SVGs (7), trust_page.html, enticement paper, investor one-pager, exchange submissions, income streams doc

### Technical Notes

- `setNFTContract` reverts on V3b — function absent from deployed bytecode (deployed before NFT code added). Fix requires redeployment after Round 1 settles.
- Staking contract at 0xaA12B889... is a UUPS proxy. Implementation 0x370b8fd7... is unverified. Tier multipliers are hardcoded constants — no admin setters found. Tier update = redeploy.
- RoundSettled topic hash: `0xabf0728119ba3c53309b0f987eda834ecf31e54dfaeec92465c1512c5eb9c2b9`
- VRF V2.5 subscription ID: `58222014484560539249027457203866883376041731162442592604288474822166186263722`
- Total staked on-chain: 0 (no stakers yet as of April 30)
- Railway upgraded to Hobby plan April 24 — no expiry

---

## TTSVotingV3b Redeployment (after Round 1 settles — May 5+ EDT)

**COMPLETED May 6 2026** — New contract deployed at `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` with all 11 audit fixes. Old address `0xbc54432BB2D1Ef95e940e024dA604dbb9e9846F8` deprecated.

Constructor params (same as V3b, copy-paste into Remix):
```
_ttsToken:        "0x5570eA97d53A53170e973894A9Fa7feb5785d3b9"
vrfCoordinator_:  "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
_keyHash:         "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70"
_subscriptionId:  58222014484560539249027457203866883376041731162442592604288474822166186263722
_stakingContract: "0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc"
_charityWallet:   "0xf7dd429d679cb61231e73785fd1737e60138aba3"
_houseWallet:     "0xb1e991bf617459b58964eef7756b350e675c53b5"
```

Remix settings: Solidity 0.8.20 · @chainlink/contracts@1.2.0 · @openzeppelin/contracts@5.0.0 · optimizations ON (200 runs) · Base mainnet (8453)

Deployment sequence:
1. Deploy TTSVotingV3b.sol → note new address
2. `newV3b.transferOwnership("0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48")`
3. `keeper.setVotingContract(newAddress)`
4. `keeper.acceptVotingOwnership()`
5. `newV3b.setNFTContract("0x0768e862D3AB14d85213BfeF8f1D012E77721da2")`
6. `newV3b.batchApproveProfiles([...approved profile addresses for new round])`
7. Add newV3b as VRF consumer at vrf.chain.link/base
8. Update `VOTING_ADDRESS` in src/App.jsx + all api/ files
9. Deploy to Vercel
