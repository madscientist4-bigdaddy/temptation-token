"""MODULE D — scheduled sender.

Refuses to send when ANY of these is true:
  * DRY_RUN is on (the default) — prints the full email instead
  * outside Mon–Fri 09:00–16:00 America/New_York
  * daily cap reached (15 week one, 25 after)
  * recipient is on the blocklist, SUPPRESSED, REPLIED, HOLD or NEEDS_REVIEW
  * copy contains an unacknowledged claim (see claims_guard.py)

Every attempt is logged to SQLite whether it sends or not.
"""
from __future__ import annotations

import argparse
import smtplib
import ssl
import time
import sys
import uuid
from datetime import date, datetime
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

import blocklist
import bridge
import claims_guard
import config
import db


def render(template_name: str, row) -> tuple[str, str]:
    """Return (subject, body) with tokens merged and footer appended."""
    raw = (config.TEMPLATES / template_name).read_text(encoding="utf-8")
    lines = raw.splitlines()
    subject = ""
    if lines and lines[0].lower().startswith("subject:"):
        subject = lines[0].split(":", 1)[1].strip()
        body = "\n".join(lines[1:]).lstrip("\n")
    else:
        body = raw
    footer = (config.TEMPLATES / "footer.txt").read_text(encoding="utf-8")
    body = body.rstrip() + "\n" + footer

    tokens = {
        "{{name}}": row["name"],
        "{{angle_line}}": row["angle_line"] or "",
        "{{CALENDLY}}": config.CALENDLY,
        "{{LOOM}}": config.LOOM,
        "{{MAIL_ADDR}}": config.MAIL_ADDR,
    }
    for k, v in tokens.items():
        subject = subject.replace(k, v)
        body = body.replace(k, v)
    return subject, body


def in_window(now: datetime | None = None) -> tuple[bool, str]:
    now = now or datetime.now(config.ET)
    if now.tzinfo is None:
        now = now.replace(tzinfo=config.ET)
    if now.weekday() not in config.SEND_DAYS:
        return False, f"{now:%A} is outside Mon–Fri"
    t = now.timetz().replace(tzinfo=None)
    if not (config.SEND_START <= t <= config.SEND_END):
        return False, f"{t:%H:%M} ET is outside {config.SEND_START:%H:%M}–{config.SEND_END:%H:%M} ET"
    return True, ""


def daily_cap() -> int:
    first = db.first_send_date()
    if first is None:
        return config.CAP_WEEK_ONE
    age = (date.today() - first).days
    return config.CAP_WEEK_ONE if age < config.WEEK_ONE_DAYS else config.CAP_AFTER


def build_message(row, subject: str, body: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr((config.FROM_NAME, config.FROM_ADDR))
    msg["To"] = row["email"]
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=config.FROM_ADDR.split("@")[-1] if "@" in config.FROM_ADDR else None)
    # One-click and mailto opt-out. Required by every mailbox provider that
    # matters, and it is the mechanism the footer promises.
    msg["List-Unsubscribe"] = f"<mailto:{config.FROM_ADDR}?subject=remove>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg["Auto-Submitted"] = "auto-generated"
    msg.set_content(body)
    return msg


def deliver(msg: EmailMessage) -> str:
    # Proton Bridge on 127.0.0.1:1025, STARTTLS with a self-signed cert — the default
    # context would reject it. bridge.loopback_tls_context() only relaxes verification
    # for loopback, so this cannot follow a config change out to a real host.
    ctx = bridge.loopback_tls_context(config.SMTP_HOST)
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=30) as s:
        s.ehlo()
        s.starttls(context=ctx)
        s.login(config.SMTP_USER, config.SMTP_PASS)
        s.send_message(msg)
    return msg["Message-ID"]


def preflight(live: bool) -> list[str]:
    """Config-level checks. Bridge reachability is checked separately in main()."""
    problems = []
    if live:
        if not config.FROM_ADDR:
            problems.append("FROM_ADDR is not set in .env")
        cred = bridge.credentials_problem()
        if cred:
            problems.append(cred)
        for label, val in (("CALENDLY", config.CALENDLY), ("MAIL_ADDR", config.MAIL_ADDR)):
            if "REPLACE-ME" in val:
                problems.append(f"{label} still contains the placeholder")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description="Send scheduled outreach emails.")
    ap.add_argument("--force-window", action="store_true", help="ignore the send window (dry-run only)")
    ap.add_argument("--limit", type=int, help="cap this run")
    args = ap.parse_args()

    db.init()
    live = not config.DRY_RUN
    mode = "LIVE" if live else "DRY-RUN"

    print(f"\n{'='*78}\n  SENDER — {mode}   ({datetime.now(config.ET):%Y-%m-%d %H:%M %Z})\n{'='*78}")

    problems = preflight(live)
    for p in problems:
        print(f"  BLOCKED: {p}")
    if live and problems:
        return 2

    # Bridge must be up before we touch a single recipient. Failing here costs one clear
    # message; failing per-send would burn through the task list producing dozens of
    # connection errors and half a sequence in an unknown state.
    if live and not bridge.preflight():
        return 4

    ok, why = in_window()
    if not ok:
        if live:
            print(f"  Outside send window ({why}). Nothing sent.")
            return 0
        if not args.force_window:
            print(f"  NOTE: outside send window ({why}); dry-run continues anyway.\n")

    cap = daily_cap()
    already = db.sends_today()
    remaining = max(0, cap - already)
    if args.limit is not None:
        remaining = min(remaining, args.limit)
    print(f"  Daily cap {cap} · already sent today {already} · slots left {remaining}\n")

    tasks = db.due_email_steps()
    if not tasks:
        print("  No email steps due.\n")
        return 0

    sent = skipped = 0
    for t in tasks:
        if sent >= remaining:
            print(f"  Cap reached — {len(tasks) - sent - skipped} task(s) deferred to tomorrow.")
            break

        row = db.get_agency(t["agency_id"])
        label = f"{row['name']} [{t['kind']}]"

        blocked, reason = blocklist.check_agency(row)
        if blocked:
            print(f"  REFUSED  {label}: {reason}")
            db.set_status(row["id"], "BLOCKED")
            db.halt_sequence(row["id"], f"blocklist: {reason}")
            db.complete_task(t["id"], "SKIPPED")
            skipped += 1
            continue

        if not row["email"]:
            print(f"  SKIP     {label}: no email (status {row['status']})")
            db.complete_task(t["id"], "SKIPPED")
            skipped += 1
            continue

        subject, body = render(config.EMAIL_STEPS[t["kind"]], row)

        if not claims_guard.gate(subject + "\n" + body, live=live, verbose=(sent + skipped == 0)):
            print(f"  BLOCKED  {label}: unacknowledged claims in copy (see above). Nothing sent.")
            return 3

        if live:
            try:
                mid = deliver(build_message(row, subject, body))
                db.record_send(row["id"], row["email"], subject, t["kind"], False, mid)
                db.complete_task(t["id"])
                print(f"  SENT     {label} -> {row['email']}")
                sent += 1
                # Polite pause. Proton throttles around 100/hour; our 15-25/day is nowhere
                # near it, but a burst of back-to-back sends is the shape rate limiters
                # look for. Sleep only between sends, never after the last one.
                if sent < remaining and config.SEND_DELAY_SECONDS > 0:
                    time.sleep(config.SEND_DELAY_SECONDS)
            except Exception as e:
                db.record_send(row["id"], row["email"], subject, t["kind"], False, None, str(e))
                print(f"  ERROR    {label}: {e}")
                skipped += 1
        else:
            db.record_send(row["id"], row["email"], subject, t["kind"], True)
            out = config.OUTBOX / f"{date.today():%Y%m%d}_{row['name'].replace(' ', '_')}_{t['kind']}.eml"
            out.write_text(f"To: {row['email']}\nSubject: {subject}\n\n{body}", encoding="utf-8")
            print(f"\n  ┌─ WOULD SEND ── {label}")
            print(f"  │ To:      {row['email']}")
            print(f"  │ Subject: {subject}")
            print("  ├" + "─" * 74)
            for ln in body.strip().splitlines():
                print(f"  │ {ln}")
            print("  └" + "─" * 74)
            print(f"    saved: {out.relative_to(config.ROOT)}")
            sent += 1

    print(f"\n  {mode}: {sent} email(s), {skipped} skipped.")
    if not live:
        print("  Nothing left this machine. Set DRY_RUN=false in .env to go live.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
