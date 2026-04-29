# End-to-End System Test — Temptation Token
_Run after each major deploy. Tested against https://app.temptationtoken.io_

## Frontend — Core Flows

| # | Feature | Test | Expected | Status |
|---|---------|------|----------|--------|
| 1 | Wallet connect | Click Connect → approve in wallet | Address shown in header, balance loads | ✅ verified |
| 2 | Signup bonus | Connect new wallet | Toast "Welcome bonus: +N $TTS sent!", balance increases | ⚠️ requires MARKETING_WALLET_PRIVATE_KEY in Vercel env |
| 3 | Balance display | Connect wallet with $TTS | Shows correct $TTS balance | ✅ verified |
| 4 | Photo feed | Navigate to Play tab | Photos load for current round | ✅ verified |
| 5 | Vote | Enter vote amount → Confirm | Approval tx + vote tx → balance decreases, vote count increases | ✅ verified |
| 6 | First-vote match | Cast first-ever vote | Toast "First-vote match: +N $TTS sent!", balance increases | ⚠️ requires MARKETING_WALLET_PRIVATE_KEY |
| 7 | Celebrate animation | After vote confirms | Celebration overlay appears for 4.5s | ✅ verified |
| 8 | Share banner | After vote | Share prompt appears with voter name + amount | ✅ verified |
| 9 | NFT tab — no wallet | Open NFTs tab without connecting | "Connect wallet to view trophies" | ✅ code correct |
| 10 | NFT tab — wallet, no NFTs | Open NFTs tab (no trophies yet) | "No NFTs yet" empty state | ✅ code correct |
| 11 | NFT tab — wallet with NFTs | Open NFTs tab (wallet has trophies) | Grid of NFT cards with image + name | ⚠️ not testable until a round settles |
| 12 | Leaderboard | Open Leaderboard tab | Profiles ranked by vote count | ✅ verified |
| 13 | Submit tab | Open Submit, fill form | Photo submission recorded in Supabase | ✅ verified |
| 14 | Referral tab | Open Refer tab | Referral link with wallet address | ✅ verified |
| 15 | Buy/Sell tab | Open Buy/Sell | Uniswap embed + staking info loads | ✅ verified |

## API Routes

| # | Route | Test | Expected | Status |
|---|-------|------|----------|--------|
| 16 | POST /api/signup-bonus | `{ walletAddress }` new wallet | `{ success: true, amount, txHash }` | ⚠️ requires env key |
| 17 | POST /api/signup-bonus | Same wallet twice | `{ alreadyClaimed: true }` | ✅ code correct |
| 18 | POST /api/signup-bonus | No MARKETING_WALLET_PRIVATE_KEY | `{ success: false, reason: 'Bonus system not yet funded' }` | ✅ code correct |
| 19 | POST /api/vote-match | `{ walletAddress, voteAmount: 500 }` first vote | `{ success: true, matchAmount: 500, txHash }` | ⚠️ requires env key |
| 20 | POST /api/vote-match | Same wallet second call | `{ success: false, alreadyClaimed: true }` | ✅ code correct |
| 21 | POST /api/vote-match | `voteAmount: 2000` | `{ matchAmount: 1000 }` — capped at 1,000 | ✅ code correct |
| 22 | GET /api/community-stats | GET request | `{ members: N }` | ✅ verified |
| 23 | POST /api/notify | Submission notify | Telegram admin message sent | ✅ verified |
| 24 | POST /api/content-generator | Force regenerate | 17 rows inserted in scheduled_posts | ✅ structure correct |
| 25 | POST /api/scheduler?action=fire&id=UUID | Fire a pending post | Post sent to Telegram or X | ✅ verified (Telegram) |

## Admin Dashboard

| # | Tab | Test | Expected | Status |
|---|-----|------|----------|--------|
| 26 | Login | Enter `TTS2026Admin!` | Dashboard unlocks | ✅ verified |
| 27 | Command Center | Load | Live round countdown, health lights, LINK balance | ✅ verified |
| 28 | KPI Dashboard | Load | Game/User/Financial/Bonus sections populate | ✅ code correct |
| 29 | KPI — Bonus Section | After bonuses sent | Signup count + TTS, vote-match count + TTS | ✅ code correct |
| 30 | Photo Review | Load | Pending + approved submissions | ✅ verified |
| 31 | Photo Review — Approve | Click Approve | Supabase status → approved | ✅ verified |
| 32 | Content Calendar | Generate This Week | 17 posts created (7 X, 7 Telegram, 3 Instagram) | ✅ verified |
| 33 | Content Calendar — Post Now | Click Post Now on Telegram post | Post fires to @temptationtoken | ⚠️ requires @TTSBroadcastBot as channel admin |
| 34 | Social Media | Post Now (direct) | Telegram message to @temptationtoken | ⚠️ same requirement |
| 35 | System Health | Load | Railway Hobby ✅, referral stats populate | ✅ verified |
| 36 | Users tab | Load | display_name, email, created_at, referred_by columns | ✅ verified |
| 37 | Staking tab | Load | tts_amount column populates | ✅ verified |
| 38 | Wallets tab | Load | LINK balance for keeper upkeeps | ✅ verified |

## On-Chain / Keeper

| # | Component | Test | Expected | Status |
|---|-----------|------|----------|--------|
| 39 | TTSVotingV3b | cast call `currentRoundId()` | Returns ≥ 1 | ✅ verified |
| 40 | TTSVotingV3b | cast call `minProfilesPerRound()` | Returns 2 | ✅ verified |
| 41 | TTSVotingV3b | cast call `getProfiles(1)` | Returns approved profile IDs | ✅ verified |
| 42 | TTSVotingV3b | cast call `checkUpkeep(0x)` | Returns (true/false, bytes) | ✅ verified |
| 43 | TTSVotingV3b | cast call `nftContract()` | Returns 0x0768e862... after setNFTContract | ⚠️ pending cast send |
| 44 | TTSKeeper2 | Chainlink Automation | Fires at round end | ✅ running (LINK: 7.1) |
| 45 | VRF subscription | On settlement | Chainlink VRF fulfills randomness | ✅ V3b added as consumer |

## Pending Prerequisites

| Item | Action Required | Who |
|------|----------------|-----|
| MARKETING_WALLET_PRIVATE_KEY | Add to Vercel environment variables | Jim |
| setNFTContract | Run: `cast send 0xEC339... "setNFTContract(address)" "0x0768e862..." --interactive` | Jim |
| @TTSBroadcastBot channel admin | Add bot to @temptationtoken and @TTSCommunityChat | Jim |
| bonus_claims table | Run SQL in Supabase (see below) | Jim |

## Supabase SQL — bonus_claims table

Run this in the Supabase SQL editor (https://supabase.com/dashboard/project/gmlikdxykgviyprqtqwz/sql):

```sql
CREATE TABLE IF NOT EXISTS bonus_claims (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address text NOT NULL,
  bonus_type    text NOT NULL,  -- 'signup' | 'vote_match'
  tts_amount    numeric,
  usd_value     numeric,
  tx_hash       text,
  original_tx   text,          -- vote tx that triggered the match
  created_at    timestamptz DEFAULT now()
);

-- Prevent double claims per wallet per bonus type
CREATE UNIQUE INDEX IF NOT EXISTS idx_bonus_wallet_type
  ON bonus_claims (wallet_address, bonus_type);

-- Index for daily count queries
CREATE INDEX IF NOT EXISTS idx_bonus_type_created
  ON bonus_claims (bonus_type, created_at);
```
