# Blank-domain rows — 2 resolved, 4 still need you

Six seed rows shipped with no domain. Filling in a wrong domain does not produce a blank —
it produces a cold commercial email to an unrelated business, which is the precise harm the
blocklist exists to prevent. So nothing here is guessed.

**Updated 2026-08-10.** Two rows are now resolved with evidence and have been written into
`data/agencies.csv` + `outreach.db` and harvested. Four still need information only you have.

To accept one of the remaining: put the domain in `data/agencies.csv`, then `make harvest`.
To reverse either resolved row: `data/agencies.csv.bak` is the pre-fill snapshot.

---

## ✅ RESOLVED — Louna's Models → `lounasmodels.com`

Status now **VERIFIED**, `contact@lounasmodels.com`.

Evidence, three independent sources plus a first-party confirmation:
- The Supercreator profile names `lounasmodels.com` in body text.
- A Trustpilot review page exists for `lounasmodels.com`.
- Socials `@lounasmodels` on Instagram, TikTok, YouTube and Linktree all resolve to the
  same agency.
- **First-party:** the harvester then pulled `contact@lounasmodels.com` from
  `https://lounasmodels.com/privacy` — on-domain, role address, MX-verified, score 16.8.
  That is the agency's own page confirming its own address, which is stronger than any
  directory listing.

> ⚠️ **Name collision worth knowing about.** A separate `lounasmodels.us` trades as
> "Lousnas Models — OnlyFans Agency in **Miami**". Different entity, different TLD. The row
> we filled is the **Los Angeles, founded 2018** agency, which is the one your angle line
> ("you built creator-first") describes. If you meant the Miami one, reverse this.

## ✅ RESOLVED — Lush Management → `lushmgmt.co.uk`

Status now **FORM_ONLY** — real agency, but no email address published; they take
applications through an on-site form only. The sequence will treat it accordingly.

Why this one and not `lushmgt.com`: **your own angle line decided it.** You wrote
*"You're performance-priced; so are we."* `lushmgmt.co.uk`'s own copy reads *"We only make
money, when your account makes money. There are no hidden costs on your account."* That is
the same claim, and it is the site you were describing. The handles in the original note
(`@thelushmgmt`, `@lush_mgmt`) also belong to this one, and both are now on the row.

`lushmgt.com` (no second `m`) is a **different, real company** — also an OnlyFans
management agency, contact `info@lushmgt.com`, but it publishes no pricing or commission
model at all, so the angle line would not land. Left alone deliberately.

---

## ⛔ STILL NEED YOU — four rows

These are not research problems. Each needs one fact only you have, and each is one line of
`agencies.csv` away from being contactable.

| Agency | Tier | What I need from you | Why I won't guess |
|---|---|---|---|
| **Red Fox** | 2 | Country, or an IG/X handle | "Red Fox" collides with a large number of unrelated businesses. A blind search returns a plausible wrong answer, which is the worst outcome — it looks right and emails a stranger. |
| **FansHub** | 2 | Name **one meme page** in the network | Several unrelated "FansHub" entities exist. Your angle line refers to a *meme-page network*, which is specific and findable — from one page, the parent is easy. |
| **SEO Bounty** | 2 | Country/handle — **and confirm they're a talent agency at all** | Same collision problem, plus the name reads like an SEO/traffic vendor rather than a creator agency. If it is, the angle line needs rewriting before the domain matters. |
| **Calu Agency** | 3 | Nothing — parked on purpose | `status=HOLD`. The system refuses to contact tier-3 until a case study exists, so there is nothing to look up yet. |

---

### Why this file exists rather than filled-in rows

The harvester is precise once it has a domain — it found `contact@lounasmodels.com` on a
privacy page within seconds of being given one. What it cannot do is decide *which company
you meant*. That judgement is yours, and it is cheaper to make it here than to explain a
misdirected pitch to a stranger.

Sources consulted: [lushmgmt.co.uk](https://www.lushmgmt.co.uk/) ·
[lushmgt.com](https://www.lushmgt.com/) ·
[Lush IG](https://www.instagram.com/thelushmgmt/) ·
[Louna's Models profile](https://www.supercreator.app/guides/inside-lounas-models) ·
[Louna's IG](https://www.instagram.com/lounasmodels/) ·
[Trustpilot — lounasmodels.com](https://ca.trustpilot.com/review/lounasmodels.com) ·
[lounasmodels.us (different entity)](https://lounasmodels.us/)
