#!/usr/bin/env python3
"""
Sequencer + sender.

Cadence per target:
    day 0   email_1   (no email address -> a DM/form TASK instead, never a send)
    day 1   email_2
    day 3   DM bump task
    day 4   email_3
    day 7   FedEx task (US targets that have a postal address)
    day 12  still nothing back -> NURTURE

Every send passes, in order: blocklist -> state -> suppression-by-address -> weekday ->
clock -> daily cap -> identity -> CAN-SPAM -> token-speculation -> no-attachment. Any
failure is logged with its reason and the send is abandoned, never "tried anyway".

DRY_RUN is TRUE unless .env literally says false. Every accidental path — missing file,
typo, unset variable — lands on print-don't-send.

    python3 sender.py --schedule        # load/refresh the sequence, no sending
    python3 sender.py                   # run due sends (DRY_RUN honours .env)
    python3 sender.py --force-window    # ignore the clock (for previewing only)
"""

from __future__ import annotations

import argparse
import smtplib
import sys
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mailer
from tts_outreach import config, db, guardrails  # noqa: E402

STEPS = {1: "email_1.txt", 2: "email_2.txt", 3: "email_3.txt"}
SCHEDULE = [(0, "EMAIL", 1), (1, "EMAIL", 2), (3, "DM", 0), (4, "EMAIL", 3),
            (7, "FEDEX", 0), (12, "NURTURE", 0)]

DM_TEXT = (
    "Hey — Temptation Token here. It's a weekly vote-to-earn contest on Base: fans buy votes in $TTS for a creator, and at settlement the winning creator takes 35% of the votes cast on her, paid on-chain. Votes on creators who don't win that round are burned, so it's upside, not a guaranteed monthly number. Every entrant also gets a trafficked profile page linking back to her channels. 5 launch slots, zero OnlyFans posting. Want the one-pager?"
)


def render(template: str, cfg: config.Config, row: dict) -> tuple[str, str]:
    """(subject, body-with-footer). Raises if a required token is unset."""
    raw = (config.TEMPLATE_DIR / template).read_text(encoding="utf-8")
    footer = (config.TEMPLATE_DIR / "footer.txt").read_text(encoding="utf-8")

    subject = ""
    if raw.startswith("SUBJECT:"):
        head, _, rest = raw.partition("\n")
        subject = head[len("SUBJECT:"):].strip()
        raw = rest

    tokens = {
        "{{name}}": row.get("name", "there"),
        "{{angle_line}}": (row.get("angle_line") or "").strip(),
        "{{CALENDLY}}": cfg.calendly_url,
        "{{LOOM}}": cfg.loom_url,
        "{{MAIL_ADDR}}": cfg.mail_addr,
        "{{ONEPAGER}}": cfg.onepager_url,
    }
    body = raw + footer
    for k, v in tokens.items():
        body = body.replace(k, v)

    leftover = [t for t in tokens if t in body]
    if leftover:
        raise ValueError(f"unfilled tokens {leftover} in {template}")
    # An empty token silently produces "here's the video: " with no link.
    for tok, val in (("{{CALENDLY}}", cfg.calendly_url), ("{{LOOM}}", cfg.loom_url)):
        if tok in raw and not val:
            raise ValueError(f"{template} needs {tok} but it is not configured in .env")
    return subject, body


def ensure_schedule(c, today: date) -> int:
    """Give every contactable agency a day-0 date and materialise its task rows."""
    created = 0
    bl = guardrails.load_blocklist()
    for row in c.execute("SELECT * FROM agencies").fetchall():
        r = dict(row)
        ok, why = guardrails.can_contact(r, blocklist=bl)
        if not ok:
            continue
        if not r.get("seq_started"):
            c.execute("UPDATE agencies SET seq_started = ?, updated_at = ? WHERE id = ?",
                      (today.isoformat(), db.now_iso(), r["id"]))
            r["seq_started"] = today.isoformat()
            if r["state"] == "NEW":
                db.set_state(c, r["id"], "QUEUED", "scheduled")
            created += 1

        start = date.fromisoformat(r["seq_started"])
        for offset, kind, step in SCHEDULE:
            due = (start + timedelta(days=offset)).isoformat()
            if kind == "EMAIL" and r.get("email"):
                continue  # emails are driven directly off the schedule, not task rows
            if kind == "EMAIL" and not r.get("email") and offset != 0:
                # SCHEDULE has three EMAIL entries (days 0/1/4). For a target with no
                # address they must NOT each spawn a task — that produced the same
                # agency listed two or three times in one brief. One manual task on
                # day 0 is the whole ask; the day-3 DM bump below is the follow-up.
                continue
            if kind == "EMAIL" and not r.get("email"):
                # No address, so this becomes a manual task. Pick the best channel we
                # actually have — and when we have none, say so plainly rather than
                # labelling it "email", which reads as though a mailbox exists.
                ch = ("form" if r.get("form_url") else
                      "instagram" if r.get("instagram") else
                      "x" if r.get("x_handle") else
                      "telegram" if r.get("telegram") else
                      "unknown")
                if ch == "unknown":
                    payload = (f"NO CONTACT CHANNEL ON FILE for {r['name']}.\n"
                               f"Find the official site first (web-search "
                               f"\"{r['name']} OnlyFans agency official site\"), add the domain "
                               f"to data/agencies.csv, then re-run: python3 harvest.py\n\n"
                               f"Once you have a channel, the message is:\n{DM_TEXT}")
                    db.add_task(c, r["id"], "LOOKUP", "unknown", due, payload)
                else:
                    db.add_task(c, r["id"], "FORM" if ch == "form" else "DM", ch, due,
                                f"No email on file. Reach out via {ch}. Text:\n{DM_TEXT}")
            elif kind == "DM":
                ch = ("instagram" if r.get("instagram") else
                      "x" if r.get("x_handle") else
                      "telegram" if r.get("telegram") else "form")
                db.add_task(c, r["id"], "DM", ch, due, DM_TEXT)
            elif kind == "FEDEX" and r.get("postal_addr"):
                db.add_task(c, r["id"], "FEDEX", "fedex", due,
                            f"Physical one-pager to {r.get('owner_name') or r['name']}\n{r['postal_addr']}")
    return created


def due_emails(c, today: date) -> list[tuple[dict, int]]:
    out = []
    bl = guardrails.load_blocklist()
    for row in c.execute("SELECT * FROM agencies WHERE seq_started IS NOT NULL").fetchall():
        r = dict(row)
        if not r.get("email"):
            continue
        ok, _ = guardrails.can_contact(r, blocklist=bl)
        if not ok:
            continue
        start = date.fromisoformat(r["seq_started"])
        for offset, kind, step in SCHEDULE:
            if kind != "EMAIL":
                continue
            if (start + timedelta(days=offset)) > today:
                continue
            # dry_run = 0 ONLY. A preview must never consume a real send slot:
            # previewing step 1 and 2 marked them "done", so the first genuine
            # email these agencies would have received was the step-3 breakup,
            # referring to a conversation that never happened.
            already = c.execute(
                "SELECT 1 FROM sends WHERE agency_id = ? AND step = ? AND dry_run = 0",
                (r["id"], step),
            ).fetchone()
            if already:
                continue
            out.append((r, step))
            break  # one email per target per run
    return out


def deliver(cfg: config.Config, to: str, subject: str, body: str) -> str:
    """
    Hand off to mailer.py — the ONE place that knows which transport is configured.

    This used to open smtp.gmail.com directly. When the mail layer was moved to Proton
    Bridge, mailer.py was created and api.py was rewired to it, but this function was
    missed — so the campaign kept dialling Gmail with an empty GMAIL_APP_PW. The first
    live batch produced 98 SMTP 535 BadCredentials failures across 14 agencies before
    anyone noticed, because a transport that is merely misconfigured looks identical to
    one that is quiet.

    Never reintroduce a transport here. mailer.transport() is the single source of truth.
    """
    up, detail = mailer.check()
    if not up:
        # Fail loudly with the actual reason rather than 14 opaque SMTP errors.
        raise ConnectionError("mail transport unavailable: " + "; ".join(detail))
    return mailer.deliver(cfg, to, subject, body)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--schedule", action="store_true", help="only build the schedule")
    ap.add_argument("--force-window", action="store_true", help="ignore weekday/clock gate")
    a = ap.parse_args()

    cfg = config.load()
    db.init()
    today = date.today()

    with db.connect() as c:
        n = ensure_schedule(c, today)
        started = db.get_meta(c, "campaign_started")
        if not started:
            db.set_meta(c, "campaign_started", datetime.now(timezone.utc).isoformat())
            started = db.get_meta(c, "campaign_started")
        if n:
            print(f"  scheduled {n} new agencies (day 0 = {today})")
        if a.schedule:
            counts = db.counts_by_state(c)
            tasks = c.execute("SELECT COUNT(*) n FROM tasks WHERE done=0").fetchone()["n"]
            print(f"  states: {counts} · open tasks: {tasks}")
            return 0

        mode = "\033[33mDRY RUN\033[0m" if cfg.dry_run else "\033[31mLIVE\033[0m"
        print(f"\n\033[1mSENDER\033[0m  [{mode}]  from={cfg.from_email or '(unset)'}\n")

        in_win, why = guardrails.in_send_window()
        if not in_win and not a.force_window and not cfg.dry_run:
            print(f"  \033[33mheld\033[0m — {why}")
            return 0
        if not in_win:
            print(f"  \033[2mnote: {why} (dry-run/forced, continuing to preview)\033[0m")

        cap = guardrails.daily_cap(datetime.fromisoformat(started))
        sent_today = db.sends_today(c)
        pending = due_emails(c, today)
        if not pending:
            print("  nothing due today.")
            return 0

        print(f"  {len(pending)} due · cap {cap}/day · {sent_today} already sent today\n")
        done = 0
        for r, step in pending:
            if sent_today + done >= cap:
                print(f"  \033[33mcap reached\033[0m ({cap}) — {len(pending)-done} deferred to tomorrow")
                break

            if db.is_suppressed_email(c, r["email"]):
                db.log(c, r["id"], "SKIP", step=step, detail="address suppressed")
                print(f"  \033[31mskip\033[0m {r['name']}: address previously opted out")
                continue

            try:
                subject, body = render(STEPS[step], cfg, r)
                guardrails.assert_can_spam_ready(body, cfg.mail_addr)
                guardrails.assert_email_sendable(body)
                guardrails.assert_no_attachments(step, None)
                if not cfg.dry_run:
                    guardrails.assert_sender_identity(cfg.from_email, cfg.from_email)
            except Exception as e:
                db.log(c, r["id"], "BLOCKED", step=step, detail=str(e))
                print(f"  \033[31mblocked\033[0m {r['name']} step {step}: {e}")
                continue

            if cfg.dry_run:
                print(f"  \033[2m┌─ WOULD SEND ─ step {step} → {r['email']} ({r['name']})\033[0m")
                print(f"  \033[2m│\033[0m Subject: {subject}")
                for ln in body.strip().splitlines():
                    print(f"  \033[2m│\033[0m {ln}")
                print(f"  \033[2m└─────────────\033[0m")
                c.execute(
                    "INSERT INTO sends (agency_id, step, to_email, subject, body, dry_run, sent_at) "
                    "VALUES (?,?,?,?,?,1,?)",
                    (r["id"], step, r["email"], subject, body, db.now_iso()),
                )
                db.log(c, r["id"], "EMAIL_DRYRUN", step=step, channel="email")
            else:
                try:
                    mid = deliver(cfg, r["email"], subject, body)
                except Exception as e:
                    db.log(c, r["id"], "SEND_FAILED", step=step, detail=str(e))
                    print(f"  \033[31mfailed\033[0m {r['name']}: {e}")
                    continue
                c.execute(
                    "INSERT INTO sends (agency_id, step, to_email, subject, body, message_id, dry_run, sent_at) "
                    "VALUES (?,?,?,?,?,?,0,?)",
                    (r["id"], step, r["email"], subject, body, mid, db.now_iso()),
                )
                db.log(c, r["id"], "EMAIL_SENT", step=step, channel="email", detail=mid)
                print(f"  \033[32msent\033[0m  step {step} → {r['email']} ({r['name']})")

            if r["state"] in ("QUEUED", "NO_REPLY", "NURTURE", "CONTACTED"):
                try:
                    db.set_state(c, r["id"], "CONTACTED")
                except ValueError:
                    pass
            c.execute("UPDATE agencies SET last_step = ?, updated_at = ? WHERE id = ?",
                      (step, db.now_iso(), r["id"]))
            done += 1

        # day-12 silence -> NURTURE
        for row in c.execute(
            "SELECT * FROM agencies WHERE state = 'CONTACTED' AND seq_started IS NOT NULL"
        ).fetchall():
            if (today - date.fromisoformat(row["seq_started"])).days >= 12:
                db.set_state(c, row["id"], "NURTURE", "12 days, no reply")

        print(f"\n  {done} processed · states: {db.counts_by_state(c)}")
        if cfg.dry_run:
            print("  \033[33mDRY_RUN=true — nothing actually left the building.\033[0m")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
