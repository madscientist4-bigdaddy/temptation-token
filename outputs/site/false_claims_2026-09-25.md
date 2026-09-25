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

## Still live on temptationtoken.io (WordPress) — needs Jim

The WordPress plugin exposes only `/elementor/{id}`, `/meta/{id}`, `/css`, `/fix-logo`.
Application Passwords are blocked by Hostinger (verified: 401 on `/wp/v2/users/me`), so
there is **no API path to edit this copy**. These must be changed in wp-admin, and per
the Aug 16 rule they must be edited by hand, anchored on exact strings — never bulk
find/replace.

| Page | String | Replace with |
|---|---|---|
| Home / FAQ | "Has the smart contract been audited? **Yes. Audited by Solidproof** … ✓ Zero Critical Findings ✓ Zero High…" | "An earlier version of the voting contract was audited by SolidProof. It raised one critical and three high findings, which were remediated in a later version. The contract running today was deployed after that audit and has not itself been audited." |
| Home | "**TrustNet Score: 17.92**" | "TrustNet score: 0.01 (KYC not completed, which is most of the gap)" |
| Home | "Uniswap v2 pool created **at $0.01**" | Delete the price. No token price in public copy. |
| Home nav/hero | "**Earn Up to 45% APR Plus 3x Vote Multipliers**" | Staking is gated off in every client. Either remove, or mark clearly as not yet available. This is the most dangerous line on the site: it promises a return on a feature nobody can use. |
| Home | "the first **vote-to-earn** cryptocurrency game" | "a weekly fan-voting game" |
| Home | "Settlement via Chainlink VRF happens automatically **within minutes** of round close" | Chainlink Automation has not fired since 2026-08-05. Rounds are closed by our own keeper, typically 25–35 minutes after close. VRF still picks the winner. |
| Home | "Prizes are automatically paid … with **zero human involvement**" | True in effect, but the mechanism named is wrong. Say "closed automatically by our keeper service; the winner is chosen by Chainlink VRF." |

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
