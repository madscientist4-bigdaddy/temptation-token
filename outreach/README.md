# Temptation Token — B2B partnership outreach + promo

Self-contained. Python 3.11+, SQLite for all state, no paid SaaS required.

```bash
cd outreach
make setup        # credentials (validates the Gmail login for real)
make harvest      # find contacts
make schedule     # build the sequence
make send         # DRY_RUN by default — prints, sends nothing
make brief        # TODAY.md + dm_copilot.html
make test         # prove the guardrails
```

## The live switch

**One line, in `outreach/.env`:**

```
DRY_RUN=true     →     DRY_RUN=false
```

`true` prints every email it would send. `false` delivers. It defaults to `true`, and it
falls back to `true` on any missing or unparseable value — every accidental path lands on
"don't send". Check which mode you are in with `make live-check`.

## Modules

| File | What it does |
|---|---|
| `setup_wizard.py` | Asks for each credential with how-to, then **proves the SMTP login works** before writing `.env`. Refuses to save a credential it could not authenticate. |
| `harvest.py` | Crawls `/`, `/contact`, `/privacy`, `/imprint`, `/terms`… plus sitemap hits. 1 req/s, real UA, robots.txt obeyed per URL. Decodes `name [at] domain [dot] com`. Ranks `first.last@` > `firstname@` > `office@`/`info@` > `support@`, multiplied by page weight — **legal/privacy/imprint pages score highest**, which is how a named mailbox gets found. Validates syntax + MX. |
| `sunbiz.py` | FL Sunbiz + CA bizfile owner/registered-agent lookup via Playwright → `data/fedex_list.csv`. Prints the exact search URL when blocked rather than guessing. |
| `sender.py` | Day 0/1/3/4/7/12 cadence, SQLite state machine, all guardrails, DRY_RUN. |
| `reply_watcher.py` | IMAP poll every 30 min. Reply → halt sequence, macOS notification, suggested draft in `drafts/`. Opt-out → permanent suppression + automatic confirmation. |
| `daily_brief.py` | `TODAY.md` + `dm_copilot.html` (copy button + deep link per channel). `--date` previews another day. |
| `promo/contestant_pack.py` | 5 captions, 5 story overlays, 7-day calendar, compliance sheet. Every caption is filtered **before** it is written. |
| `promo/my_daily_posts.py` | 5 of your own posts/day from live standings or `standings.json`. |
| `promo/image_cards.py` | Pillow leaderboard PNG (1080×1350). Template only — a creator photo requires `--photo` **and** `--photo-consent-id`. |
| `promo/referral_tracker.py` | Per-agency UTM codes, signup counts, auto-drafted "want to scale?" email at 5 signups. |

## Guardrails

All seven live in `tts_outreach/guardrails.py` — one module, so there is one place to
audit and one place to test. `make test` proves each of them.

1. **CAN-SPAM** — no body is produced without the LLC name, postal address and a working
   remove instruction; `List-Unsubscribe` on every send; "remove" honoured permanently
   (`SUPPRESSED` is a terminal state with no reverse transition, by design).
2. **Email is the only thing software may send.** IG / X / Telegram / WhatsApp / forms are
   assisted-manual — and there is *no DM send function in the codebase*. That is the
   enforcement, not a flag.
3. **Never posts on OnlyFans** — banned in every promo caption.
4. **`#ad` required, price/earnings claims blocked** in all public promo copy.
5. **Blocklist** — substring-matched across name, domain, email and handles. A missing
   blocklist file is a hard error, never an empty list.
6. **One identity** — refuses to send as anything but the configured partnerships address.
7. **"Yes" routes through counsel** — the licensing + consent + FTC rider is step 1 of
   every positive-reply draft, before any profile goes live.

### Two rule sets, on purpose

A public creator caption and a private B2B email are different documents:

- **Captions** may not name the platform, may not carry any money claim, must carry `#ad`.
- **Emails** *may* say "nothing ever posts on OnlyFans itself" (that reassurance is the
  pitch) and *may* state deal terms ($2,500 pool, 50% share). What stays banned is token
  speculation — price targets, market cap, APY, "10x".

Collapsing these into one filter would have silently gutted the sales email.

## Scheduling

```bash
make install-schedule     # loads all four launchd jobs
make status               # counts by state
make uninstall-schedule
```

| Job | When |
|---|---|
| `…outreach.harvest` | Sundays 03:00 |
| `…outreach.send` | Mon–Fri hourly 09:05–16:05 (the guardrail is the real gate) |
| `…outreach.replies` | every 30 min |
| `…outreach.brief` | Mon–Fri 07:30 |

Manual equivalent:
```bash
cp launchd/*.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/io.temptationtoken.outreach.{harvest,send,replies,brief}.plist
```

## ⚠️ This repo is PUBLIC

`outreach/.gitignore` excludes `.env`, `data/agencies.csv`, `data/outreach.db`,
`contacts_found.csv`, `fedex_list.csv`, `drafts/`, `packs/`, `cards/` and the generated
briefs. Those hold third parties' contact details and a Gmail app password. **Do not
`git add -f` any of them.** Verify before committing:

```bash
git status --porcelain outreach/ | grep -v '^??' 
```
