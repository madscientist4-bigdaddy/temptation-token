# Part 0 — Daily reminder automation

**Status: BUILT AND INSTALLED. Gate 4 (canary send) BLOCKED on one secret only Jim has.**

## What changed
| File | Purpose |
|---|---|
| `ops/sale/tts_metrics.py` | **new** — all live reads, stdlib-only, never raises |
| `ops/sale/tts_daily_digest.py` | `metrics_hook()` wired to `tts_metrics.collect()` |
| `ops/sale/status.json` | **new** — hand-maintained facts (SolidProof/Play/listings/Blockaid) with an `as_of` that nags after 7 days |
| `ops/sale/run_digest.sh` | **new** — launchd wrapper: loads `.env`, preflights Bridge, enforces the Nov 6 end date |
| `ops/sale/launchd/com.temptationtoken.digest.{morning,evening}.plist` | **new**, installed to `~/Library/LaunchAgents/`, both loaded |

## Metrics wired (verified live 2026-09-25 00:59 UTC)
Every item Part 0 asked for, and what each actually reads:

- **Round + close time** — `currentRoundId()` / `getRound()` on V3d. → *Round 13, 21 profiles, closes Mon Sep 28 04:59 UTC.*
- **Last settlement + who** — `?action=keeper-status` `lastSettlement`, whose `automatic` flag is earned (only a `status:'done'` audit row sets it). → *round 11, autopilot, `0x5b24c562…`.*
- **Consecutive clean settlements** — **derived from the chain, not the audit table**, because that table is known to drop rows (CLAUDE.md P1) and a buyer checks the chain. A round counts as self-settled only if the next round opened within 3h of its close; August's hand-rescues ran 17–38h late, so that gap is the discriminator. → **4 consecutive.**
- **Creators vs AI Models** — reports the real approved count and says the split is unavailable until `entry_type` ships in Part 3, rather than printing a fake zero.
- **Signups / unique voters (7d)** — Supabase. → *23 signups (5 in 7d); 3 votes all-time, 0 in 7d.*
- **Card buys (7d)** — `project_income`, with the caveat that zero is expected while Transak is on a sandbox key.
- **Pool depth + max buy under 2%/5%** — live `getReserves()`, constant-product with the 0.3% LP fee. The 1% transfer tax is correctly *excluded*: `isTaxExempt(pair)` is **true** on-chain.
- **Blockaid / SolidProof / Play / listings** — `status.json`.
- **Trophy supply** — `totalSupply()` → 3.

Two self-checks run every morning and shout in the digest: the autopilot being disarmed, and `upkeepNeeded=true` beside `action=null` — the exact contradiction that hid the 37-hour August outage in plain sight.

## Gate results
| Gate | Result |
|---|---|
| `--dry-run` for today | **PASS** — full digest rendered, all metrics resolved |
| launchd jobs installed + loaded | **PASS** — both show in `launchctl list` |
| wrapper exercises the real launchd path | **PASS** — fails closed, exit 3, with the fix in the message |
| **one real canary send** | **BLOCKED** — no Bridge credentials on this machine |

## Fixed along the way
Python on this Mac is a python.org 3.13 build whose default SSL context trusts nothing (`Install Certificates.command` was never run), so **every** HTTPS call in the digest died with `CERTIFICATE_VERIFY_FAILED` while `curl` worked fine. `tts_metrics._ctx()` now resolves a CA bundle explicitly (`$SSL_CERT_FILE` → certifi → `/etc/ssl/cert.pem`). Without this the digest would have shipped and silently reported every metric as unavailable forever.

## Jim must do (2 items)
1. **Bridge credentials** — `PROTON_BRIDGE_PW` is absent from both `.env` files; `tts-outreach/.env` only ever had `DRY_RUN`/caps. Proton Bridge itself **is** running (SMTP 1025 + IMAP 1143 open) and **is** set to start at login (LaunchAgent present). Add, without pasting into chat:
   ```
   printf 'BRIDGE_USER=%s\n' 'your-proton-address' >> .env
   read -rs P && printf 'BRIDGE_PASS=%s\n' "$P" >> .env && unset P   # paste, press enter
   ```
   `BRIDGE_PASS` is the password **Bridge generates** (Bridge → account → Mailbox details), never the Proton account password. Then: `./ops/sale/run_digest.sh` sends the canary.
2. **Wake schedule** — current repeating wake is **01:55 daily**, not 06:55. launchd runs a missed calendar job on wake, so the digest will still arrive; it just may arrive late. One sudo command fixes punctuality:
   ```
   sudo pmset repeat wakeorpoweron MTWRFSU 06:55:00
   ```
   Note this **replaces** the existing 01:55 event — check nothing else depends on it.

## Note on the end date
launchd calendar jobs cannot express an end date. `run_digest.sh` enforces Nov 6, 2026 itself and unloads both jobs on the first run past it.
