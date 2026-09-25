# TTS Sale Sprint — Claude Code master prompt (Sept 24, 2026)

Paste everything below the line into Claude Code in ~/Projects/temptation-token. It runs in parts; each part ends with a verification gate and a short report. Anything that writes to mainnet is built as a Safe transaction for Jim and Mike to sign — Claude Code never signs or sends a mainnet transaction itself.

---

Read CLAUDE.md and continue from where we left off.

MISSION: Make Temptation Token sale-ready by Thu Oct 1 (launch) and keep it running itself until the offer review on Fri Oct 16. Work Parts 0-8 in order. After each part, write outputs/sale/part_<n>_report.md (what changed, evidence, anything Jim must do) and continue unless a gate fails.

GROUND RULES
- Never print, log, or commit secret values. Report presence/absence only. New secrets go into .env and Vercel via a masked prompt.
- Mainnet writes: build Safe Transaction Builder JSON (outputs/sale/safe/<n>_<name>.json) + a plain-English summary. Prove every transaction on a Base mainnet fork (anvil --fork-url $BASE_RPC_URL) first and attach the fork transcript.
- WordPress edits are additive and revision-safe only (the Aug 16 rule): no bulk find/replace. Use the tts/v1 API with explicit Content-Type, pre-slash for /elementor, and bust LiteSpeed cache after writes.
- Public copy states only true, current facts. Never state a prize-pool dollar figure, token price, or earnings promise.
- Files from Jim are in ~/Downloads: TTS_Sell_This_Software_Plan.xlsx, tasks.json, tts_daily_digest.py, TTS_Sale_Plan_Proton.ics. Move them to ops/sale/ and commit (no secrets inside).

## PART 0 — Daily reminder automation (do this first)
1. ops/sale/tts_daily_digest.py: wire metrics_hook() to live reads (never raise): current round # and close time; last settlement tx + who settled (autopilot vs DON); consecutive clean autopilot settlements; verified creators vs AI Models on the board; signups + unique voters last 7 days; card buys (count/$) last 7 days; V2 + new-pool depth and max buy under 2% and 5% impact; Blockaid label; SolidProof status; Play status; listing statuses.
2. Map env: BRIDGE_USER / BRIDGE_PASS from the existing Proton Bridge config (PROTON_BRIDGE_PW etc.), BRIDGE_SMTP_PORT (Bridge default 1025 — confirm in Bridge settings), DIGEST_TO=jim@temptationtoken.io (Jim can change), TTS_TASKS_JSON=ops/sale/tasks.json.
3. launchd: com.temptationtoken.digest.morning (07:00 ET daily) and com.temptationtoken.digest.evening (18:00 ET, DIGEST_MODE=evening), both through Nov 6, 2026. Add a wake schedule so the Mac is awake at 06:55 (pmset repeat — ask Jim for sudo once) and confirm Bridge auto-starts at login.
4. Gate: run --dry-run for today, then one real send (canary) to DIGEST_TO. Report the subject line received.

## PART 1 — Crawlability + instant findability (temptationtoken.io + app.temptationtoken.io)
Context: an external fetch of temptationtoken.io on Sept 24 was refused by the site's robots rules, and search results still show the old Polygon-era homepage copy. AnswerPress posts are only findable if crawlers are allowed in.
1. Diagnose and record: /robots.txt contents; WordPress blog_public option ("Discourage search engines"); any X-Robots-Tag headers; meta robots on home, posts, pages; Hostinger/LiteSpeed/CDN bot-blocking or "block AI crawlers" toggles; HTTP status for each user agent: Googlebot, Bingbot, GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, Google-Extended, Applebot, Applebot-Extended, DuckDuckBot, CCBot. Same for app.temptationtoken.io.
2. Fix: robots.txt allows all of the above plus a Sitemap line; blog_public = 1; remove noindex from public pages/posts; whitelist those bots at the host/CDN; ensure bots get 200 with full HTML (no JS-only shell on marketing pages).
3. Instant indexing: enable IndexNow (Rank Math's built-in IndexNow or the official IndexNow plugin), host the key file, submit every URL, and auto-submit on publish/update so every AnswerPress post pings on creation. Generate the Search Console + Bing Webmaster verification tokens for Jim (DNS TXT — he adds it at the registrar), then submit sitemap_index.xml in both and request indexing for the top 10 URLs.
4. AI answer-engine layer: /llms.txt and /llms-full.txt (what TTS is, how it works, key pages, contact); schema.org JSON-LD — Organization, WebSite, SoftwareApplication (applicationCategory GameApplication, operatingSystem Web/Android), FAQPage, BlogPosting on every post (confirm AnswerPress + Rank Math aren't duplicating); Open Graph + Twitter cards.
5. Retire stale copy: find every page/post/meta/image-alt with "Polygon", "Polygon 2.0", "June 5th, 2024", or retired claims; rewrite to current facts additively; 301 any obsolete URLs.
6. Gate: re-run the user-agent matrix (all 200), validate robots.txt, sitemap, llms.txt, and JSON-LD (Rich Results + schema validator), confirm IndexNow 200/202 responses. Report: outputs/site/crawl_before_after.md.

## PART 2 — Site rebuild: same look, new structure (staging first)
1. Capture the current look: colors, fonts, logo, button/card styles, spacing into design/tokens.json; full-page screenshots (desktop + mobile) of every page into outputs/site/before/.
2. Build on staging with the same tokens:
   - Home: 5-second explanation, live demo board (AI Models labeled), Play on web, Android download (APK now; Play badge when live), iPhone install guide (Add to Home Screen), Telegram button, "How it works" in 3 steps, trust strip (multisig + timelock, audit status), latest blog posts.
   - How It Works; For Creators & Agencies; Clubs (/clubs flow + Calendly); AI Models (what they are, labeled, exhibition-only); Trust & Audit (contract addresses with Basescan links, audit status, timelock, settlement log); Download; FAQ (FAQPage schema); Blog (AnswerPress); About (Blockchain Entertainment LLC); Partners/Contact (jim@temptationtoken.io, Calendly).
   - Public imagery stays SFW. No token-price or earnings language anywhere.
   - Performance targets (mobile): LCP < 2.5s, CLS < 0.1, INP < 200ms. WebP/AVIF, lazy-load below the fold, preconnect fonts, LiteSpeed page cache on, REST GET caching OFF for API routes.
3. Screenshots after into outputs/site/after/, plus a before/after diff note. Stop and wait for Jim's approval (Plan task T15), then publish revision-safely and purge cache.
4. Gate: Lighthouse mobile scores, zero broken links, user-agent matrix still all 200.

## PART 3 — AI Models division + weekly rotation
Decision (Jim, Sept 24): AI-generated placeholder profiles go up now, rotate weekly until sold, and are replaced over time by agency creators with signed consent.
1. Image generation (IMAGE_API_KEY in .env; use whichever provider Jim set: Replicate, fal.ai or OpenAI images). Generate 48 portraits (6 weeks x 8):
   - Subject: fictional adult women, apparent age 25-35, varied ethnicities, hair, styles; photoreal editorial look; fully clothed in fashion, evening, streetwear or athleisure; studio, rooftop, city, beach-boardwalk (clothed), cafe settings; 4:5 portrait.
   - Negative prompt: child, teen, minor, youthful or baby face, school uniform, nudity, lingerie, swimwear, see-through, suggestive pose, celebrity, real person, logo, text, watermark.
   - Safety pass: run an automated NSFW check and an apparent-age estimate; auto-reject anything NSFW or estimated under 25; everything else goes to an admin approval queue (Jim approves each - Plan task T11).
   - Store in Supabase storage bucket ai-models/; manifest outputs/provenance/ai_models.json (provider, model, prompt hash, seed, date, approval).
2. Data model: profiles.entry_type ('verified_creator' | 'ai_model'); CHECK: verified_creator requires consent_record_id (reuse the Sept 20 consent-gate design). Fictional names + short SFW bios.
3. Display: "AI Model" badge on every AI card and detail view, rendered before the image loads; board filter tabs All / Creators / AI Models; footer line: "AI Models are AI-generated and do not depict real people." Same in web, mobile, Telegram Mini App, Social Composer (extend the compliance gate: any AI-image post must carry the AI line).
4. Game rule — AI Models never take a paid prize:
   - Preferred: AI Models live off-chain in their own AI division with free votes and a separate leaderboard.
   - For any existing on-chain placeholder profile that shows an AI image: if the contract can't exclude it, any prize it would win rolls into next round's pool via the Bank on-chain, and the rollover tx is logged publicly on /audit.
   - Document which applies, with evidence from TTSVotingV3d.
5. Weekly rotation job (launchd, Mondays 07:00 ET): confirm the closed round settled (settled=true); retire the 4 oldest active AI Models and activate the next 4 approved; retire 1 extra for each new verified creator that week (AI share falls as real creators arrive); log to ops/sale/rotation_log.csv; post the change to the admin chat.
6. Gate: board screenshots (desktop + mobile) showing badges and tabs; constraint rejects a verified_creator without consent; composer gate fails an unlabeled AI post; rotation dry-run output.

## PART 4 — Liquidity + card on-ramp (Transak production)
Context: card buys go card -> ETH/USDC (Transak) -> swap into TTS through our pool. The V2 pool is shallow: on Aug 12 a $100 buy moved price ~9.85% and the 5% guard refused it, so the usable card window was ~$30-$48. Business verification is done; production key comes from Jim (Plan task T07).
1. Read the live V2 pool (0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68): reserves, spot price, depth, LP lock status. Compute impact (incl. 0.3% fee + 1% transfer tax) for $30 / $50 / $100 / $250 / $500 / $1,000 buys and sells.
2. Read the token's tax logic: exactly when the 1% tax applies (sender-exempt? recipient-exempt? either?).
3. Single-sided buy-side depth with zero cash: design a concentrated-liquidity position (Uniswap v3 on Base; compare Aerodrome Slipstream and pick whichever fork-tests better and is routed by major aggregators) holding Treasury TTS only, in a range from the current price upward. Size it so a $500 card buy stays under 2% impact and $1,000 under 5%. Show the TTS amount as a % of the Treasury balance. Treasury allocation only; Founder/Team wallets untouched.
4. Fork test end to end: create/initialize the pool at the current price -> setTaxExempt(pool) -> approve -> mint the position -> buys of every size above through the new route -> sells back -> confirm no reverts, correct amounts, impact numbers. Write outputs/sale/liquidity_forktest.md.
5. Build Safe transaction #1 (Transaction Builder JSON): pool create/initialize (if needed), setTaxExempt(pool), approve, mint position (recipient: the Treasury Safe). Plain-English summary for Jim and Mike (Plan task T10). This must execute BEFORE Part 5's timelock move.
6. App routing: quote V2 and the new pool (Quoter) and route the better price; keep the 5% impact guard on buys and sells; low-balance popup and ?buy=1 deep link unchanged. Deploy after Safe tx #1 executes.
7. Transak production: add the production key/secret to Vercel production (masked), set environment to PRODUCTION, whitelist app.temptationtoken.io, enable the card tab flag. Jim does a live $30 card buy on his phone (Plan task T20); verify webhook + delivery.
8. LINK -> sell-side depth: if the keeper autopilot shows 3+ consecutive clean settlements, cancel the retired upkeep (owned by whichever wallet registered it), wait the required blocks, withdraw ~43.97 LINK; top the VRF subscription up to at least 25 LINK first; swap the remainder to ETH via an aggregator; pair with Treasury TTS at the current ratio in V2 (Safe tx or Bank tx per ownership - build it, don't send it).
9. Gate: before/after impact table; max card buy under 2% and 5%; production test receipt. Recheck Blockaid after 7 stable days (don't re-appeal before metrics move).

## PART 5 — Pre-audit, timelock, SolidProof packet
1. Inventory every live contract we own (token, TTSVotingV3d, staking proxy, Trophy NFT, any helpers): address, verified on Basescan, implementation address for proxies, compiler version, commit hash.
2. Run Slither and Aderyn on the exact deployed sources; triage every finding; fix anything above informational in code that is upgradeable, via a proper upgrade plan (don't upgrade until Jim approves).
3. SolidProof-style readiness report (outputs/audit/preaudit_2026-09-25.md): severity table. Expect centralization findings — admin can grant pause/mint/blacklist roles on the token (zero members today); upgradeable implementations; tax-exemption control; the privileged settlement fallback; VRF funding. For each: the mitigation below and the residual note.
4. Timelock: deploy OpenZeppelin TimelockController (minDelay 48h, proposer = Safe, executor = Safe, no admin). Build Safe transaction #2: grant DEFAULT_ADMIN_ROLE + UPGRADER_ROLE (token, staking proxy admin, Trophy admin as applicable) to the timelock, then renounce the Safe's direct roles. Fork-test that setTaxExempt, upgrades and role grants still work via timelock after 48h. Plan task T19 (after Safe tx #1).
5. Optional hardening upgrade (propose only): remove the blacklist gate from the transfer path, hard-cap the tax at 1%, make MINTER/PAUSER non-grantable. Queue through the timelock only if Jim approves and fork tests pass.
6. SolidProof packet: outputs/sale/solidproof_request.md — email draft requesting a quote, start date and expedited turnaround; phase 1 = token + TTSVotingV3d, phase 2 = staking + Trophy; report must be pinned to the deployed addresses and commit; include the scope table, addresses, docs, and the timelock. Plan task T06.
7. Gate: tool outputs attached; zero unresolved findings above informational; timelock address + fork proof.

## PART 6 — Store readiness
1. Android/Play: ask Jim the account type (Plan task T05). Personal -> create the closed-testing track, bump versionCode, upload the production-profile AAB, generate the opt-in link and a 5-line tester instruction (outputs/listings/play_closed_test.md), and track opted-in testers daily in the digest. Organization -> prepare the production release.
2. Listing copy (outputs/listings/play_store_listing.md): "Vote for your favorite creators every week and win onchain trophies." Declare tokenized digital assets in the Financial Features declaration; no earnings or investment language anywhere; content rating + data safety answers; UGC moderation (report, block, contact) documented. Production-access questionnaire answers: outputs/listings/play_production_answers.md.
3. iPhone: no App Store submission (Apple guideline 1.2 excludes hot-or-not style voting on real people). Ship a polished PWA: manifest, icons, splash, offline shell, and an Add-to-Home-Screen guide page. Keep the TestFlight build as a transferable asset.
4. Gate: AAB uploaded to the right track; listing copy passes a self-check against Play's blockchain-content rules.

## PART 7 — Data room, listings, outreach queue
1. Build outputs/sale/data_room/ per the workbook's Data Room tab: one-pager (below), Loom link placeholder, contract list with Basescan links, round history export (every round: votes, winner, settlement tx, who settled), metrics snapshot (real numbers only), architecture + CLAUDE.md, monthly cost sheet, transfer runbook (Closing tab), entity pack placeholders, counsel letter placeholder, Strengths memo with proof links, store status, SEO data.
2. Listings (outputs/sale/listings/): Acquire.Fi, SideProjectors, IndieMaker — SFW wording, one-pager content, ask = $95K structured (cash + earn-out) or $65K all-cash, offers reviewed Fri Oct 16.
3. Outreach queue in the existing engine (canary first, dry-run rows never consume slots, CAN-SPAM footer with the LLC postal address, stop on reply): automated Email 1/2/3 (Scripts tab) to AROA (office@aroaagency.com), RCI IR (gfishman@pondel.com, mwichman@pondel.com), and SheX (only after verifying the Impressum email) at 09:05 recipient-local on Oct 1, Oct 6, Oct 12. Hooks from the Acquirers tab. No automated email to Canadian contacts (CASL). Everything else in the Sequence tab is Jim's manual touch — list it in the digest on its date.
4. Weekly results note: every Monday 09:00 ET, draft from live data to Jim (not auto-sent) for engaged buyers.
5. Gate: canary received; queue shows the right dates/times; data room index complete.

## PART 8 — Final report
outputs/sale/sprint_report.md: what's live (with links), Safe transactions waiting for signatures, every Jim-only action with its Plan task ID, metrics before/after, and anything blocked with the fastest unblock.

ONE-PAGER (finalize with live numbers; SFW)
Temptation Token — a turnkey onchain fan-voting platform, for sale
- What it is: a weekly fan-voting game on Base. Fans vote for creators, winners receive onchain Trophy NFTs, and every creator profile sends fans straight to her link hub.
- Live today: web app; Android app; Telegram bot; Face ID sign-up with gas-free wallets; card purchases via Transak; weekly rounds that settle themselves onchain with Chainlink VRF randomness; club self-serve onboarding; referral engine; Social Composer; admin dashboard; AI Models division beside verified creators; SEO site with automated publishing.
- Security: 2-of-2 multisig + 48-hour timelock; SolidProof audit [status, pinned to live addresses].
- Proof: [N] rounds settled onchain; first Trophy NFTs minted Aug 17, 2026; [live metrics].
- Distribution: 51-agency pipeline, club program, Telegram community.
- Included: the LLC or its assets, domains, brand, code, contract admin, treasury allocation, apps and builds, brand channels (per each platform's rules), 30 days of transition support.
- Why it's for sale: the founder's other companies need his full attention.
- Ask: $95K structured (cash + earn-out) or $65K all-cash. Offers reviewed Friday, October 16, 2026.
- Contact: jim@temptationtoken.io · calendly.com/temptationtoken/phone-meeting
