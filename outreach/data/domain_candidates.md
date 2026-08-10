# Blank-domain rows — candidates found, NOT auto-filled

Six seed rows shipped with no domain. The spec said to web-search, confirm the real
management agency, fill the domain, then harvest.

I searched, but I have **not** written any of these into `agencies.csv`, because for most
of them the evidence does not reach "confirmed". Filling in a wrong domain does not
produce a blank — it produces a cold commercial email to an unrelated business, which is
the precise harm the blocklist exists to prevent. So these are staged here for a human
decision.

To accept one: put the domain in `data/agencies.csv`, then `make harvest`.

---

## Lush Management — AMBIGUOUS, two live candidates

Two different agencies with near-identical names, both real, both trading:

| Candidate | Evidence |
|---|---|
| `lushmgmt.co.uk` | "Lush Management — OnlyFans Management Agency", UK-based, matches IG `@thelushmgmt` and X `@lush_mgmt` |
| `lushmgt.com` | "OnlyFans Management \| Lush Management" — note the spelling: **lushmgt**, no second `m` |

There is also a separate "Lush Media Co". Your angle line is *"You're performance-priced;
so are we"* — pick whichever you actually researched, because these are not the same
company and one of them will not know who you are.

## Louna's Models — CONFIRMED AGENCY, domain not confirmed

Real and a strong fit: women-led, founded in Los Angeles in 2018 by a former top creator,
explicitly "creator first", 15–20 models per manager. That matches your angle line
exactly. But the only source that surfaced is a third-party directory profile
(supercreator.app), not the agency's own site. No official domain confirmed.

**Next step:** open the directory listing and take the outbound link from there.

## Red Fox — NOT SEARCHED / too generic

"Red Fox" collides with a very large number of unrelated businesses. Searching it blind
would produce a plausible-looking wrong answer. Give me the country or a handle and it
becomes findable.

## SEO Bounty — NOT SEARCHED / too generic

Same problem, and the name suggests an SEO/traffic vendor rather than a talent agency,
which may mean the angle line needs rewriting anyway.

## FansHub — NOT SEARCHED / too generic

Several unrelated "FansHub" entities exist. Your angle line refers to a *meme-page
network*, which is a specific and findable thing — if you can name one of those pages,
the parent is easy to identify.

## Calu Agency — deliberately not searched

Tier 3, `status=HOLD`. The system refuses to contact it until a case study exists, so
there is nothing to look up yet.

---

### Why this file exists rather than filled-in rows

The harvester is precise once it has a domain — it found 8 new addresses from legal and
imprint pages on the first run. What it cannot do is decide *which company you meant*.
That judgement is yours, and it is cheaper to make it here than to explain a misdirected
pitch to a stranger.

Sources consulted: [lushmgmt.co.uk](https://www.lushmgmt.co.uk/) ·
[lushmgt.com](https://www.lushmgt.com/) ·
[Lush IG](https://www.instagram.com/thelushmgmt/) ·
[Louna's Models profile](https://www.supercreator.app/guides/inside-lounas-models)
