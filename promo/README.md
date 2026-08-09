# Temptation Token — promo asset toolkit

Generates copy-paste promo material: a pack per creator for her agency to hand her, and
your own daily @CryptoFITJim posts.

**Nothing here posts to any platform.** Automated posting to IG/X from a third-party tool
violates their terms and risks the account. Every output is something a human copies and
pastes.

```
#ad required · no price/earnings claims · link only, never posted on OnlyFans.
```

## The scripts

| Script | What it does |
|---|---|
| `contestant_pack.py` | One creator → 5 captions, 5 Story overlays, 7-day calendar, copy-button page |
| `my_daily_posts.py` | 5 @CryptoFITJim posts/day from live standings or `standings.json` |
| `image_cards.py` | Branded PNG leaderboard card (Pillow) to attach to posts |
| `referral_tracker.py` | Per-agency codes, attribution report, "want to scale?" email draft |
| `compliance.py` | The rule engine everything routes through. `python3 promo/compliance.py` self-tests it |
| `verify_all.py` | Independent re-scan of everything already on disk. Exit 1 on any failure |

## Quick start

```bash
python3 promo/compliance.py                     # prove the rules work (16 cases)

python3 promo/contestant_pack.py \
  --name "Demo Creator" --handle @democreator --niche fitness \
  --link "https://app.temptationtoken.io/?ref=democreator"

python3 promo/my_daily_posts.py                 # → promo/out/posts_YYYY-MM-DD.{md,html}
python3 promo/image_cards.py --size square      # → promo/out/leaderboard_*.png

python3 promo/referral_tracker.py add --name "Starlight Talent" --email ops@starlight.co
python3 promo/referral_tracker.py report
python3 promo/referral_tracker.py draft-email --agency starlight-talent --threshold 3

python3 promo/verify_all.py                     # gate before distributing anything
```

## How compliance is actually enforced

Every generated string passes through `compliance.enforce()` **before it reaches disk**,
and that function raises. A pack that would contain one bad line is not written at all —
a partially compliant pack is worse than none, because someone posts from it.

`verify_all.py` is a second, independent pass over the files that already exist, so a bug
in a generator (or a hand-edit afterwards) still gets caught.

Banned: OnlyFans references, price/market claims, earnings claims, investment framing,
concrete money amounts (`$500` — but `$TTS` the ticker stays legal), NSFW, and instructing
anyone to post the link on OnlyFans. Required on promo copy: `#ad`, plus her vote link on
feed captions.

This is a seatbelt, not a compliance department, and it is not legal advice. Anything a
human improvises still needs a human's judgement.

## Standings input

Live if `TTS_READONLY_API_URL` + `TTS_READONLY_API_KEY` are in `.env` — the fetch is
**GET-only by construction**, there is no code path that could mutate backend state.
Otherwise drop a `promo/standings.json`; `standings.example.json` shows the shape.

## Two things worth knowing

**1. UTM parameters are not captured by this app.** I checked `src/` and `api/` — there is
no `utm_` handling anywhere. A UTM-only agency tracker would produce tidy links and report
zero signups forever while looking like it worked. So `referral_tracker.py` gives each
agency a **club code** instead (`?club=<code>`), which is captured in localStorage,
prefills the submit form, and is registered on-chain — a real, auditable path that also
lets the agency actually be paid. UTM strings are still generated for analytics, but
attribution reads the club path. Register the code in the admin Clubs tab (or have them
self-serve at `/clubs`) or the link tracks but cannot pay.

**2. There is no @CryptoFitJim auto-poster to plug into.** `api/social-post.js` automates
`@temptationtoken` and explicitly notes `@CryptoFitJim` posts manually. This toolkit does
not add one. It writes `feed_YYYY-MM-DD.json` so that if you ever wire up an approved
poster, it reads that rather than anyone re-implementing the generator.

The brief also referenced reusing a `dm_copilot.html` pattern — no such file exists in this
repo or anywhere on this machine, so `copy_ui.py` is a fresh implementation of the same
idea (self-contained page, one Copy button per block, works offline and from a phone).

## Photos of creators

`image_cards.py` renders a template only. It will not place a photo unless you pass
**both** `--photo <local path>` and `--photo-consent`, and it never sources images itself.
Using someone's likeness in promotional material without a licence and their consent is a
right-of-publicity problem, and in this context it matters more, not less.
