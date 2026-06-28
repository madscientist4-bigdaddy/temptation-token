# CLAUDE.md

Guidance for Claude Code working in this repo. **Canonical CURRENT-STATE only.**
Resolved sagas, dated audits, and superseded-contract narrative live in
[CLAUDE_HISTORY.md](./CLAUDE_HISTORY.md).

**Last verified: 2026-06-28.** V3d + TTSKeeper3 are LIVE on Base mainnet, fully
wired, Chainlink-automated, and the frontend is deployed to production
(`app.temptationtoken.io`). Round 1 on V3d has started (calendar-pinned). NFT
auto-mint is now authorized to V3d. Always re-verify on-chain values before acting
on them — facts here reflect the last verification, not real-time state.

---

## Operating Mode — Autonomous Execution

- Execute reads, file edits, code, git commits/pushes, npm/vercel commands, Supabase
  queries, BaseScan/RPC reads, and docs WITHOUT asking. Default to "yes"; make the
  call, document it, move on. Surface decisions after the fact, not before.
- **Only these require Jim's explicit confirmation:** (a) transactions from the Bank
  wallet, (b) transactions from the Gnosis Safe, (c) destructive irreversible actions
  (deleting prod data, canceling Chainlink upkeeps, dropping Supabase tables).
- Don't ask "should I proceed / commit / deploy?" — just do it if non-destructive and
  the build passes. Pick the better option when one is clearly better; the simpler one
  when equivalent.
- Note: pushing to `main` triggers Railway (bot) auto-deploy; Vercel deploys via
  `vercel --prod`. Treat a push/deploy as outward-facing — fine under autonomous policy,
  but be deliberate.

## Session Start
**"Read CLAUDE.md and continue from where we left off."** Check memory files for
session context. Re-verify on-chain state with the Alchemy RPC before acting.

---

## Commands
```bash
npm run dev          # Vite dev server
npm run build        # production build (chunk-size advisory is expected/OK)
npm run lint         # ESLint
node scripts/check-prize-split.mjs   # CI: canonical-value guard (run before commit)
python3 -m py_compile tts_bot.py     # bot syntax check
python tts_bot.py    # Telegram bot worker (separate process, runs on Railway)
```

## Deploy
```bash
npm run build && node scripts/check-prize-split.mjs   # local gate
npx vercel --prod                                     # app → Vercel
git push                                              # bot → Railway auto-deploys
```
Always `git add` + commit + push after a change (unless mid-task).

---

## Architecture

**Temptation Token ($TTS)** — Web3 "Hot or Not" voting game on Base mainnet. Submit
photos, vote with TTS, top voter + winning profile split the pool; charity + house take
cuts; losing votes burn.

Three systems:
1. **React SPA** (`/src`) — Vite + React 19, Vercel. All contract reads/writes happen
   client-side via Wagmi/Viem. `src/App.jsx` is the monolithic main UI (ABIs + addresses
   as top-of-file constants). `src/TTAdminDashboard.jsx` = password-gated admin panel.
   `src/TTSChatbot.jsx` = Claude support chatbot. `src/config/wallet.js` = Reown/Wagmi
   (Base only). `src/lib/txError.js` = shared user-reject vs failure helper.
2. **Vercel serverless** (`/api`) — **12 functions** (Hobby plan ceiling). See API table.
3. **Python Telegram bot** (`tts_bot.py`) — separate Railway worker; SQLite + Supabase.

Data layer: **Supabase** `gmlikdxykgviyprqtqwz` (Pro) primary DB; SQLite for the bot;
contracts on Base. Chain: Base mainnet (8453) ONLY — no testnet anywhere.

---

## Feature State (LIVE / PARTIAL / NOT-BUILT) — verified 2026-06-28

| Feature | State | Notes |
|---|---|---|
| Voting (V3d) | ✅ LIVE | Round 1 started, calendar-pinned, Chainlink-automated |
| Prize split 35/35/10/20 | ✅ LIVE | hardcoded in V3d; CI-guarded |
| Frontend (prod) | ✅ LIVE | `app.temptationtoken.io`, 12 functions |
| Admin dashboard | ✅ LIVE | server-side auth, gated data proxy, anon key purged |
| Club referral codes | ✅ LIVE | user enters club code on submit → auto-linked on-chain at admin approval. Club registration is admin-only |
| NFT auto-mint | 🟢 WIRED (unexercised) | V3d mints 3 NFTs on settlement (winner / top voter / house). Minter now = V3d (fixed 2026-06-28). `totalSupply()=0` — never minted yet (needs a round settling with ≥1 vote) |
| Telegram bot | ✅ LIVE + honest | running on Railway; staking/referral/VIP copy says "coming soon" — no undeliverable promises |
| **Staking** | 🔴 NOT-BUILT | No frontend stake/unstake/claim path — only a "Coming Soon" placeholder + cosmetic tier table. Deployed proxy `0xaA12B889…` is mis-initialized (`ttsToken=address(0)`); `getStakingTier()` reverts → voting falls back to **1x for everyone**. `contracts/TTSStakingV2.sol` is the compiled-but-undeployed fix |
| **User referral payouts** | 🔴 NOT-BUILT | "Refer & Earn" share link is a UI mockup; `?ref=` never read; `referrals`/`users.referred_by` never written; `/api/bonus?action=referral` has no caller. (Distinct from club codes above.) |

---

## Active Contracts (Base Mainnet)

### CANONICAL — V3d era

| Contract | Address | Status |
|---|---|---|
| **TTS Token (UUPS proxy)** | `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` | live (v2 impl `0xb995b63c`, M-1 fix) |
| **TTSVotingV3d (CANONICAL)** | `0x783b8cd80b586b723188c93ef94ee1beede617b4` | ✅ live, owns rounds |
| **TTSKeeper3 (CANONICAL)** | `0x363ce4960e3b459f5892587a37ae1ff2ed04442c` | ✅ owns V3d, automated |
| **TTSRoundNFT** | `0x0768e862D3AB14d85213BfeF8f1D012E77721da2` | minter = V3d (set 2026-06-28) |
| TTSStaking (proxy) | `0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc` | ⚠️ deployed but broken (1x for all) |
| Gnosis Safe (2/2) | `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86` | DEFAULT_ADMIN + UPGRADER |
| Uniswap V2 Pool | `0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68` | LP locked → 2027-05-05 |
| TTSLinkReserve | `0xE8006d8F36827c97fd8f2932d4D2198B833A432F` | — |

**SUPERSEDED — do NOT use** (kept for audit trail; details in history): TTSVotingV3b
`0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`, TTSVotingV3c
`0x916984DBaBFDF9B1c95b7507386330Bb37626112`, TTSVotingV2 `0x4dE347D5…`, TTSVotingV3
`0x49385909…`, TTSKeeper2 `0xB17b3842…`, TTSKeeper2V2 `0x24107a47…`. Old upkeep (V3c)
`107234397534438678…823641`. Several orphaned V3d duplicate deploys (2026-06-12) — see
history.

### V3d / Keeper3 — verified on-chain (2026-06-24/28)
- V3d `owner` = Keeper3 ✓ · `admin` = Bank ✓ · `nftContract` = TTSRoundNFT ✓
- V3d `houseWallet` = Marketing `0x7a9ff2f5…` ✓ · `charityWallet` = Polaris `0xf7dd429d…` ✓
- V3d is a **VRF consumer** on sub `58222014…263722` ✓ · **`isTaxExempt(V3d)=true`** ✓
- V3d `currentRoundId` = **1** (Round 1 started) · Round 1 `endTime` = `1782709140`
  (Mon 2026-06-29 04:59 UTC = Sun 23:59 EST)
- Keeper3 `votingContract`=V3d ✓ · `owner`=Bank ✓ · `s_forwarder`=`0x1aF4b2284bda534a54B6e9979dCA250Fe05Ddd82` ✓ · `s_nextSettleTarget`=`1783313940` (advances +604800/round)

### Chainlink Automation (V3d) — LIVE
- **Upkeep ID:** `113446314522587151772280129999432062856069985411437977877707978564657748455208`
- Registry `0xf4bAb6A129164aBa9B113cb96BA4266dF49f8743` · target Keeper3 · ~10 LINK ·
  not paused/cancelled · `getForwarder` = `0x1aF4b2284bda534a54B6e9979dCA250Fe05Ddd82`
- **VRF:** coordinator `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` · keyHash
  `0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70` · sub
  `58222014484560539249027457203866883376041731162442592604288474822166186263722`

### TTSVotingV3d source / behavior
- Source: `contracts/TTSVotingV3d.sol` (= V3c + `adminTransferOwnership`). Flattened:
  `outputs/v3d_flattened.sol`. Keeper: `contracts/TTSKeeper3.sol`,
  `outputs/keeper3_flattened.sol`. Tests: `test/TTSVotingV3d.t.sol` (20/20).
- **Calendar-pinned:** `endTime = s_nextSettleTarget` (a fixed UTC anchor), never
  `block.timestamp + duration` → zero drift. Anchor is UTC-5 (EST) fixed; in summer
  the wall-clock end is ~1h later (unavoidable, Chainlink is UTC-only).
- Settlement: VRF picks winner weighted by tickets → `_distributePayouts` pays shares,
  mints 3 NFTs (`try/catch`, gas-capped), burns remainder to `0x…dEaD`. 0 votes → no
  winner, no payout, no mint.
- **getProfile selector = `0xd6ca8383`** (`getProfile(uint256,string)`). The admin
  dashboard computes selectors from the ABI via viem (never hardcode — a wrong hardcode
  `0x76c2c389` previously broke per-profile reads).
- Remix verify settings: solc 0.8.20 · optimizer ON (200) · viaIR OFF · evmVersion paris.

---

## Wallets

| Label | Address | Purpose |
|-------|---------|---------|
| Bank / Deployer | `0xb1e991bf617459b58964eef7756b350e675c53b5` | Owner, house cut recipient, PAUSER + UPGRADER roles; NFT owner |
| Marketing / Bonus | `0x7a9ff2f584248744cBbA32c737D660ED6f077fCB` | V3d houseWallet; signup-bonus + vote-match payer |
| Polaris / Charity | `0xf7dd429d679cb61231e73785fd1737e60138aba3` | 10% charity cut |
| TTS Treasury | `0xC3A3858A3777E4C9B542e60298c3161086c5Faae` | 20B TTS reserve, tax-exempt |
| Gnosis Safe (2/2) | `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86` | Admin multisig; signers Jim + Dr. Mike; 10B TTS |
| Founder / Jim | `0xe5c3b6480164c20253c21928c699ab7fdb8a60e5` | 10B TTS, tax-exempt |
| Ecosystem / Chantea | `0xc17c1b5f653d66dc3324a0dc09d5500500f24ade` | 6B TTS, tax-exempt |
| Development / Dr. Mike | `0x95607DcF6c815e6A7cb79eb6199174DFADC78758` | 5B TTS; Safe co-signer |
| Team / Son | `0xb1c9868d4bfb10d2d7e51cd625889f2b9e1d4887` | 2B TTS, tax-exempt |
| Dr. Mike personal (unconfirmed) | `0xe43105c9abeff42bdb79e1dca275803bbcdf8cc1` | 1B TTS, NOT tax-exempt |

**Roles (TTS token):** DEFAULT_ADMIN = Gnosis Safe only. MINTER_ROLE = nobody. UPGRADER
= Safe **and Bank** (Bank revocation pending). PAUSER = Bank. 8 addresses are
`isTaxExempt=true` on-chain. Total supply 69B TTS, fixed, no mint function.

---

## Canonical Game Parameters

### Prize split (on-chain in V3d, CI-guarded — never write 40% near prize words)
Standard (no club): Top Voter **35%**, Winning Profile **35%**, Polaris **10%**, House
(Blockchain Entertainment LLC) **20%**. With club: 35/35/10 + Club **10%** + House
**10%**. **Pool = winning profile's raw votes only**; losing-profile votes burn to
`0x…dEaD`. House=Bank `0xb1e991bf…`, Charity=Polaris `0xf7dd429d…`.

### Round schedule (EDT/ET is the display TZ)
- Starts Monday 12:00 AM ET (≈04:00 UTC) · ends Sunday 11:59 PM ET (anchor 04:59 UTC,
  UTC-5 fixed). Automated by Keeper3 (calendar-pinned) + Chainlink crons.
- Vercel content/social crons: see `vercel.json` (00/12/13/15/17/18/19 UTC daily + Mon
  08 UTC content gen).

### Other locked params
- Min vote 5 TTS (`MIN_VOTE=5e18`). Submission fee 5 TTS (off-chain, `App.jsx`
  SUBMISSION_FEE → HOUSE_WALLET; destination `0xb1e991bf…` — confirm intent w/ Jim).
- Max vote cap 40% of round pool per profile (`MAX_VOTE_CAP_BPS=4000`; skipped on first
  vote). Signup bonus 500 TTS (admin-configurable). Vote match 1:1 up to 1,000 TTS
  (admin-configurable). Transfer tax 1% (hardcoded, permanent).

### Staking tiers (DESIGN INTENT ONLY — feature NOT built; contract gives 1x to all)
Bronze $50+ 8%/1.1x · Silver $100+ 12%/1.25x · Gold $250+ 18%/1.5x · Diamond $1,000+
32%/2x · VIP $5,000+ 45%/3x. No "Platinum" tier exists. Display USD + live TTS
equivalent. The bot/app/chatbot must present staking as "coming soon."

### Accepted security finding
- **AF-001** (Slither HIGH, reentrancy-eth in `vote()`): ACCEPTED, non-exploitable —
  TTS is a standard ERC-20 with no hooks, token addr immutable. Record:
  `outputs/v3c_accepted_findings.md`.

---

## API Endpoints (12 functions)

Consolidated; `vercel.json` rewrites preserve old URLs. Each `api/*.js` = 1 function.

| File | Routes / actions |
|---|---|
| `admin.js` | `?action=auth` (server-side login → HMAC token) · `?action=data` (token-gated Supabase proxy, service key, table allowlist). Rewrites: `/api/admin-auth`, `/api/admin-data` |
| `profiles.js` | `?action=list` (public approved profiles, safe fields only) · `?action=submit` (GET rate-limit / POST insert) · `?action=vote` (record vote). Rewrites: `/api/public-profiles`, `/api/submit-profile` |
| `bonus.js` | `?action=signup` · `?action=vote-match` · `?action=referral` (referral has no caller — inactive). Rewrites: `/api/signup-bonus`, `/api/vote-match`, `/api/referral-credit` |
| `kyc.js` | `?action=session\|webhook\|status\|age` (Persona KYC + 18+ ack). Rewrites: `/api/kyc-*`, `/api/age-acknowledge` |
| `approve-profile.js` | admin approve → `batchApproveProfiles` + `setProfileClub` on V3d (service key) |
| `set-club-wallet.js` | register/deregister club → `setClubWallet` on V3d |
| `community-stats.js` | community stats + bot heartbeat (`/api/bot-health`) |
| `content-generator.js` | weekly @temptationtoken post generation (cron) |
| `scheduler.js` | daily social/status crons |
| `social-post.js` | X/Telegram posting (`/api/notify` rewrite) |
| `chat.js` | Claude support chatbot (Haiku + web_search) |
| `rpc.js` | cached Base RPC proxy for the frontend |

### Security model (post-RLS-lockdown)
- Supabase **anon key is NOT in the frontend bundle**. All PII tables (`users`,
  `submissions`, `verified_submitters`, `bonus_claims`, `age_acknowledgments`,
  `verified_wallet_links`, `votes`) are read/written ONLY through server endpoints with
  the **service_role key**. RLS must stay ENABLED + deny-by-default for anon on those.
- Admin auth is server-side (`ADMIN_PASSWORD`); the dashboard holds an HMAC session
  token and proxies all data through `/api/admin-data`.
- Admin on-chain writes (Contract Settings) verify chain=8453, estimate gas, await
  receipt, and detect revert before reporting success.

---

## Vercel Environment Variables

**Required (deploy-blocking):** `ADMIN_PASSWORD` (server-side admin login),
`SUPABASE_SERVICE_KEY` (service_role — entire data layer + admin proxy + writes depend
on it). **Strongly set:** `ADMIN_SESSION_SECRET` (HMAC token secret; falls back to
ADMIN_PASSWORD). Already set: `DEPLOYER_PRIVATE_KEY`, `MARKETING_WALLET_PRIVATE_KEY`,
`ANTHROPIC_API_KEY`, `BROADCAST_BOT_TOKEN`, `X_API_KEY`/`X_API_SECRET`,
`TTS_X_ACCESS_TOKEN`/`TTS_X_ACCESS_SECRET`, `SUPABASE_URL`. Optional/has-fallback:
`ADMIN_USERNAME` (default `admin`), `SUPABASE_ANON_KEY`, `ADMIN_CHAT_ID`,
`MAIN_CHANNEL_ID`, `COMMUNITY_CHAT_ID`, `TELEGRAM_BOT_TOKEN`. KYC-only:
`PERSONA_API_KEY`/`PERSONA_TEMPLATE_ID`/`PERSONA_WEBHOOK_SECRET`. Auto-injected:
`VERCEL_*`. (Reminder: old admin password `TTS2026Admin!` shipped publicly — rotate.)

## Admin Config (Supabase `admin_config`)
Keys: `signup_bonus_tts` (500), `vote_match_cap_tts` (1000),
`vote_match_ratio_numerator`/`_denominator` (1/1), `bot_last_heartbeat`. Dashboard →
Settings → Bonus Configuration.

---

## Infrastructure
| Service | ID |
|---|---|
| Vercel | `temptation-token` (cryptofitjims-projects) — prod `app.temptationtoken.io` |
| Railway | `proud-unity` (Telegram bot, Hobby) |
| Supabase | `gmlikdxykgviyprqtqwz` (Pro) |
| GitHub | `madscientist4-bigdaddy/temptation-token` |

## Telegram
- Main bot `@TTSGameBot` (Railway `BOT_TOKEN`) · Broadcaster `@TTSBroadcastBot`
  (`BOT2_TOKEN` / Vercel `BROADCAST_BOT_TOKEN`).
- Channel `@temptationtoken` (`-1002207667493`) · Community `@TTSCommunityChat`
  (`-1003930752060`) · Admin chat `-5273368658` · VIP Vault `https://t.me/+F2lyVRf92n4xMDRh`.
- @TTSBroadcastBot must be admin in both channels for Post Now + scheduler.
- X posting: @temptationtoken automated only; @CryptoFitJim manual.

## WordPress (tts-api-auth plugin — bypasses Hostinger App-Password block)
- Base `https://temptationtoken.io/wp-json/tts/v1/` · header `X-TTS-API-Key:` (Vercel
  `TTS_WP_API_KEY`) · plugin `wp-plugins/tts-api-auth/`. Routes: `/setup`, `/status`,
  `/elementor/{id}`, `/meta/{id}`, `/fix-logo`, `/css`. **Plugin not yet installed** →
  WP edits blocked; live-site copy fixes (price-target/adult-content/40% strings,
  /trust + /audit 404s) remain pending. Detail in history + `outputs/wordpress_meta_fixes.md`.

## Content Generator CRITICAL RULES (`api/content-generator.js`)
All 8 must stay in the system prompt: (1) round schedule, (2) zero stakers framed as
opportunity, (3) staking not tied to round windows, (4) 1% transfer tax, (5) prize
split 35/35/10/20 — 40% near prize words FORBIDDEN, (6) signup bonus 500 TTS, (7) vote
match 1:1/1000, (8) burn = winning-profile pool only. Guard: `scripts/check-prize-split.mjs`.

---

## Known Gaps / Pending (not deploy-blockers for current scope)
- **Staking**: build frontend stake path + deploy `TTSStakingV2` (`upgradeToAndCall`
  initializeV2 from Bank) — see `outputs/staking_v2_diff.md`. Until then, voting tier
  boost is 1x for all.
- **User referral payouts**: wire `?ref=` capture → `referrals`/`referred_by` writes →
  call `/api/bonus?action=referral`. Currently a UI mockup.
- **NFT**: minter now V3d; will mint once a round settles with ≥1 vote (`totalSupply`
  still 0).
- **Trust/scanners**: SolidProof portal access + KYC ($600); GoPlus appeal
  (`service@gopluslabs.io`); Blockaid #1263614; CoinGecko/DexScreener resubmission.
  Detail + templates in history / `outputs/`.
- **WordPress**: install plugin, then fix live-site copy + publish /trust + /audit.
- **Roles**: revoke UPGRADER (and consider PAUSER) from Bank via Safe.
- **Submission fee destination**: confirm `0xb1e991bf…` vs `0xC3A3858A…` with Jim.
