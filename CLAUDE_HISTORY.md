# CLAUDE_HISTORY.md

Historical record for Temptation Token — resolved sagas, dated audits, superseded
contracts, and completed work. **Not loaded each session.** Current canonical state is
in [CLAUDE.md](./CLAUDE.md). Anything here may be stale; verify on-chain before acting.

---

## Superseded Contracts (full detail)

| Contract | Address | Notes |
|---|---|---|
| TTSVotingV2 | `0x4dE347D547C7Ae2CB38c42A8166d29049C24e9DA` | deprecated; not BaseScan-verified |
| TTSVotingV3 | `0x49385909a23C97142c600f8d28D11Ba63410b65C` | deprecated |
| **TTSVotingV3b** | `0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6` | Round 1 settled (0 votes); was NFT minter until 2026-06-28 |
| **TTSVotingV3c** | `0x916984DBaBFDF9B1c95b7507386330Bb37626112` | deployed 2026-06-12, ran live Round 1 in parallel; superseded by V3d. Frontend never actually cut over to V3c (went V3b→V3d) |
| TTSKeeper2 | `0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48` | original keeper; **bad forwarder** (`0x6593c7de…` = an Ethereum-mainnet addr, no code on Base) → automation never fired. Root cause of Round 1 not auto-settling |
| TTSKeeper2V2 | `0x24107a47D24443D263bc4B06d11C61fCE98C3964` | deployed 2026-06-15, owned V3c |

**V3c era wiring TXs (Bank, 2026-06-15):** V3c deploy
`0x551e6117…c7dc`; `setNFTContract` `0xf06c9aa9…d937c1`; deploy Keeper2V2
`0xbe3e00b4…b7747`; `transferOwnership(Keeper2V2)` `0x8ea8d2fc…4cba9`; VRF consumer add
`0x9a93bb97…b572d856`; Gnosis setTaxExempt(V3c) batch `0x1f21ca9c…b4dbfea277`;
`setForwarder(0x68Ae2a7d…)` `0x1041eee5…3bde5`. V3c upkeep ID
`107234397534438678165344999422920520488294344698573062791612853656108534823641`,
forwarder `0x68Ae2a7d8c9Ec360EFe2FeD40763D4F353C2fd71`.

**V3d/Keeper3 deploy + wiring (2026-06-17):** V3d deploy + setNFTContract;
deploy Keeper3 `0xfcc6119c…`; `adminTransferOwnership(Keeper3)` `0x74a9d273…`. Keeper3
upkeep registered 2026-06-18, TX
`0x1183793582033432a03d1aae93ee96e1b83db6941953085de8275da6c3c8caa3`, 10 LINK. Forwarder
assigned by DON 2026-06-20; `setForwarder` (Bank) 2026-06-23 TX
`0x1936373b…dca4b320`, block 47736597. First settle target was `1782709140`.

**DEAD address (reverted deploy, no bytecode):** Keeper3 attempt
`0xc447b6263b9344d6ef05eddb3a6ff65c70030c0b` (reverted TX `0x0ce8cbb6…debc0b58`).

**Orphaned V3d duplicate deploys (2026-06-12, same args, never wired — DO NOT USE):**
`0xCf0BbC27D2639Ce332D6910dd1004fe4Df773756`,
`0x2eF6a4db7e9b6eF316bE1B38a4596e3CF11d8EE6`,
`0x3a3075FFf30322001260364C895eF9d5f75D46A0`,
`0xC2cFdd81881Bc43e8D4e29a15F9557CCf1fF1EF3`,
`0x382a09b53e422637707A3764ddDEf21F41f3Cf46`.

---

## V3c changes vs V3b (now both superseded; V3d = V3c + adminTransferOwnership)
- Tier 3 (Diamond) multiplier 1.75x→2.0x; Tier 4 (VIP) 2.0x→3.0x; Tier 5 (ghost)
  removed. NFT mints 1→3 (winner + top voter + house archive). Added per-tier vote caps.
  Storage slots 0–12 identical (no migration). Slither HIGH accepted as AF-001.

## Founder-intent reconciliation (resolved by V3d)
- NFT mints 3 (was 1) ✅ · Diamond 2x (was 1.75x) ✅ · VIP 3x (was 2x) ✅ ·
  getStakingTier 1x-fallback ⏳ (needs TTSStakingV2 deploy) · submission-fee destination
  ⚠️ unconfirmed (`0xb1e991bf…` vs `0xC3A3858A…`).

## TTSVotingV3b security patches (audit 88b99f3a, applied May 2026)
All 11 findings patched in V3b (carried into V3c/V3d): vote-cap first-vote guard
(CRITICAL), CALLBACK_GAS_LIMIT 500k→2500k + MAX_PROFILES 50 (HIGH), zero-wallet checks
(HIGH), inline SafeERC20 (HIGH), NFT mint gas cap (MED), `adminResetSettlement` VRF
rescue (MED), rolloverRound endTime guard (MED), constructor zero-addr guards (LOW),
admin setter events (LOW), MultiplierFallback event (LOW).

## Round 1 (V3b) — settled
currentRoundId 1, start 2026-05-07 03:23 UTC, settled 2026-05-15 21:43 UTC via Bank
`manualExecute(3)` on TTSKeeper2 (TX `0x50d0ec5e…23c41d`). 0 votes → VRF fulfilled → no
prizes, no NFT. Root cause automation didn't fire: TTSKeeper2 bad forwarder (see above).

---

## Trust / Scanner remediation (as of May 2026)

**SolidProof** (audit `88b99f3a`, portal app.solidproof.io/projects/temptation-token,
TrustNet 0.01). Portal access LOST — account `jgoetz@functionised.com`; recover via
`support@solidproof.io` / Telegram `@Solidproof_io_Support` (no self-service reset).
Findings: TTSVoting sub-report 1C+3H+7M+6L — C-1/H-1/H-2/H-3/M-2/M-3/M-6 fixed in V3b;
M-1/M-4/M-7 acknowledged-not-patched; M-5 = AF-001. Token sub-report: zero-value
transfer M-1 FIXED (impl `0xb995b63c` live 2026-05-17), others mitigated/negligible.
⚠️ Pre-written ack responses in `outputs/seo/solidproof_acknowledgment_responses.md` use
TOKEN numbering — remap to the correct sub-report after login. KYC ($600) not started.

**MetaMask/Blockaid/GoPlus:** Blockaid false-positive ticket #1263614 (submitted
2026-05-18). MetaMask support email sent 2026-05-18 (`outputs/metamask_remediation.md`
§7). GoPlus appeal → `service@gopluslabs.io` / `@Goplusservice` (security@ bounces),
template §6. Flag root causes: `blacklisted` mapping (admin-gated), creator
concentration (was 55%, now ~7% Bank after 33B distribution — GoPlus stale), UUPS proxy
+ Bank UPGRADER, MINTER held by nobody.

## Gnosis Safe status (May 2026)
2/2, on-chain nonce 6, queue cleared (4 orphaned non-executable entries). Nonce 0 =
upgradeTo(0xb995b63c). Nonce 4 = tax-exempt batch (all 8 confirmed). DEFAULT_ADMIN held
by Safe only; MINTER_ROLE nobody; UPGRADER held by **both** Safe and Bank (Bank
revocation pending); PAUSER held by Bank.

## LP lock
231.3 LP (100% of Uniswap V2 pool) locked on Team.Finance until **2027-05-05**. Lock TX
`0xd98b2bb4c3cfbc57e988ab9898843fab4df20fd87dc216aa1b588f65576779da`. LP holder
`0x4f0fd563…` balanceOf confirms intact (verified 2026-05-26).

## WordPress live-site issues (pending plugin install)
🚨 Release-blocking copy on live site: price-target/promissory language ("$0.10",
"$1.00", "Price rises", "guaranteed"); adult-content OG/meta strings; "40%" prize-split
instances; wrong-chain ("Polygon") references; /trust + /audit return 404 (.htaccess
blocks custom slugs). All require WP admin (Elementor) — plugin `tts-api-auth` not
installed. Full list: `outputs/wordpress_meta_fixes.md`, `outputs/wp_admin_checklist_jim.md`.

---

## Full-system audit (May 20, 2026) — summary
PHASE 0 blockers: Round 1 settled ✅; Chainlink forwarder root-cause identified ❌→fixed
by Keeper2V2/Keeper3; V3c/Keeper2V2 pre-deploy checks PASS; TTS v2 M-1 fix live.
PHASE 1–4: prize split / bonuses / tiers correct in app ✅; chatbot + referral-credit
"100 TTS" hardcodes fixed (commit 1b995c5); marketing site copy violations ❌ (WP
blocked). Workstream C: split 35/35/10/20 confirmed from source; houseWallet was Bank in
V3b (an error) → V3d uses Marketing. Workstream F: no bot tokens in committed code;
Supabase anon key was hardcoded as fallback in ~10 files (later fully removed in the
June security work).

## Investor executive status (May 20, 2026 — snapshot, now superseded)
Live then: TTS token (69B, 1% burn, LP locked), V3b voting (split 35/35/10/20, VRF, 11
fixes), Round 1 settled, v2 token M-1 fix, Safe 2/2, tax-exempt ×8, signup/vote-match.
Open then: WP price-target + adult-content copy (release-blocking), V3c/Keeper2V2
deploy, Chainlink upkeep, scanner appeals, SolidProof access, TTSStakingV2.

---

## Completed History (dated)

### 2026-06-24 → 06-28 (V3d cutover, security hardening, consolidation, production deploy)
- **Pre-launch verification (06-24):** confirmed on-chain V3d owner/admin/nft/house/
  charity, VRF-consumer + `isTaxExempt(V3d)` BOTH done (CLAUDE.md had wrongly claimed
  undone), Keeper3 wiring, upkeep ~10 LINK + forwarder, Round 1 started, `getProfile`
  selector `0xd6ca8383`.
- **Frontend cutover V3b→V3d:** `src/App.jsx`, `TTAdminDashboard.jsx` (incl. UPKEEPS →
  new ID), `src/lib/asktts-prompt.js`, `api/approve-profile.js`, `set-club-wallet.js`,
  `content-generator.js`, `scheduler.js`, `scripts/seed-tts-posts.js`, wp-plugins,
  public trust/audit/faq pages. ABI confirmed source-compatible (inline, V3d superset).
- **Criticals:** C1 admin auth moved server-side (`api/admin.js`), hardcoded password
  `TTS2026Admin!` removed from client, HMAC session token; C2 manual-control + wallet
  registry + scheduler repointed from old keeper `0xB17b3842` → Keeper3 `0x363ce496`.
- **RLS lockdown + data layer:** dropped anon read policies on 7 PII tables + the votes
  insert policy; built `api/profiles.js` (public reads, safe fields) + gated
  `api/admin-data` proxy; routed submission/vote writes server-side; **anon key purged
  from entire frontend bundle**.
- **Endpoint consolidation 16→12** (Hobby limit): merged admin-auth+admin-data→`admin.js`,
  public-profiles+submit-profile(+vote)→`profiles.js`,
  signup-bonus+vote-match+referral-credit→`bonus.js`; `vercel.json` rewrites preserve all
  URLs.
- **Important fixes I1–I7:** I1 getProfile selector ABI-computed (was wrong hardcode
  `0x76c2c389`); I2 admin writes await receipt + revert-check + chain 8453 + gas estimate;
  I3 submission fee/insert no false-success + no-extra-fee retry path; I4 shared
  `txError.js` user-reject vs failure; I5 surfaced bonus failures; I6 removeClub
  in-flight guard; I7 stale V3b auto-start text fixed.
- **Minor fixes M1–M8:** accurate ET schedule label; deleted `App.jsx.backup`; removed
  dead AIRDROP consts; projectId via `VITE_WALLETCONNECT_PROJECT_ID`; admin mobile media
  queries; read-error surfacing (+multicall deferral note); `.gitignore` hardened
  (.env*, junk, `lib/openzeppelin-contracts-upgradeable/`); removed junk files.
- **Production deploy (06-27):** `npx vercel --prod` → `app.temptationtoken.io`. Verified
  `GET /api/profiles?action=list` returns 16 approved profiles (safe fields only); all 12
  functions live (no 404s); all rewrites resolve. Env set in Vercel: ADMIN_PASSWORD (new),
  ADMIN_SESSION_SECRET, SUPABASE_SERVICE_KEY.
- **NFT minter fix (06-28):** Bank `NFT.setMinter(V3d)` — minter was old V3b so V3d
  auto-mint was silently reverting. TX
  `0xa91733613ddd9274805ea2dbc2c9b527390f8b8d5befff05d22024c400db0616`, block 47898397.
  `minter()` now = V3d (verified). `totalSupply()` still 0. Script `outputs/set_nft_minter.mjs`.
- **UI/bot honesty (06-27/28):** removed undeliverable referral-reward promises from app
  (`App.jsx`) + chatbot prompt; relabeled bot (`tts_bot.py`) staking (no APR/multiplier),
  referral, and VIP copy to "coming soon"/community-only.

### 2026-05-26 (Workstreams N–R)
LP lock re-verified (231.3 LP). "7 labeled wallets" investor claim unsupported (only 3
operational: Bank/Marketing/Polaris). 4 Chainlink upkeeps + 27.39 LINK verified. X OAuth
valid; bot polling on Railway. WP admin checklist created. V3c C-1 fix confirmed.
PayoutsScreen decodes ERC20 Transfer events; ReferralScreen shows paid TTS; bot 5-min
heartbeat added. KYC SQL idempotent. **API consolidation 17→12** (Hobby limit), original
URLs via rewrites. Deployed (commit 05d59f0).

### 2026-05-24 (KYC + age verification)
KYC system committed (kyc-session/webhook/status, age-acknowledge — later merged into
`api/kyc.js`). `outputs/kyc_setup.sql` (3 tables). CLAUDE.md KYC docs.

### 2026-05-21 (Workstreams J/K/M)
V3c+Keeper2V2 deploy runbook rewritten (13 steps); houseWallet corrected to Marketing;
setForwarder = root-cause fix. Distribution audit tool `outputs/verify_round_distribution.py`
(validated against Round 1 → PASS, zero votes). SolidProof recovery email drafted; GoPlus
email corrected to `service@gopluslabs.io`; TTSStakingV2 thresholds computed.

### 2026-05-20 (Workstreams A–F)
Round 1 state confirmed; Chainlink root cause (bad forwarder); prize split confirmed from
source; WP write access unavailable; price-target language found (release-blocking);
SolidProof questionnaire written; bot tokens not in code.

### 2026-05-19 (Phase 1–5 audit)
referral-credit + chatbot "100 TTS" hardcodes fixed (1b995c5); WP fix list created;
PAUSER-on-Bank documented; undocumented Vercel env vars added to docs; CI passed.

### 2026-05-15 → 19
TTS v2 M-1 fix live via Safe nonce 0 (impl `0xb995b63c`, BaseScan exact match);
tax-exempt batch via Safe nonce 4 (8 addresses); Safe queue cleared (nonce 6); V3c +
Keeper2V2 pre-deploy checks PASS; AF-001 documented; Blockaid/MetaMask/GoPlus actions;
SolidProof finding audit + contact channels.

### 2026-05-10
Contract audit (charity/house/MIN_VOTE/cap/split/burn/NFT). Signup bonus 100→500 across
bot/App/chatbot. `admin_config` infra. signup-bonus fixed-amount; vote-match cap from
config. Admin Settings BonusConfig. Content-generator rules 6–8. check-prize-split
expanded. Prize-split messaging fixed everywhere (35% not 40%). Cashtag dedup in scheduler.

### 2026-05-06
TTSVotingV3b redeployed `0x6d6fF6A0…` (all 11 fixes). LP locked (Team.Finance → 2027-05-05).

### 2026-05-01
MARKETING_WALLET_PRIVATE_KEY corrected in Vercel. Chainlink crons confirmed
(`0 4 * * 1` start, `59 3 * * 1` settle). Marketing wallet ETH funded.

### Active test profile
**Donielle Banks** — Round 2 live-audit test profile (V3b flow).
