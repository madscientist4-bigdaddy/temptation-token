# Public claims that were not true — found and fixed 2026-09-25

Found while opening the site to crawlers. Every one of these was live, public, and
checkable by a buyer in minutes. Two were checkable from SolidProof's own page.

## Fixed in this pass (app.temptationtoken.io — deployed)

| Where | Claimed | Actually |
|---|---|---|
| `<title>`, meta, OG, Twitter | "Vote. Win. **Earn $TTS**", "the first **vote-to-earn** game" | An earnings promise. Removed. |
| app head meta | "**Audited by Solidproof**" | Audit covered TTSVoting, not the deployed V3d. Removed. |
| In-app banner (every page) | "✓ **Audited by Solidproof · Zero critical findings**" | The audit raised **1 critical and 3 high**. Replaced with a neutral link to `/audit`. |
| `/audit` title + meta | "Zero critical findings. Zero high findings. TrustNet score 17.92." | 1 critical, 3 high, 7 medium, 6 low. Live TrustNet is **0.01**. |
| `/audit` hero | "**Zero Critical Findings** — Solidproof Audit Complete" | Rewritten to state what was found, what was remediated where, and that the deployed contract post-dates the audit. |
| `/audit` checklist | "No unauthorized minting — **supply is fixed** at 69,000,000,000" | **False.** Proven on a mainnet fork: the Safe granted itself MINTER_ROLE and minted 1B TTS, 69B → 70B. |
| `/audit` checklist | "**UUPS proxy upgrade pattern correctly implemented**" | There is no proxy. The token is deployed directly. |
| `/audit` checklist | "No backdoor functions, no hidden admin controls" | Admin can grant itself mint rights. Misleading. |
| `/audit` checklist | "ERC-20 standard compliance verified" | Zero-value transfers revert with an arithmetic panic. That is non-compliance. |
| connect screen | "Vote on profiles. Pick the winner. **Earn $TTS** every week." | Earnings language. Removed. |
| `public/llms.txt` (written earlier the same day, by me) | "There is **no mint function** and MINTER_ROLE has no members" | Half wrong — `mint()` exists. Corrected within the hour, before it was crawled. |

## FIXED on temptationtoken.io (WordPress) — applied and verified 2026-09-25

**My earlier claim that there was "no API path" to this copy was wrong.** I had tested
Application Passwords (401) and treated that as proof core REST was closed — but Hostinger
blocking Application Passwords is exactly what the `tts-api-auth` plugin exists to bypass.
With the `X-TTS-API-Key` header, `wp/v2/posts`, `wp/v2/pages` and `wp/v2/settings` all
return 200 as administrator. The live plugin also already carries the Elementor slashing
fix and read-back rollback, so nothing was waiting on an upload. Details:
`PLUGIN_UPLOAD_NOTE.md`.

All edits were anchored on exact strings with asserted occurrence counts
(`scripts/sale/wp_fix_false_claims.mjs`), backed up to `outputs/wp_backups/2026-09-25/`
first, and verified against fresh cache-busted fetches of the rendered pages.

| Page | Was | Now |
|---|---|---|
| Home (52) | "✓ Zero Critical Findings / ✓ Zero High Findings" | states 1 critical + 3 high raised, all four remediated in a later version |
| Home (52) | "TrustNet Score: **17.92**" | "TrustNet Score: **0.01** — KYC has not been completed, which is most of that gap" |
| Home (52) | "Audited by Solidproof … (April 2026)" | says an **earlier version** was audited and the contract running today post-dates it |
| Home (52) | "fixes are queued for the next contract upgrade" | notes the token is **not upgradeable**, so what is deployed is permanent |
| Home (52) | "the first **vote-to-earn** cryptocurrency game" | "a weekly fan-voting game" |
| Home (52) | "Settlement … automatically **within minutes**" | keeper service closes rounds, typically 17–25 min; Chainlink Automation is not the mechanism |
| Home (52) | "paid … with **zero human involvement**" | states the keeper triggers it, and that rounds 9–12 closed unattended |
| Home (52) | "Uniswap v2 pool created **at $0.01**" | price removed |
| Home (52) | "Launch Price **$0.01** / Target Price **$0.10**" | both removed |
| Home (52) | "New users receive **$5** in free TTS" | "500 $TTS free — enough for 100 minimum votes" |
| Home (52) | **FAQPage JSON-LD** carried its own copy of the audit and settlement answers | both corrected |
| Post 1657 | "Solidproof audit … (zero critical findings)" | points to the published finding-by-finding status |
| Post 1698 | "zero critical or high findings. The V3b voting contract audit **is in progress**" | states what was actually found and that it has been re-tested against deployed bytecode |
| Post 1766 | "The contract **is audited by Solidproof**" | clarifies an earlier version was audited and today's contract post-dates it |
| Post 1704 title | "**Earn Up to 45% APR** Plus 3x Vote Multipliers" | "Tiers, APR and Vote Multipliers (design — not yet available)" |
| Post 1704 Rank Math SEO title + description | "earns up to 45% APR … **Stake Temptation Token on Base today**" | describes the design and says the feature is switched off |
| Post 1704 body | presented staking as available | amber notice at the top: not available, no APR is being paid |

**Two things this turned up that were easy to miss:**
1. The homepage's visible FAQ and its **FAQPage JSON-LD** are separate copies of the same
   answers. Fixing only the visible one leaves the false claim in the exact place Google
   and answer engines read from — which is worse than leaving it on screen.
2. Rank Math stores its **own** SEO title and description, which override the post title in
   `<title>`, Open Graph, Twitter cards and BlogPosting JSON-LD. Changing the WordPress
   title alone left "Earn Up to 45% APR" in ten places on the staking post.

Verify any time, read-only: `scripts/sale/wp_verify_claims.sh` — currently **PASS**, all
five pages render, every corrected string absent.

## Not a problem, contrary to the brief
- **No Polygon-era copy exists.** All six "Polygon" hits on the homepage are
  `particles.js` shape configuration (`"polygon":{"nb_sides":5}`). Zero occurrences of
  "MATIC". The stale-copy premise in Part 1.5 does not hold for the homepage.
- **The site is not blocked from crawlers.** `robots.txt` is permissive, `blog_public`
  is on, meta robots reads `index, follow`, the sitemap returns 200, and all 11 named
  crawlers get HTTP 200 on both hosts. Whatever refused a fetch on Sept 24, it was not
  the site's robots rules.

## One thing SolidProof should be asked to correct
Their public TrustNet listing for Temptation Token still describes the **40%** prize
split ("takes 40% of the weekly prize pool. Winners take 40%"). The split has been
35/35/10/20 for a long time and "40% near prize words" is a CI-guarded prohibition in
this repo. Ask them to update the listing.
