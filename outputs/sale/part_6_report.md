# Part 6 — Store readiness

**Status: BLOCKED on Jim (Plan task T05). PWA groundwork partly already in place.**

## Android / Play — blocked
The first step is a question only Jim can answer: **is the Play account Personal or
Organization?** Everything forks on it.
- **Personal** (created after 2023-11-13) → 14-day closed test with 12+ testers who stay
  opted in for 14 *consecutive* days before production access. Over-recruit to 15–20,
  because a single drop resets the clock.
- **Organization** → submit straight to production.

**No Play Console app exists**, so there is no track to upload an AAB to. `eas.json` has a
production profile ready; the build itself is not the blocker.

## Listing copy
Drafted at `outputs/listings/play_store_listing.md` (pre-existing).

⚠️ **Do not submit it as written.** It states the contest "settles automatically
on-chain." That is now *defensible* — rounds 9 through 12 each settled unattended within
30 minutes of close, four in a row — but the copy predates that record and was written
when it was false. Update it to say what is true and checkable ("weekly rounds settle
onchain; the last four settled without operator involvement") rather than leaving a claim
that happens to have become true by accident.

Also required and not yet answered: the **Financial Features declaration** (tokenized
digital assets — must be declared), content rating, data safety, and UGC moderation
(report / block / contact). Production-access questionnaire answers go in
`outputs/listings/play_production_answers.md` — not yet written, because the answers
depend on the account type above.

## iPhone — no App Store submission, by design
Apple guideline 1.2 excludes hot-or-not style voting on real people. The route is a
polished PWA. Partly in place already: `public/manifest.webmanifest`, `public/pwa/` icons,
`sw.js`, and `viewport-fit=cover` with safe-area handling in `index.html`. Still needed: a
splash screen set, an offline shell, and an Add-to-Home-Screen guide page. The TestFlight
build stays as a transferable asset.

## Gate
| Gate | Result |
|---|---|
| AAB uploaded to the right track | **BLOCKED** — no Play Console app exists |
| Listing copy passes a self-check against Play's blockchain-content rules | **NOT MET** — the settlement claim needs rewording and the Financial Features declaration is unanswered |
