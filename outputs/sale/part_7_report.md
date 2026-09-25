# Part 7 — Data room, listings, outreach queue

**Status: data room and listings DONE. Outreach queue BLOCKED on the same credential as
Part 0.**

## Data room — `outputs/sale/data_room/`
| File | Source |
|---|---|
| `INDEX.md` | — |
| `one_pager.md` | live chain + database reads |
| `round_history.csv` | **every round from chain**, with the gap between close and the next round's start, which is what separates an automatic settlement from a hand rescue |
| `contracts.md` | chain reads, including two addresses a buyer should be warned about |
| `metrics_snapshot.md` | generated, not typed |

Pointing at existing material: the pre-audit, the liquidity fork test, the disclosure log,
`CLAUDE.md`.

**Still needs Jim:** monthly cost sheet (actual invoice amounts), Loom walkthrough, entity
pack, counsel letter.

`round_history.csv` is the most useful artifact in the room. It shows round 4 taking 328
hours to close, rounds 6–8 rescued by hand 18–37 hours late, and then rounds 9–12 each
closing in 0.5 hours unattended. That arc is more persuasive than any claim about
reliability, because a buyer can verify every row.

## Listings — `outputs/sale/listings/`
`listing_copy.md` covers all three venues. SFW, no token price, no earnings language, and
it states the pre-traction numbers plainly in a section headed "The honest part." A buyer
will find 3 lifetime votes in ten minutes of diligence; finding it in our own listing is
worth more than hiding it.

## Outreach — drafted, not queued
`outreach_emails.md`: three emails each for AROA (`office@aroaagency.com`) and RCI IR
(`gfishman@pondel.com`, `mwichman@pondel.com`), at 09:05 recipient-local on Oct 1, Oct 6,
Oct 12. SheX is held until its Impressum email is verified. No automated email to Canadian
contacts (CASL).

**Two blockers, both Jim's:**
1. **Proton Bridge credentials.** Same blocker as Part 0's canary. `tts-outreach/.env`
   contains only `DRY_RUN` and the caps — `PROTON_SMTP_USER` and `PROTON_BRIDGE_PW` have
   never been set. Bridge itself is running and starts at login.
2. **The CAN-SPAM postal address.** Blockchain Entertainment LLC's physical mailing
   address is not anywhere in this repo. A commercial email without it is a violation per
   message. Nothing should be enqueued until it is supplied.

I did not enqueue anything. A queue that cannot send, pointed at real recipients, with a
missing legally-required footer, is worse than an empty one.

Note: the Supabase `outreach_queue` table is empty, has no sender anywhere in `api/` or
`lib/`, and its schema (`platform`, `target_handle`, `target_url`) is built for social DMs,
not scheduled email. It is not the vehicle for this.

## Weekly results note
Not built. It depends on the same send path.

## Gate
| Gate | Result |
|---|---|
| Canary received | **BLOCKED** — no Bridge credentials |
| Queue shows the right dates/times | **NOT MET** — deliberately not enqueued, see above |
| Data room index complete | **PASS** for everything derivable from code and chain; four items need Jim |
