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
   - `/api/social-post.js` — Posts to X (Twitter) and/or Telegram; supports `{type,data}` template mode OR `{platform:'telegram',content,chatId}` direct mode
   - `/api/scheduler.js` — Hourly cron: fires approved scheduled_posts + daily round status + auto-correction alerts (LINK < 2, round overdue, no posts 25h+)
   - `/api/content-generator.js` — Monday 8am UTC cron: generates weekly content via Claude Haiku, saves to `scheduled_posts` table
   - `/api/referral-credit.js` — Credits referrer wallet on new user signup
   - `/api/community-stats.js` — Returns Telegram community member count via bot API

3. **Python Telegram bot** (`tts_bot.py`) — Runs as a separate worker (Procfile). Uses SQLite locally and integrates with the same Supabase instance.

### Frontend structure

- `src/App.jsx` — The entire main voting UI, including all contract ABIs and addresses as constants at the top of the file. This is intentionally monolithic.
- `src/TTAdminDashboard.jsx` — Password-protected admin panel. Tabs: Command Center, Daily Priorities, KPI Dashboard, Operations Manual, Overview, Photo Review, Content Calendar, Social Media, System Health, Payouts, Staking, Wallets, Referrals, Users, Settings. Password: `TTS2026Admin!`
- `src/TTSChatbot.jsx` — Claude-powered floating support chatbot, calls `/api/chat`
- `src/config/Wallet.js` — Wagmi + ReownAppKit (WalletConnect) config, Base chain only

### Data layer

- **Supabase** — Primary app database: user profiles, photo submissions, votes, staking records. Client is initialized inline in `App.jsx`.
- **SQLite** — Used only by the Telegram bot worker.
- **Smart contracts on Base mainnet** — Token, Voting, Staking, Airdrop, NFT. Addresses are hardcoded constants in `App.jsx`.

### Wallet / Web3

- Chain: Base mainnet only (chainId 8453)
- Wallet connection: `@reown/appkit` with Wagmi adapter
- Contract reads/writes: Viem directly from the browser, no backend relay

### AI integration

The chatbot (`/api/chat.js`) uses `claude-haiku-4-5-20251001` with streaming disabled. The model has access to a `web_search` tool. The system prompt is defined inline in the API route.

## Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| TTS Token (UUPS Proxy) | `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` |
| TTS v2 Implementation (M1 fix, pending upgrade) | `0xb995b63cdf848b7884cdc51da82e4a80ad02395a` |
| TTSVotingV2 (deprecated) | `0x4dE347D547C7Ae2CB38c42A8166d29049C24e9DA` |
| TTSVotingV3 (deprecated — keeper-incompatible) | `0x49385909a23C97142c600f8d28D11Ba63410b65C` |
| **TTSVotingV3b (ACTIVE)** | **`0xEC339baD1900447833C9fe905C4A768D1f0cA912`** |
| TTSKeeper2 | `0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48` |
| TTSLinkReserve | `0xE8006d8F36827c97fd8f2932d4D2198B833A432F` |
| Gnosis Safe (2/2 multisig) | `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86` |
| Deployer wallet | `0xb1e991bf617459b58964eef7756b350e675c53b5` |
| Uniswap V2 Pool | `0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68` |

The v2 implementation is deployed but not yet active — the UUPS upgrade must go through the Gnosis Safe multisig.

## Infrastructure

| Service | Project/ID |
|---|---|
| Vercel | `temptation-token` (cryptofitjims-projects) |
| Railway | `proud-unity` (Telegram bot) |
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
- Broadcaster: `@TTSBroadcastBot` — token in Railway env as `BOT2_TOKEN`
- Main channel: `@temptationtoken`
- Community: `@TTSCommunityChat`
- VIP Vault invite: `https://t.me/+F2lyVRf92n4xMDRh`

## Completed (April 26, 2026)

- ✅ **Admin dashboard full overhaul** — 15-item CENTCOM pass:
  - Command Center with live round countdown + health traffic lights
  - Daily Priorities checklist (localStorage, auto-resets daily)
  - KPI Dashboard (Supabase + on-chain metrics)
  - Operations Manual with platform-linked templates
  - Alerts Banner (clickable, navigates to fix)
  - Railway plan updated to HOBBY (paid April 24) — no expiry warning
  - All hardcoded dates replaced with `getCurrentWeekLabel()` (auto-updates)
  - Live clock in topbar (updates every second)
  - Prize pool pulls live from TTSVotingV3.getRound() on-chain
  - Settlement history uses correct RoundSettled topic hash + eth_getLogs
  - Photo Review: shows pending+approved, status filter, "Register On-Chain" modal
  - Social Media tab: stats, Post Now (Telegram direct), DM outreach tracker, content preview, templates with platform links
  - System Health: Railway Hobby status, referral system status card
  - Auto-correction alerts in scheduler: LINK < 2, round overdue, no posts 25h+
  - Operations Manual templates with Open → links for each platform
  - Admin password: `TTS2026Admin!`
  - `api/community-stats.js` added (Telegram member count endpoint)
  - `api/social-post.js` updated to support direct telegram posting mode

- ✅ **Beta audit fixes** — XSS in photo link buttons, wallet auto-populate, form reset on error, referral link full address
- ✅ **TTSVotingV3** deployed + all steps complete (Round 1 active)
- ✅ **Content Calendar** — weekly auto-generation via Claude Haiku, X/Telegram/Instagram, one-tap approve
- ✅ **10 AI test profiles** in Supabase (status=approved, round_id=1)

## Pending items (priority order)

1. **Add @TTSBroadcastBot as admin** to @temptationtoken and @TTSCommunityChat Telegram channels (required for Post Now and scheduler to work)
2. **Verify TTSVotingV3 on BaseScan** via Remix (Foundry bytecode mismatch — must use Remix IDE)
3. **Deploy TTS v2 M1 fix** upgrade through Gnosis Safe (2/2 multisig)
4. **Wire dollar-value signup bonus** from live Uniswap price (POOL: 0x77Fe188...)
5. **Post-vote confetti animation** and position feedback in App.jsx
6. **CoinGecko resubmission** — check current status
7. **Blockaid** — submitted false positive reports; check portal for resolution status
8. **X social media credentials** — set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET in Vercel env to enable X posting

## Next session: start here

1. Check if @TTSBroadcastBot is added to channels (test Post Now button in Social Media tab)
2. Check if Round 1 has settled (round end ~April 28) — if not, verify TTSKeeper2 automation is working
3. If settled: start Round 2 via keeper.manualExecute(1) if automation missed it
4. Check Blockaid portal for false positive resolution

## TTSVotingV3 Deployment (✅ COMPLETE)

`TTSVotingV3.sol` uses **VRF V2.5** (confirmed from TTSVotingV2 deployment tx constructor args).
All params confirmed on-chain — zero placeholders.

### Why V3 is needed
TTSVotingV2's `approveProfile` is `onlyOwner` where owner = TTSKeeper2. TTSKeeper2 has no `approveProfile` wrapper. V3 adds a separate `admin` role (deployer) for profile approval while keeper retains `owner` for round management.

### Constructor params — copy-paste into Remix, no edits needed
```
_ttsToken:        "0x5570eA97d53A53170e973894A9Fa7feb5785d3b9"
vrfCoordinator_:  "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
_keyHash:         "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70"
_subscriptionId:  58222014484560539249027457203866883376041731162442592604288474822166186263722
_stakingContract: "0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc"
_charityWallet:   "0xf7dd429d679cb61231e73785fd1737e60138aba3"
_houseWallet:     "0xb1e991bf617459b58964eef7756b350e675c53b5"
```

Remix settings: **Solidity 0.8.20 · @chainlink/contracts@1.2.0 · @openzeppelin/contracts@5.0.0 · optimizations ON (200 runs) · Base mainnet (8453)**

How values were confirmed:
- `vrfCoordinator_` + `keyHash` + `subscriptionId` — decoded from TTSVotingV2 deployment tx `0xb84f607e...` constructor args
- `keyHash` independently matches Chainlink docs (Base mainnet VRF V2.5, 30 gwei lane)
- `_charityWallet` — provided by user (Polaris Project)

### Deployment sequence — ✅ ALL STEPS COMPLETE

1. ✅ **Deploy TTSVotingV3.sol** — deployed at `0x49385909a23C97142c600f8d28D11Ba63410b65C`
2. ✅ `V3.transferOwnership("0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48")`
3. ✅ `keeper.setVotingContract("0x49385909a23C97142c600f8d28D11Ba63410b65C")`
4. ✅ `keeper.acceptVotingOwnership()`
5. ✅ `keeper.manualExecute(1)` — Round 1 started
6. ✅ `V3.batchApproveProfiles(...)` — Dance TTS + Bunny Butt approved
7. ✅ V3 added as VRF consumer
8. ✅ `VOTING_ADDRESS` updated in `src/App.jsx`
9. ✅ Deployed to Vercel production

### Notes
- `scripts/deployV3.js` fetches live Supabase profiles and outputs calldata — rerun each round
- Staking tier multiplier is a graceful no-op (staking contract doesn't expose `getStakingTier`)
- `0x6593c7De001fC8542bB1703532EE1e5aA0D458fD` (keeper slot 2) is the Chainlink Automation Registry, NOT the VRF coordinator
- V2 (`0x4dE347D547C7Ae2CB38c42A8166d29049C24e9DA`) becomes unused once keeper points to V3
- **Railway**: upgraded to Hobby plan April 24, 2026. No further action needed.
- **RoundSettled topic hash**: `0xabf0728119ba3c53309b0f987eda834ecf31e54dfaeec92465c1512c5eb9c2b9`
