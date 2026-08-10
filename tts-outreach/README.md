# tts-outreach

B2B partnership outreach to talent-management agencies. SQLite for state, no SaaS
except optional Hunter.io.

```
make setup      # wizard: writes .env (0600), seeds SQLite, enrols the ladder
make harvest    # crawl agency sites for contact points
make send       # sender — DRY-RUN unless .env says otherwise
make brief      # TODAY.md + dm_copilot.html, opened
make status     # what the system believes right now
make install    # load the four launchd jobs
```

## Modules

| File | Does |
|---|---|
| `harvest.py` | Crawls `/`, `/contact`, `/about`, `/privacy`, `/terms`, `/imprint`, `/legal` + sitemap hits. Extracts emails (incl. `name [at] domain [dot] com`), `mailto:`, `tel:`, `t.me/`, `wa.me/`, IG and X handles. Validates MX, scores, writes the best back to `agencies.csv`. |
| `sunbiz.py` | FL Sunbiz + CA bizfile lookup → `data/fedex_list.csv` (principal address, registered agent, officers). Prints search URLs when a registry blocks automation. |
| `sender.py` | SMTP sender via Proton Bridge (127.0.0.1:1025). Window, caps, blocklist, claim gate, `List-Unsubscribe`. Dry-run by default. |
| `reply_watcher.py` | IMAP poll via Proton Bridge (127.0.0.1:1143) → halts the sequence, macOS notification, drafts a reply into `drafts/`. |
| `daily_brief.py` | `TODAY.md` + `dm_copilot.html`. |
| `claims_guard.py` | Checks outbound copy against the deployed contract. |
| `bridge.py` | Proton Bridge TLS + reachability. Shared by sender, watcher and status. |
| `blocklist.py` | Fuzzy domain/name refusal. Fails closed. |

## The safety rails, and why each exists

**Dry-run is the default.** `DRY_RUN=true` in `.env`. Every email is printed in full
and written to `outbox/*.eml`. Nothing reaches SMTP until you flip it.

**Blocklist fails closed.** If `data/blocklist.txt` can't be read, the sender exits
rather than sending. A match sets the agency to `BLOCKED` and cancels its whole ladder.

**One email per agency per day, in order.** `db.due_email_steps()` enforces it. Without
this, a slipped D0 and an on-time D1 come due together and the same agency gets two
emails hours apart — which reads as broken automation and gets you spam-flagged.

**DMs are never automated.** `dm_copilot.html` gives you the text, a copy button and a
deep link. You paste and send. Automating IG/X/Telegram DMs breaks their terms and
costs you the accounts.

**Opt-out is absolute.** Any inbound matching remove/stop/unsubscribe/not-interested
sets `SUPPRESSED`, cancels the ladder, and drafts a one-line confirmation. That branch
is evaluated before every other intent.

**Claim gate.** `claims_guard.py` compares the copy to the deployed contract and blocks
live sending on a mismatch until you either fix the copy or acknowledge it via
`CLAIMS_ACK` in `.env`. It never blocks dry-run.

## Three things to resolve before going live

1. **The copy does not match the contract.** The email says creators keep *50% of every
   vote, paid weekly in USDC*. V3d pays **35% to the winning profile only**, in **$TTS**.
   A creator who doesn't win gets nothing; losing votes burn. If the 50% is a separate
   share you fund off-chain, say that explicitly — as written it reads as a description
   of the on-chain mechanic. `make claims` lists all four flagged claims.

2. **EU/UK targets need a lawful basis.** Six of fifteen are flagged in `TODAY.md`
   section 6. Two publish a German **Impressum**, which is where their address came
   from. Germany's UWG §7 makes unsolicited B2B advertising email unlawful without
   *prior consent*, and an Impressum address specifically may not be used for
   advertising. CAN-SPAM's opt-out model does not cover you there. Their own contact
   form is the safer channel — that is an invitation they published.

3. **`outputs/legal/00_risk_memo.md` calls the core loop launch-blocking.** Dated
   2026-08-04, it concludes the paid-vote + VRF-draw + prize mechanic "looks like an
   unlicensed lottery/illegal gambling in most states" and should be treated as
   launch-blocking until counsel clears it. This system recruits partners into that
   mechanic. Worth clearing before the outreach creates counterparties.

## Registry lookups

`sunbiz.py` reads public business-registration records. Small LLCs often register a
**home** address as the principal address — anything marked `residential_risk` in
`fedex_list.csv` should get a business-channel contact, not a courier to someone's
house.

## Mail: Proton Mail Bridge (required)

This system sends and receives through **Proton Mail Bridge**, not Gmail. Proton exposes
no public SMTP/IMAP — Bridge is a desktop app that decrypts locally and serves ordinary
mail servers on loopback:

| | Host | Port | Security |
|---|---|---|---|
| SMTP (sending) | `127.0.0.1` | `1025` | STARTTLS |
| IMAP (replies) | `127.0.0.1` | `1143` | STARTTLS |

Two things that catch everyone:

1. **`PROTON_BRIDGE_PW` is the password Bridge generates**, shown in its Mailbox details
   / Configuration screen — *not* your Proton account password. The account password
   authenticates Bridge to Proton; this one authenticates us to Bridge. Using the wrong
   one looks like a typo'd password.
2. **Bridge presents a self-signed certificate**, so Python's default TLS verification
   rejects it. `bridge.py` uses an unverified context — but only for loopback hosts, and
   it refuses to relax verification for anything else, so the exemption cannot follow a
   config change out to a real server.

Check it any time with `make status`, which shows both ports.

## ⚠️ Proton Bridge must be running — and set to launch at login

**Nothing sends or receives while the Bridge app is closed.** There is no queue and no
retry: if Bridge is down, the sender aborts the whole run with

> Proton Bridge isn't running — open the Proton Mail Bridge app, then re-run.

That is deliberate — failing once, loudly, beats a run that burns through the task list
producing dozens of connection errors and leaves half a sequence in an unknown state.

**Before relying on the scheduled jobs below, open Bridge → Settings → enable "Start on
login".** launchd will happily fire the sender at 09:07 after a reboot; if Bridge did not
come back up with the Mac, that firing does nothing but log a failure, and the day's
outreach silently doesn't happen. A logged-out or restarted Mac is the normal way this
system quietly stops working.

## Scheduling

```bash
make install     # copies plists to ~/Library/LaunchAgents and loads them
make status      # shows which are loaded, plus Bridge connectivity
make uninstall
```

Or by hand:

```bash
cp launchd/*.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/io.temptationtoken.outreach.harvest.plist
launchctl load ~/Library/LaunchAgents/io.temptationtoken.outreach.sender.plist
launchctl load ~/Library/LaunchAgents/io.temptationtoken.outreach.replies.plist
launchctl load ~/Library/LaunchAgents/io.temptationtoken.outreach.brief.plist
```

harvest = Mondays 06:00 · sender = hourly :07 from 09–16 · replies = every 30 min ·
brief = 07:30 daily. The sender re-checks the window itself, so an out-of-hours firing
is a no-op.

Every one of those jobs depends on Proton Bridge being open. `make status` is the fastest
way to tell whether the system is actually able to work right now — a scheduled job that
fires with Bridge closed exits cleanly and does nothing.

## Going live

1. `make claims` — fix the copy or set `CLAIMS_ACK`.
2. Replace the `REPLACE-ME` placeholders in `.env` (Calendly, mailing address). The
   sender refuses to run live while they're there.
3. Resolve the EU/UK question for the six flagged targets.
4. Set `DRY_RUN=false`.
5. `make send`.
