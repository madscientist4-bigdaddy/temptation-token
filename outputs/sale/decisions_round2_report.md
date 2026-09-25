# Jim's ten decisions — what happened
**2026-09-25.** One item was refused on safety grounds (as instructed), two are waiting on
you, and one turned out to be unnecessary.

---

### 1. Liquidity — approved as built, fund from the Safe
Nothing to change. `outputs/sale/safe/1_liquidity.json` stands: 5 transactions, 1,007,851
TTS from the Safe (0.0101% of its balance), no ETH, no cash, max card buy ~$50 → $1,000.

⚠️ **It expires 2026-10-09.** The batch encodes the price at build time; re-run
`node scripts/sale/build_safe_tx1.mjs` if the price moves more than a few percent before
you and Mike sign. `createPool` alone costs 4.56M gas — don't let the Safe UI propose a
limit under 6M.

### 2. Timelock — built, fork-tested, parked ✅
`outputs/sale/safe/timelock/` — **all 15 checks pass** against real mainnet state,
including the one that matters: `isTaxExempt` actually flipped through the timelock after
48 hours, and `execute` reverts before it. Transcript: `timelock_forkproof.txt`.

Split into **two** batches deliberately. The grant is reversible while the Safe still holds
`DEFAULT_ADMIN_ROLE`; the renounce is not, and on an unupgradeable token a misconfigured
timelock freezes `setTaxExempt` permanently — which the new pool depends on. The README
requires a live rehearsal between the two signatures.

The JSONs are **not checked in** and the builder refuses to run without a real deployed
timelock address. A batch file with a placeholder target is a signable artifact aimed at
the wrong contract.

Scope is narrower than planned: `UPGRADER_ROLE` on the token is **inert** (no proxy), so
timelocking it would be theatre. What the timelock actually buys is turning "two signatures
and the supply changes" into a public 48-hour notice.

### 3. SolidProof — quote-only ✅
`outputs/sale/solidproof_request.md` was already quote-only; unchanged. It asks price, lead
time, expedited option, and that the report be pinned to the deployed addresses and a named
commit. It also asks them to correct their public listing, which still shows the **40%**
prize split.

### 4. Findings → deployed bytecode ✅ — **nothing exploitable is live**
Published on `/audit` as a full table. Every finding re-tested as a *behaviour* against the
live addresses on a Base fork, not read off a summary.

| | | |
|---|---|---|
| C-1 | Critical — cap blocked votes on an empty pool | **FIXED** — voted into round 13 (zero votes) on a real approved profile, 0 → 5 TTS |
| H-1 | High — VRF callback gas 500k → OOG | **FIXED** — reads 2,500,000 |
| H-2 | High — zero wallet traps funds | **FIXED** — `address(0)` rejected |
| M-3 | stuck VRF unrecoverable | **FIXED** — `adminResetSettlement` present |
| M-6 | rollover before round end | **FIXED** — early call reverts |
| M-4 | `renounceOwnership` reachable | **MITIGATED** — Keeper3's interface declares no such function and makes no low-level call |
| M-2 | NFT gas-bombs settlement | **FIXED** — gas-capped try/catch |
| M-1, M-5, M-7 | acknowledged / accepted | unchanged by design |
| **T/M-1** | token: zero-value transfer reverts | **NOT FIXED, LIVE, unfixable** |

**Answer to "stop and tell me if anything live is exploitable": no.** Zero critical or high
findings are live. The one live defect reverts a transfer of exactly zero tokens — an
EIP-20 compliance problem, not a path to funds. **Card go-live is not blocked by this.**

Two bugs in my own test, found by running it rather than trusting it: `getProfile` returns
`(wallet, totalTickets, rawVotes, topVoter, approved)` and I had `approved` in slot 1, so
every profile read as unapproved and C-1 came back inconclusive; and the on-chain id list
is better taken from `getProfiles()` than from the API, where `on_chain_sid` is NULL on
every row.

### 5. LINK — built, fork-proven ✅ (Bank tx, needs your signature)
Cancel + withdraw proven end to end: **43.9739 LINK** recovered (Bank 9.16 → 53.13),
registry balance zero. The 50-block cancellation delay is real — an early `withdrawFunds`
correctly reverts. Calldata: `5_link_reclaim_bank_txs.json`.

**These are Bank transactions, not a Safe batch** — the upkeep admin is the Bank EOA.

Two corrections to the instruction:
- **The VRF top-up isn't needed.** The subscription already holds **32.76 LINK** ≈ 69,000
  draws at the measured 0.000476 LINK per draw.
- **Read the valuation before spending effort:** 48.13 spendable LINK is **≈$668 / 0.246
  ETH**. Added to v2 that takes the ETH side from 0.5266 to ~0.77 — about 1.5×. Worth doing
  because a stranded asset shouldn't sit in a dead upkeep, but it is **not** a liquidity
  strategy and shouldn't be described to a buyer as one. Safe tx #1 is the fix.

⚠️ `cancelUpkeep` is a one-way door. If Chainlink Automation ever returns to Base, this
upkeep is gone.

### 6. WordPress — **v1.2 was unnecessary, and the fixes are already done** ✅
**I was wrong in the first pass.** I tested Application Passwords, got a 401, and concluded
core REST was closed. Hostinger blocking Application Passwords is *precisely what this
plugin exists to bypass* — I never retested with the key header. With it,
`wp/v2/posts`, `wp/v2/pages` and `wp/v2/settings` all return **200 as administrator**. The
live 1.1.0 also already carries the Elementor slashing fix and read-back rollback.

So instead of building routes that duplicate core, I applied the fixes: **17 edits across
page 52 and posts 1657, 1698, 1704, 1766.** Each anchored on an exact string with an
asserted occurrence count, backed up to `outputs/wp_backups/2026-09-25/` first, verified
against fresh cache-busted fetches of the **rendered** page.

`scripts/sale/wp_verify_claims.sh` → **PASS**, all five pages render, every corrected
string absent. Re-runnable any time, read-only.

The assertions earned their keep three times:
1. Elementor stores HTML with **JSON-escaped quotes**, so plain-quote literals silently
   missed — the first dry run looked like it covered page 52 while leaving the rendered
   page untouched, and page 52 renders from Elementor.
2. The homepage's visible FAQ and its **FAQPage JSON-LD** are separate copies. Fixing only
   the visible one leaves the false claim exactly where Google and answer engines read.
3. **Rank Math stores its own SEO title and description**, overriding the post title in
   `<title>`, OG, Twitter and BlogPosting JSON-LD. Changing the WP title left "Earn Up to
   45% APR" in ten places on the staking post.

`outputs/site/tts-api-auth-1.1.1.zip` ships anyway — its only real delta is `/rotate-key`,
which the live 1.1.0 lacks. Upload whenever; nothing depends on it.
See `outputs/site/PLUGIN_UPLOAD_NOTE.md`.

**And the Sept 24 mystery is solved: it was never robots.** `robots.txt` has **no Disallow
rule for any AI crawler** — 122 bytes, byte-identical for every agent. The refusal was
**HTTP 429 from Hostinger's CDN edge** (`server: hcdn`, empty body, no PHP or LiteSpeed
headers, so it never reached WordPress). Reproducible: **GPTBot** and
**meta-externalagent** get 429; Googlebot, Bingbot, ClaudeBot, Claude-User, OAI-SearchBot,
PerplexityBot, Applebot, DuckDuckBot, CCBot, Bytespider, Amazonbot, cohere-ai and Diffbot
all get 200. **This is an hPanel toggle, not a WordPress setting** — hPanel → Security (or
Performance → CDN) → the AI-crawler / bot-protection option. Nothing in WordPress or Rank
Math can override it.

### 7. Replacement-cost sheet ✅
`outputs/sale/data_room/replacement_cost.md`. From git history: **364 commits, 6.3 months,
one contributor, 46,925 lines of original code** across 209 files. Vendored dependencies
and build output excluded — counting them gives ~110,000 lines and would be a lie, since
`trophy/lib/forge-std` alone is 77,000 lines of someone else's code.

Replacement engineering + audit: **$154,200–168,200**. The $65,000 all-cash ask is ~42% of
the low end, before six months of calendar time, the deployed contracts and the funded
pools. Stated caveat: replacement cost does not buy an audience.

### 8. v2 plan files ✅ — and 6 claims struck
`TTS_Sell_This_Software_Plan_v2.xlsx` and `tasks_v2.json` are in `ops/sale/`. The digest
and its launchd wrapper now default to `tasks_v2.json`; the old file is
`tasks_v1_SUPERSEDED.json`. Today's dry run renders 15 tasks, 12 of them yours.

Every claim in **Strengths** and **Scripts** verified. The workbook is annotated in place —
struck rows prefixed `[STRUCK 2026-09-25]` with a new verdict column carrying the evidence
and corrected wording. Nothing silently rewritten. Full detail:
`ops/sale/claims_verification_2026-09-25.md`.

**Six struck:**
| Claim | Reality |
|---|---|
| "APK live now" | **No APK exists.** `app.temptationtoken.io/download` returns the SPA shell. No `.apk` in the repo or any route |
| "The TestFlight build transfers" | `eas.json` still has three `REPLACE_WITH_*` placeholders; no Apple Developer account, so **no TestFlight build exists** |
| "self-serve club program — any venue can join from a phone in two minutes" | Club registration is **admin-only** (`requireAdmin` on every write). `pending_clubs` and `club_partners` both have **0 rows**. `/clubs` 404s, so the QR step points at a dead URL |
| "AI Models division: always-on demo content, clearly labeled AI category" | **Not built.** Zero AI profiles; the cited `rotation_log.csv` doesn't exist |
| "Runs on automation: … weekly AI rotation" | Doesn't exist. The digest is scheduled but has **never sent** |
| "Legal review complete … Counsel sign-off letter" | `outputs/legal/` is all **self-drafted**. No counsel letter. "Free first vote" isn't a feature either — the real mechanism is the 500 TTS signup bonus |

**Two need a caveat:** "no blacklist — nothing can ever freeze an address" is true for
per-address freezing, but `pause()` exists and the Safe could grant `PAUSER_ROLE` (no
holders today) to freeze *all* transfers — say it first, an auditor will. And "below
replacement cost" now has a number to quote instead of an adjective.

**One holds better than claimed:** "rounds 9–12 settled within 30 minutes" — actually
**19.6, 22.4, 17.3 and 18.3 minutes**. Prove it from `round_history.csv`, **not** from our
audit table: three of the four SETTLE rows are wrongly recorded `no_state_change` because
the runner re-reads state before the tx is indexed, which makes the autopilot look worse
than it is. (Same table feeds the 24h runaway cap, so that is miscounting too — logged, not
a blocker.)

**Scripts also needs:** Email 2's example "audit underway" is not true and must not be
pasted; and the LinkedIn note's "(web, Android, Telegram)" should say Android is in
progress.

### 9. Blockaid / GoPlus update — waiting, as instructed
Deferred until Safe tx #1 has been live a few days. The evidence is ready: the
`blacklisted` mapping has **no setter anywhere in the contract**, so no address can ever be
blacklisted, and the token **cannot be upgraded**, so that can never change. Combined with
the new pool depth, that is a much stronger appeal than anything previously drafted.

### 10. Outreach + Part 2 — waiting on you
Queue stays empty until the Bridge password and the CAN-SPAM postal address arrive. Part 2
rebuild stays parked. Both correct: a queue aimed at real recipients with a missing legally
required footer is worse than no queue.

---

## What is now on your desk
| # | Action | Blocks |
|---|---|---|
| 1 | Sign Safe tx #1 with Mike (**expires Oct 9**) | card on-ramp, then Transak, then app routing |
| 2 | Bridge password + postal address | daily digest, canary, all outreach |
| 3 | Hostinger hPanel: allow GPTBot + meta-externalagent (429 at the CDN) | ChatGPT and Meta crawling the marketing site |
| 4 | Sign the LINK cancel/withdraw (Bank, irreversible) | $668 of stranded asset |
| 5 | `IMAGE_API_KEY` | all of Part 3 |
| 6 | Play account type: Personal or Organization? | all of Part 6 |
| 7 | Send the SolidProof quote request | re-audit pinned to live addresses |
| 8 | Transak production key (**after** #1) | card purchases |
| 9 | `sudo pmset repeat wakeorpoweron MTWRFSU 06:55:00` | digest punctuality (wakes 01:55 today) |

Optional, no dependency: upload `tts-api-auth-1.1.1.zip` for `/rotate-key`.
