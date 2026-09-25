# Part 2 — Site rebuild (same look, new structure)

**Status: NOT STARTED. Deliberately deferred, and I think correctly.**

Part 2 is a full marketing-site rebuild on staging — ten new pages, design-token
extraction, before/after screenshots, Lighthouse targets — and it **ends at a hard
approval gate** ("Stop and wait for Jim's approval, Plan task T15") before anything ships.

Three reasons it was not attempted in this pass:

1. **No staging environment exists**, and no WordPress route can create one. The plugin
   exposes `/elementor/{id}`, `/meta/{id}`, `/css`, `/fix-logo` only; Application
   Passwords are blocked by Hostinger (verified, 401). Building ten pages through an
   Elementor-JSON endpoint, with the Aug 16 pre-slashing rule on every write, is a
   multi-day job with a blanked-page failure mode that has already happened once.
2. **It would ship nothing.** The gate means the work sits unpublished until Jim reviews
   it — so it competes for time against items that reach users immediately.
3. **The urgent subset is already done.** The genuinely damaging content on the live site
   is not its structure, it is the false claims. Those are enumerated with exact
   replacement strings in `outputs/site/false_claims_2026-09-25.md`, and the app-side
   equivalents are fixed and deployed.

## What I'd do first if this resumes
Not the rebuild. **The copy fixes**, in this order, all in wp-admin, anchored on exact
strings:
1. "Earn Up to 45% APR Plus 3x Vote Multipliers" — a promised return on a feature that is
   switched off in every client. This is the most dangerous line on the site.
2. The "Zero Critical Findings / TrustNet 17.92 / Audited by Solidproof" block.
3. "Uniswap v2 pool created at $0.01" — a token price.
4. "Settlement via Chainlink VRF happens automatically within minutes" — Chainlink
   Automation has not fired since 2026-08-05.

Then structure, if there's still time before Oct 16. A buyer will forgive a dated layout.
A buyer will not forgive a security claim that turns out to be false.
