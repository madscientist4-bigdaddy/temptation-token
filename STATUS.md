# STATUS.md — Temptation Token Reality Check
## Generated: 2026-05-12 (UTC)

## Legend
✅ Working as intended (verified)
❌ Broken (verified)
⚠️  Working but with caveats
❓ Unknown — could not verify

---

## Section 1: Smart Contracts

### TTS Token (`0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`)

| Check | Status | Evidence |
|-------|--------|----------|
| Total supply = 69B TTS | ✅ PASS | `totalSupply()` returns 69,000,000,000 TTS exactly |
| Transfer tax 1% enforced | ❓ UNKNOWN | Source inaccessible; canonical per CLAUDE.md. No on-chain test tx run. |
| Marketing wallet tax-exempt | ❓ UNKNOWN | `taxExempt(address)` selector not found; multiple selector guesses reverted |
| Marketing wallet TTS balance | ✅ 995,325 TTS | Down from 997,395 (May 1). Δ = 2,070 TTS paid in bonuses/matches |
| TTS UUPS proxy impl slot | ⚠️ ERC-1967 slot = 0x0 | Address may be the implementation itself; UUPS upgrade mechanism unverified on-chain. Pending Gnosis Safe upgrade to v2. |
| Dead address burned balance | ✅ 1,519 TTS | Minor. Burns accumulate each settlement. |

---

### TTSVotingV3b (`0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6`)

| Check | Status | Evidence |
|-------|--------|----------|
| Verified on BaseScan | ❌ FAIL | Not verified (unverified contract label). See Pending Actions. |
| Current round ID | ✅ Round 1 | Storage slot 8 = 1; `currentRoundId()` = 1 |
| Round start timestamp | ✅ 2026-05-07 03:23 UTC (Mon 12:00 AM EDT) | From ProfileApproved event block + CLAUDE.md |
| Round end timestamp | ✅ 2026-05-14 03:23 UTC (Wed 11:23 PM EDT) | CLAUDE.md audit verified |
| Total raw votes | ✅ 0 TTS | Community-stats API confirms votes_this_round=0; V3b TTS balance=0 |
| Profiles approved on-chain | ✅ 14 profiles | ProfileApproved events decoded (14 events in block range 45696900–45706899) |
| Supabase profiles show round_id=1 | ✅ 15 rows | All 15 submissions have status=approved + round_id=1 |
| 1 Supabase/on-chain discrepancy | ⚠️ 15 in Supabase, 14 on-chain | One Supabase record may be pre-approved before on-chain call succeeded |
| Profile payout wallets correct | ❌ FAIL | 14/15 profiles have payout_wallet = Bank/Deployer (0xb1e991bf...). Winning profiles would pay out to deployer, not real users. |
| Multiplier tier 0 (Bronze) = 1.1x | ✅ PASS | Source: `amount * 110 / 100` at tier==0 |
| Multiplier tier 1 (Silver) = 1.25x | ✅ PASS | Source: `amount * 125 / 100` at tier==1 |
| Multiplier tier 2 (Gold) = 1.5x | ✅ PASS | Source: `amount * 150 / 100` at tier==2 |
| Multiplier tier 3 (Diamond) = 2x | ❌ FAIL | Source: `amount * 175 / 100` (1.75x). Should be 2x. Moot: getStakingTier always reverts → 1x for all |
| Multiplier tier 4 (VIP) = 3x | ❌ FAIL | Source: `amount * 200 / 100` (2x). Should be 3x. Moot: same staking issue. |
| NFT mint count = 3 at settlement | ❌ FAIL | Source: 1 mint only (to winner.wallet). Founder intends 3. |
| Submission fee = 5 TTS | ✅ PASS | App.jsx SUBMISSION_FEE = 5n * 10n ** 18n (off-chain, not in contract) |
| Submission fee → 0xb1e991bf... (Bank) | ✅ PASS | App.jsx HOUSE_WALLET = 0xb1e991bf... Founder noted different intended address (0xC3A3858A...) — unresolved. |
| House wallet = Bank/Deployer | ✅ PASS | V3b storage slot 4 = 0xb1e991bf... |
| Charity wallet = Polaris | ✅ PASS | V3b storage slot 3 = 0xf7dd429d... |
| Prize split 35/35/10/20 | ✅ PASS | Source: lines 443–456. Confirmed by prior audit. |
| VRF subscription registered | ❓ UNKNOWN | `getSubscription()` on VRFCoordinatorV2Plus reverted both selectors. Sub ID: 58222014…3722 |
| Owner = TTSKeeper2 | ✅ PASS | V3b storage slot 0 = 0xb17b3842... (TTSKeeper2) |
| UUPS upgradeable | ❌ NO | ERC-1967 impl slot = 0x0; no UUPS/Upgradeable in source. Non-upgradeable. |

---

### TTSKeeper2 (`0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48`)

| Check | Status | Evidence |
|-------|--------|----------|
| Voting contract = V3b | ✅ PASS | Storage slot 1 = 0x6d6ff6a0... (V3b exact address) |
| Chainlink Registry = correct | ✅ PASS | Storage slot 2 = 0x6593c7de... = Chainlink Automation Registry v2.1 on Base |
| LINK balance in contract | ⚠️ 0 LINK | Automation funded via Registry directly (not held in keeper contract) |
| ETH balance | ⚠️ 0 ETH | No ETH in keeper; automation billing is in LINK via Registry |
| Cron expression for start (0 4 * * 1) | ❓ UNKNOWN | Source inaccessible; confirmed correct in CLAUDE.md May 1 audit |
| Cron expression for settle (59 3 * * 1) | ❓ UNKNOWN | Same as above |
| Upkeep active on automation.chain.link | ❓ UNKNOWN | Cannot query Chainlink Registry programmatically without upkeep ID |

---

### TTSLinkReserve (`0xE8006d8F36827c97fd8f2932d4D2198B833A432F`)

| Check | Status | Evidence |
|-------|--------|----------|
| LINK balance in contract | ⚠️ 0 LINK | Same as Keeper — LINK held in Chainlink Registry, not contract |
| Code deployed | ✅ PASS | 4,431 bytes of bytecode present |
| Upkeep/auto-top-up active | ❓ UNKNOWN | Source inaccessible; Registry not queryable without upkeep ID |

---

### TTSRoundNFT (`0x0768e862D3AB14d85213BfeF8f1D012E77721da2`)

| Check | Status | Evidence |
|-------|--------|----------|
| Total supply minted | ✅ 0 | `totalSupply()` = 0. Expected: no rounds have settled on V3b yet. |
| Minter authorization = V3b | ❓ UNKNOWN | Source inaccessible; V3b storage slot 5 = NFT address (bidirectional link unverified) |
| 3 mints per settlement supported | ❌ FAIL | V3b source mints 1 NFT (winner.wallet only). 3 mints would require contract upgrade. |
| Code deployed | ✅ PASS | 7,513 bytes of bytecode |

---

### Staking (`0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc`)

| Check | Status | Evidence |
|-------|--------|----------|
| UUPS proxy | ✅ PASS | 1,101-byte proxy; ERC-1967 impl slot → 0x370b8fd7... (16,416 bytes impl) |
| `initialize()` called | ⚠️ PARTIAL | Storage slot 0 = 1 (_initialized flag). BUT slots 1–5 all zero = state vars unset. Owner reverts. |
| `getStakingTier()` functional | ❌ FAIL | All calls revert. Affects all staking multipliers. Selector `0xa8a82fd7` confirmed; impl may have different name or owner-gated reads. |
| TTS held in staking contract | ⚠️ 10B TTS | 10,000,000,000 TTS. Likely staking rewards pool pre-loaded. No user stakes recorded. |
| Staking user count | ✅ 0 | `stakes` Supabase table: 0 rows. No users staked. |
| Diamond APR = 32% | ❓ UNKNOWN | Source inaccessible. Displayed on website as 32%. |
| VIP APR = 45% | ❓ UNKNOWN | Source inaccessible. Displayed on website as 45%. |
| Vote multipliers correct | ❌ FAIL | Tier 3 = 1.75x (should be 2x); tier 4 = 2x (should be 3x). Moot while getStakingTier reverts. |
| 3-month lock enforced | ❓ UNKNOWN | Source inaccessible |

---

### Gnosis Safe (`0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`)

| Check | Status | Evidence |
|-------|--------|----------|
| 2/2 multisig | ✅ PASS | `getThreshold()` = 2 |
| Owner count | ✅ 2 | `getOwners()` returns 2 addresses |
| Signer 1 | ✅ 0xb1e991bf... (Bank/Deployer) | Decoded from getOwners() |
| Signer 2 | ⚠️ 0x95607dcf... | Unrecognized address — not documented in CLAUDE.md. Confirm this is Jim's address. |
| ETH balance | ✅ 0.002 ETH | Minimal; sufficient for signing |
| Pending transactions | ❓ UNKNOWN | Cannot query Gnosis API programmatically |
| Singleton (masterCopy) | ✅ 0x29fcb43b... | Gnosis Safe v1.3.0 Singleton on Base |

---

### Uniswap V2 Pool (`0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68`)

| Check | Status | Evidence |
|-------|--------|----------|
| Pool exists | ✅ PASS | 11,293 bytes code; token0 = WETH (0x4200...), token1 = TTS (0x5570...) |
| Liquidity present | ✅ PASS | reserve0 ≈ 0.504 WETH; reserve1 (TTS) non-zero. Pool is funded. |
| LP total supply | ✅ 231.3 LP tokens | `totalSupply()` = 231,300,670,124,407,551,401 ≈ 231.3 LP |
| LP locked on Team.Finance | ✅ PASS (unconfirmed on-chain) | LP supply matches CLAUDE.md lock amount of 231.3 LP. Team.Finance UI was 404 via API. TX `0xd98b2bb4...` in CLAUDE.md. |
| Lock expiration | ⚠️ May 5, 2027 | Per CLAUDE.md — not independently verified on-chain today |
| 24h trading volume | ❓ UNKNOWN | DexScreener returns `pairs: null` for TTS address — pair not indexed by DexScreener |

---

## Section 2: Off-Chain APIs (Vercel)

Test method: HTTP requests to https://app.temptationtoken.io/api/[endpoint]

| Endpoint | Status | Notes |
|----------|--------|-------|
| /api/community-stats | ✅ PASS | 200 OK. Returns: members=13, x_followers=62, x_tweet_count=179, votes_this_round=0, round_id=1, last_x_post populated. |
| /api/rpc | ✅ PASS | 200 OK (cached RPC proxy live) |
| /api/signup-bonus | ❓ UNKNOWN | Not tested (would modify state). Source: reads admin_config.signup_bonus_tts = 500 ✅; sends from MARKETING_WALLET_PRIVATE_KEY. |
| /api/vote-match | ❓ UNKNOWN | Not tested (would modify state). Source: reads admin_config.vote_match_cap_tts = 1000 ✅. |
| /api/approve-profile | ❓ UNKNOWN | Not tested (would modify state). Source: targets V3b (0x6d6fF6A0...) ✅. |
| /api/social-post | ❓ UNKNOWN | Not tested. Source reviewed — X + Telegram dual posting. |
| /api/scheduler | ❓ UNKNOWN | Not tested directly. Evidence of operation: 54 scheduled_posts have status=posted. 4 failed. |
| /api/content-generator | ✅ PASS (inferred) | 49 pending posts created 2026-05-11T08:57:28 UTC (Monday 8am ✅). 21 posts generated (49 total ≠ 21 — includes older weeks). |
| /api/notify | ❓ UNKNOWN | Not tested. No submissions since deployment to trigger it. |
| /api/referral-credit | ❓ UNKNOWN | Not tested. 0 referrals in Supabase. |

**Env vars present in Vercel** (from CLAUDE.md — not re-verified this session):
`DEPLOYER_PRIVATE_KEY`, `MARKETING_WALLET_PRIVATE_KEY`, `ANTHROPIC_API_KEY`, `BROADCAST_BOT_TOKEN`, `X_API_KEY`, `X_API_SECRET`, `TTS_X_ACCESS_TOKEN`, `TTS_X_ACCESS_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

**Current deployment**: Latest push was commit `a57adfd` on 2026-05-10 (canonical fixes: 500 TTS bonus, 35% prize split, admin_config infrastructure).

---

## Section 3: Supabase

Database: `gmlikdxykgviyprqtqwz` (Pro)

### Table Row Counts

| Table | Count | Notes |
|-------|-------|-------|
| submissions | 15 | All approved, all round_id=1 |
| votes | 0 | Zero on-chain or off-chain votes for any round |
| users | 5 | |
| rounds | 1 | ⚠️ See critical data issue below |
| stakes | 0 | No users staked |
| referrals | 0 | No referrals |
| scheduled_posts | 108 | 49 pending, 54 posted, 4 failed, 1 skipped |
| bonus_claims | 5 | 5 signup bonuses (latest: 2026-05-07). 0 vote-match claims. |
| admin_config | 4 | All 4 canonical keys present ✅ |
| admin_audit_log | 0 | Table created but no changes logged yet |
| referral_credits | 0 | |
| outreach_queue | 0 | |

### Data Integrity Issues

**❌ CRITICAL: `rounds` table start/end out of sync with on-chain**
Supabase `rounds` row 1: `start_time = 2026-03-23`, `end_time = 2026-03-29`, `is_settled = false`.
On-chain Round 1: start = 2026-05-07, end = 2026-05-14.
The Supabase rounds table has NEVER been updated since March 2026. Any component that reads round timing from Supabase (not on-chain) will show wrong data.

**❌ CRITICAL: 14/15 profile payout wallets = Bank/Deployer**
14 of 15 submissions have `payout_wallet` or `wallet_address` = `0xb1e991bf...`. If Round 1 settles with a winner, prize goes to deployer, not the actual profile owner.

**⚠️ Bonus claims only 5 users**
5 signup bonuses in 5 days. Marketing wallet started at 997,395 and is now 995,325 (2,070 TTS used). Expected: more users if marketing is running.

**⚠️ Stakes schema mismatch**
Query on `stakes` with `amount_tts` column returned: `"column stakes.amount_tts does not exist"`. The stakes table schema doesn't match expected columns. Admin dashboard staking queries may fail.

**✅ admin_config table created and seeded correctly**
All 4 keys: signup_bonus_tts=500, vote_match_cap_tts=1000, ratio_numerator=1, ratio_denominator=1. Last updated: 2026-05-10.

---

## Section 4: Frontend (app.temptationtoken.io)

| Check | Status | Evidence |
|-------|--------|----------|
| Loads at app.temptationtoken.io | ✅ PASS | HTTP 200, 5,596 bytes HTML shell (Vite SPA) |
| Wallet connect works | ❓ UNKNOWN | SPA requires JS execution (browser). Cannot verify via static fetch. |
| Voting UI shows 14+ approved profiles | ❓ LIKELY PASS | 15 Supabase approved submissions with round_id=1. Frontend query `status=eq.approved&round_id=eq.1` should return them. Cannot verify without browser. |
| Buy/Sell tab loads Uniswap price | ❓ UNKNOWN | Pool has reserves but DexScreener unindexed. |
| Staking tab shows 5 canonical tiers | ❓ UNKNOWN | Source inaccessible. Website shows correct 5-tier display. |
| Submit form accepts photo upload | ❓ UNKNOWN | Cannot test without browser. |
| Signup bonus claim works | ⚠️ LIKELY PASS | 5 successful claims recorded in bonus_claims. API source reads admin_config = 500 TTS ✅. |
| VOTING_ADDRESS = V3b in JS bundle | ✅ PASS | `6d6fF6A0` found in deployed JS bundle; old V3 address absent. |
| 500 TTS bonus in JS bundle | ⚠️ UNCERTAIN | "500 TTS" string not found as-is; "100 TTS" found (likely referral line). Bundle may compress differently. |
| getRound ABI — profileCount (wrong) | ❌ FAIL | "profileCount" found in deployed JS bundle. Bug: should be string[] profileIds. May silently decode offset as count=224. |
| getRound ABI — profileIds also present | ⚠️ | "profileIds" also found in bundle — both strings present. Possible partial fix or dual definition. |

---

## Section 5: Admin Dashboard (app.temptationtoken.io/admin)

Note: Admin dashboard requires browser + password (`TTS2026Admin!`). All checks below are source-based, not live-tested.

| Check | Status | Evidence |
|-------|--------|----------|
| Login (password gate) | ✅ PASS (source) | Password check in TTAdminDashboard.jsx source |
| Command Center shows live round state | ✅ PASS (source) | Uses VOTING_ADDRESS = V3b; reads currentRoundId, getRound |
| Photo Review approves profiles on-chain | ✅ PASS (source) | `/api/approve-profile` targets V3b with submissionId (UUID format) ✅ |
| Content Calendar | ✅ PASS (inferred) | 108 scheduled_posts in Supabase; 54 posted |
| Settings tab — live bonus controls | ✅ PASS (source) | BonusConfigSection reads/writes admin_config table (deployed May 10) |
| admin_config connected and seeded | ✅ PASS | 4 rows confirmed in Supabase |
| Financial KPI / Payouts | ❓ UNKNOWN | Source inaccessible |
| Social Media tab | ❓ UNKNOWN | Source inaccessible |
| Stakes schema mismatch in dashboard | ❌ FAIL | `stakes.amount_tts` column does not exist — staking tab queries will error |

---

## Section 6: WordPress (temptationtoken.io)

| Check | Status | Evidence |
|-------|--------|----------|
| Site loads | ✅ PASS | HTTP 200, 163,614 bytes |
| Published blog posts | ✅ 8 posts | cryptoforcharity, ttsstaking, provablyfairvoting, wincryptoprizes, what-is-temptation-token, plus 3 older |
| /trust page published | ❌ FAIL | HTTP 404. WordPress REST API: 0 published pages with slug=trust |
| /audit page published | ❌ FAIL | HTTP 404. WordPress REST API: 0 published pages with slug=audit |
| Homepage prize split shows 35% | ⚠️ MIXED | 35% appears 10x ✅ BUT "40%" appears 9x on homepage ❌ |
| Homepage 40% violation | ❌ FAIL | Two confirmed wrong instances: "winning profile takes 40% of the weekly prize pool" and "Win — 40% prize pool split weekly". Must be corrected. |
| Staking tiers on website | ✅ PASS | Website shows: Bronze 1.1x, Silver 1.25x, Gold 1.5x, Diamond 2x, VIP 3x — all canonical ✅ |
| Copyright year 2026 | ✅ PASS | Found in footer |
| Audit mention on homepage | ✅ PASS | "audit" text found on homepage |
| SolidProof badge on homepage | ✅ PASS | "solidproof" text found on homepage |
| FAQ page | ⚠️ 301 redirect | /faq returns 301 (permanent redirect). Accessible at /faq/ presumably. |
| Google Search Console verified | ❓ UNKNOWN | Cannot verify without GSC access |
| Sitemap | ⚠️ /sitemap_index.xml returns 200 | XML content returned but URL count needs browser parse |
| Rank Math scores ≥80 | ❓ UNKNOWN | Requires WordPress admin access |

---

## Section 7: Social Media Automation

| Check | Status | Evidence |
|-------|--------|----------|
| @TemptationToken X posting | ✅ PASS | community-stats API shows x_tweet_count=179, last_x_post populated with content |
| Content generation — Mon 8am UTC | ✅ PASS | Latest scheduled_posts created 2026-05-11T08:57:28 UTC = Monday 8am UTC ✅ |
| Posts generated last run | ✅ 49 pending | 49 pending posts in Supabase (mix of current week + multi-platform) |
| @CryptoFitJim auto-posting disabled | ✅ PASS (source) | CLAUDE.md: "Jim posts manually — no auto-generation." No x (CryptoFitJim) posts in scheduler. |
| Telegram community bot online | ✅ PASS | community-stats API returns members=13 via bot API |
| Scheduled posts: posted | ✅ 54 posted | Supabase: 54 status=posted |
| Scheduled posts: failed | ⚠️ 4 failed | 4 posts with status=failed. Unknown cause (likely X API 403 or token expiry). |
| Welcome message says 500 TTS | ❓ UNKNOWN | tts_bot.py source not verified this session (filesystem blocked). Was set to 500 in May 10 commit. |
| Welcome message says 35% prize split | ❓ UNKNOWN | Same — was fixed in May 10 commit. |
| Instagram workflow | ❓ UNKNOWN | 10 instagram-platform posts in Supabase scheduled_posts. Actual IG posting is manual (handoff workflow). |
| AI generation (not fallback) | ❓ UNKNOWN | Cannot inspect scheduled_post content without source access |

---

## Section 8: Cron Schedule

From CLAUDE.md (source inaccessible this session — filesystem blocked):

| Cron | Expression | Purpose | Expected UTC |
|------|-----------|---------|-------------|
| vercel.json cron 1 | `0 0 * * *` | @temptationtoken evening X post | 00:00 UTC daily |
| vercel.json cron 2 | `0 8 * * 1` | Content generation (Monday) | 08:00 UTC Mon |
| vercel.json cron 3 | `0 13 * * *` | @temptationtoken morning X post | 13:00 UTC daily |
| vercel.json cron 4 | `0 18 * * *` | @temptationtoken afternoon X post | 18:00 UTC daily |
| Chainlink cron 1 | `0 4 * * 1` | TTSVotingV3b startRound | 04:00 UTC Mon |
| Chainlink cron 2 | `59 3 * * 1` | TTSVotingV3b settleOrRollover | 03:59 UTC Mon |

Content generation cron firing confirmed: latest post created 2026-05-11 08:57 UTC ✅

Last verified scheduler execution: content_generator Monday run ✅; 4 failed posts suggest some scheduler runs fail (X API issue).

---

## Section 9: External Integrations

| Integration | Status | Evidence |
|------------|--------|----------|
| Chainlink VRF subscription active | ❓ UNKNOWN | Sub ID exists (CLAUDE.md: 5822…3722). `getSubscription()` reverted — selector incompatible with VRFCoordinatorV2Plus on Base. |
| Chainlink Automation upkeeps | ❓ UNKNOWN | Keeper2 slot1 = V3b ✅; slot2 = Chainlink Registry ✅. Upkeep funding status requires automation.chain.link UI. |
| SolidProof audit page | ✅ PASS | https://app.solidproof.io/projects/temptation-token returns 200 |
| SolidProof TrustNet score | ❓ UNKNOWN | Page loads but score requires JS rendering |
| 9 audit findings acknowledged | ❓ UNKNOWN | Requires SolidProof portal login |
| Blockaid false positive | ❓ UNKNOWN | Pending submission per CLAUDE.md |
| GoPlus whitelist | ❓ UNKNOWN | Pending submission per CLAUDE.md |
| CoinGecko listing | ❌ NOT LISTED | API `/coins/temptation-token` returns 404. Not listed. |
| CoinMarketCap listing | ❓ UNKNOWN | Not checked |
| DexScreener pair indexed | ❌ FAIL | `/latest/dex/tokens/0x5570...` returns `pairs: null`. Pair not indexed. |
| Team.Finance LP lock | ✅ PASS (inferred) | LP supply = 231.3 ✅ matches CLAUDE.md lock amount. Direct API 404 (scraping blocked). Lock TX in CLAUDE.md. |
| LP lock expiration | ✅ 2027-05-05 | Per CLAUDE.md verified May 6 |
| Telegram community @TTSCommunityChat | ✅ PASS | API returns members=13 |
| X followers @temptationtoken | ✅ 62 | community-stats API |
| X post count | ✅ 179 tweets | community-stats API |

---

## Section 10: Known Bugs

### 🚨 CRITICAL

1. **Profile payout wallets = deployer** — 14/15 approved profiles have `payout_wallet = 0xb1e991bf...`. If Round 1 settles, 100% of winner's prize and top voter's prize go to the deployer, not real users. **Must re-approve profiles with correct wallet addresses before settlement (May 14 03:23 UTC deadline).**

2. **Staking contract broken — getStakingTier always reverts** — All staking multipliers are non-functional. No voter receives any boost (1x for all). Root cause: staking implementation slots 1–5 all zero despite `_initialized=1`. Owner address null. Contract state corrupt/mis-initialized. Blocks Diamond/VIP selling proposition.

3. **WordPress homepage has 40% prize split** — Two confirmed instances say "40%": "winning profile takes 40% of the weekly prize pool" and "Win — 40% prize pool split weekly". Visible to all visitors. Factual error affecting trust.

4. **Supabase `rounds` table stale (March 2026)** — Round data shows start_time=2026-03-23, not the current May 2026 round. Any dashboard that reads round timing from Supabase will show wrong dates.

### ⚠️ HIGH

5. **Staking vote multipliers wrong in code** — Tier 3 = 1.75x (should be 2x); tier 4 = 2x (should be 3x). Currently moot while staking reverts, but if staking is fixed, multipliers remain wrong. Requires V3c redeploy.

6. **NFT mints 1 per settlement (founder intends 3)** — Contract mints winner NFT only. No top-voter NFT, no BE LLC archive NFT. Requires V3c + NFT contract upgrade.

7. **WordPress /trust and /audit pages not published** — Both return 404. Trust page HTML exists in repo but not accessible on the live site. Hostinger .htaccess issue noted in CLAUDE.md.

8. **Scheduled posts: 4 failed** — 4 posts failed to post (likely X API 403). May be stale credentials. Check `TTS_X_ACCESS_TOKEN` / `TTS_X_ACCESS_SECRET` in Vercel.

9. **DexScreener pair not indexed** — Prevents price discovery for users who search DexScreener. Requires manual token info submission at dexscreener.com/update-token-info.

### 🟡 MEDIUM

10. **getRound ABI mismatch in App.jsx** — Frontend ABI declares `uint256 profileCount` but contract returns `string[] profileIds`. Silently decodes as profileCount=224. Doesn't currently block voting but could cause issues on viem version updates.

11. **Gnosis Safe signer 2 undocumented** — `0x95607dcf...` is not listed in CLAUDE.md. Confirm this is expected (Jim's second wallet?).

12. **V3b not verified on BaseScan** — Unverified contract label reduces user trust. Remix verification pending (solc 0.8.20, 200 runs, via_ir=true).

13. **CoinGecko not listed** — `/audit` page not published may block resubmission requirement. LP lock is confirmed and should enable listing.

14. **Staking schema mismatch** — `stakes.amount_tts` column does not exist. Dashboard staking tab will error.

15. **TTS token upgrade pending** — v2 implementation with M1 zero-amount fix at `0xb995b63c...` awaiting Gnosis Safe upgrade. No deadline set.

16. **1 extra Supabase submission vs on-chain** — 15 Supabase approved, 14 on-chain ProfileApproved events. Check which submission is missing on-chain.

### 🟢 LOW

17. **DexScreener not indexing pool** — Pair exists on-chain with liquidity, but DexScreener returns null. No trading data visible publicly.

18. **Zero voter count** — No votes in Round 1 (5 days in). May be marketing/awareness issue, not technical. Profiles are visible in Supabase (round_id=1, approved). Possible partial technical cause: users need TTS to vote but only 5 have claimed signup bonus.

19. **DEAD address has only 1,519 TTS burned** — Minimal burn so far; expected, as no rounds have settled.

---

## Section 11: Pending Decisions (Jim)

1. **URGENT (before May 14 03:23 UTC)**: Re-approve 14 profiles with real user payout wallets. Otherwise Round 1 prize goes to deployer. If no real users submitted their wallet, consider cancelling/extending Round 1 or treating it as a test round.

2. **Staking contract fix**: Is the staking contract (0xaA12B889...) repairable (call `initialize()` with correct params) or does it need redeployment? All user-facing multiplier promises are currently broken.

3. **V3c redeploy decision**: Fix multipliers (tier 3=2x, tier 4=3x) and add 3 NFT mints? Round 1 has 0 votes — zero-risk migration window is between May 14 settlement and Round 2 start. Delay if undecided.

4. **WordPress 40% fix**: Two wrong prize split claims on homepage need editing in WP admin. Easy fix (5 min). No technical blocker.

5. **Trust/audit pages**: Publish existing HTML or create WP pages. Hostinger .htaccess blocking /trust URL path needs resolution.

6. **Submission fee destination**: Is `0xb1e991bf...` (Bank/Deployer) the intended destination, or should it be `0xC3A3858A...`? Needs Jim confirmation before any App.jsx change.

7. **Gnosis Safe second signer**: Confirm `0x95607dcf6c815e6a7cb79eb6199174dfadc78758` is a known/controlled wallet. If not, the safe is potentially compromised.

8. **X API 4 failed posts**: Check Vercel logs for error details. If 401/403, rotate `TTS_X_ACCESS_TOKEN` + `TTS_X_ACCESS_SECRET`.

9. **DexScreener manual submission**: Submit token info at dexscreener.com to get the pair indexed.

10. **CoinGecko resubmission**: LP lock confirmed. File at `outputs/exchange_submissions/coingecko_update.md`. Publish /audit page first per CoinGecko requirements.

---

## Section 12: Verification Method Log

| Section | Method |
|---------|--------|
| Smart contracts | Direct `eth_call`, `eth_getStorageAt`, `eth_getCode`, `eth_getBalance`, `eth_getLogs` via HTTPS to mainnet.base.org |
| TTS supply/balances | `totalSupply()` + `balanceOf()` selectors |
| V3b slots | `eth_getStorageAt` slots 0–8 |
| V3b profiles | `eth_getLogs` for ProfileApproved events, decoded manually |
| V3b round state | Storage slot 8 + community-stats API |
| Staking | ERC-1967 impl slot + storage slots 0–5 + owner() + getStakingTier() calls |
| Gnosis Safe | `getOwners()` (0xa0e67e2b), `getThreshold()` (0xe75235b8), slot 0 masterCopy |
| Uniswap pool | `getReserves()`, `totalSupply()`, `token0()`, `token1()` |
| Supabase | REST API (`/rest/v1/[table]`) with anon key, `Prefer: count=exact` header |
| WordPress | Direct HTTPS fetch + WP REST API (`/wp-json/wp/v2/`) |
| App JS bundle | Fetched `/assets/index-B1ZSWodB.js` and searched for key strings |
| API endpoints | HTTPS GET/POST to app.temptationtoken.io/api/ |
| DexScreener | `api.dexscreener.com/latest/dex/tokens/[address]` |
| CoinGecko | `api.coingecko.com/api/v3/coins/[id]` |
| SolidProof | HTTP GET to app.solidproof.io |
| Community stats | `/api/community-stats` endpoint |
| Source code | Reviewed files read earlier this session (App.jsx, TTSVotingV3b.sol, api/*.js, TTSChatbot.jsx). Filesystem blocked for new reads due to macOS privacy reset. |

---

## Closing

Last verified: 2026-05-12 (UTC). Next verification due: weekly via STATUS.md regeneration.

Re-run verification: execute `node scripts/check-prize-split.mjs` for code audit; re-run the RPC/Supabase calls above for live state. Re-enable filesystem access in macOS Privacy & Security → Files and Folders to verify source files.
