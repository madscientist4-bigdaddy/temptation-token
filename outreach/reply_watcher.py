#!/usr/bin/env python3
"""
IMAP reply watcher. Poll, classify, halt, notify, draft.

A reply does four things immediately: the target's sequence STOPS (nobody gets a
follow-up after they have answered), a macOS notification fires, a suggested reply is
written to drafts/<agency>.txt, and the reply is queued unhandled in SQLite — which is
what becomes the red badge on the dashboard's Outreach tab. Two notifications on
purpose: the banner is easy to miss, the badge is what makes a reply impossible to lose.

Opt-outs are the exception — those also suppress permanently and get an automatic
one-line confirmation, because a human forgetting to confirm is a CAN-SPAM problem.

    python3 reply_watcher.py            # one poll
    python3 reply_watcher.py --loop     # every 30 min
"""

from __future__ import annotations

import argparse
import email
import imaplib
import re
import subprocess
import sys
import time
from email.header import decode_header, make_header
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tts_outreach import config, db, guardrails  # noqa: E402

POLL_SECONDS = 30 * 60


def notify(title: str, msg: str) -> None:
    """macOS banner. Never fatal — a missing notifier must not lose the reply."""
    try:
        safe_t = title.replace('"', "'")
        safe_m = msg.replace('"', "'")
        subprocess.run(
            ["osascript", "-e",
             f'display notification "{safe_m}" with title "{safe_t}" sound name "Glass"'],
            check=False, capture_output=True, timeout=10,
        )
    except Exception:
        pass


def body_text(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                try:
                    return part.get_payload(decode=True).decode(
                        part.get_content_charset() or "utf-8", "replace")
                except Exception:
                    continue
        return ""
    try:
        return msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", "replace")
    except Exception:
        return str(msg.get_payload())


RE_PREFIX = re.compile(r"^(?:\s*re\s*:\s*)+", re.I)


def reply_subject(subject: str) -> str:
    """`Re:` exactly once, however many the thread already carried."""
    base = RE_PREFIX.sub("", (subject or "").strip()) or "your message"
    return f"Re: {base}"


def split_draft(draft: str, fallback_subject: str) -> tuple[str, str]:
    """Drafts are authored as a whole email (`Subject:` line then body). The dashboard
    needs the two halves separately: subject in an input, body in the editable box."""
    lines = (draft or "").splitlines()
    if lines and lines[0].lower().startswith("subject:"):
        return reply_subject(lines[0].split(":", 1)[1]), "\n".join(lines[1:]).lstrip("\n")
    return reply_subject(fallback_subject), draft


def classify(text: str) -> str:
    """opt_out | interested | pricing | yes | unclear — cheapest signal that works."""
    t = text.lower()
    if guardrails.is_optout(t):
        return "opt_out"
    if re.search(r"\b(let'?s do it|we'?re in|sounds good|happy to (?:move|proceed)|sign me up|count us in)\b", t):
        return "yes"
    if re.search(r"\b(what'?s the catch|how do you (?:make|earn)|cost|fee|pricing|commission|cut|% ?)\b", t):
        return "pricing"
    if re.search(r"\b(interested|tell me more|more info|one[- ]pager|call|meet|schedule|available)\b", t):
        return "interested"
    return "unclear"


def draft_for(kind: str, agency: str, cfg: config.Config) -> str:
    cal = cfg.calendly_url or "[CALENDLY_URL not set]"
    one = cfg.onepager_url
    if kind == "interested":
        return (f"Subject: Re: Temptation Token — {agency}\n\n"
                f"Great — here's the one-pager: {one}\n\n"
                "Two slots that work on my side this week:\n"
                "  • Tue 11:00 ET\n  • Thu 14:00 ET\n\n"
                f"Or grab any time that suits you: {cal}\n\nJim")
    if kind == "pricing":
        return (f"Subject: Re: Temptation Token — {agency}\n\n"
                "Fair question, and the honest answer is that the incentives line up: we earn "
                "when fans buy the same votes your creators earn on. There is no fee to you and "
                "no cost to your creators — they keep 50% of every vote, paid weekly in USDC.\n\n"
                "The only catch worth naming: the launch cohort is 5 agency slots, so it is "
                "first come.\n\n"
                f"One-pager: {one}\nBook 15 min: {cal}\n\nJim")
    if kind == "yes":
        return (f"Subject: Re: Temptation Token — {agency}\n\n"
                "Excellent. Next steps, in order:\n\n"
                f"1. {guardrails.YES_PATH_GATE}\n"
                "2. You pick 3–5 creators you want in the launch cohort.\n"
                "3. We load their profiles and send the contestant kit (captions, links, "
                "posting calendar).\n\n"
                f"I'll send the rider over today. Anything you want changed in it, say so — "
                f"it goes to your counsel before mine signs.\n\nJim")
    return (f"Subject: Re: Temptation Token — {agency}\n\n"
            "[Reply unclear — read the message and answer manually.]\n\n"
            f"One-pager: {one}\nBook 15 min: {cal}\n\nJim")


def send_optout_ack(cfg: config.Config, to: str) -> bool:
    if cfg.dry_run:
        print(f"    \033[2m[dry-run] would confirm removal to {to}\033[0m")
        return True
    import smtplib
    from email.message import EmailMessage

    m = EmailMessage()
    m["From"] = cfg.from_email
    m["To"] = to
    m["Subject"] = "Removed"
    m.set_content("Done — you're removed and won't hear from me again.\n\n"
                  f"Blockchain Entertainment LLC · {cfg.mail_addr}\n")
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as s:
            s.starttls()
            s.login(cfg.from_email, cfg.gmail_app_pw)
            s.send_message(m)
        return True
    except Exception as e:
        print(f"    \033[31mopt-out ack failed:\033[0m {e}")
        return False


def poll_once(cfg: config.Config) -> int:
    if not cfg.from_email or not cfg.gmail_app_pw:
        print("  IMAP not configured (run setup_wizard.py) — skipping poll")
        return 0

    domains: dict[str, dict] = {}
    with db.connect() as c:
        for r in c.execute("SELECT * FROM agencies").fetchall():
            d = (r["domain"] or "").lower().replace("www.", "")
            if d:
                domains[d] = dict(r)
            if r["email"]:
                domains[r["email"].lower().partition("@")[2]] = dict(r)

    hits = 0
    try:
        M = imaplib.IMAP4_SSL("imap.gmail.com")
        M.login(cfg.from_email, cfg.gmail_app_pw)
        M.select("INBOX")
        typ, data = M.search(None, "UNSEEN")
        for num in (data[0].split() if data and data[0] else []):
            typ, msgdata = M.fetch(num, "(RFC822)")
            if typ != "OK":
                continue
            msg = email.message_from_bytes(msgdata[0][1])
            frm = str(make_header(decode_header(msg.get("From", ""))))
            addr = re.search(r"[\w.+-]+@[\w.-]+", frm)
            if not addr:
                continue
            sender = addr.group(0).lower()
            sdom = sender.partition("@")[2]
            target = domains.get(sdom)
            if not target:
                continue

            text = body_text(msg)
            subject = str(make_header(decode_header(msg.get("Subject", ""))))
            kind = classify(text)
            # Message-ID is stable across polls and across folders; the IMAP sequence
            # number is not, so it is the wrong idempotency key.
            uid = (msg.get("Message-ID") or f"{sender}:{num.decode()}").strip()
            draft_subject, draft_body = split_draft(
                draft_for(kind, target["name"], cfg), subject)
            hits += 1
            print(f"  \033[32mREPLY\033[0m {target['name']} <{sender}> → {kind}")

            with db.connect() as c:
                # The queued row IS the unread counter — the dashboard badge counts
                # replies with handled=0. Storing the reply and raising the badge are
                # therefore one atomic act that cannot half-happen. `new` is False when
                # this message was already recorded, which stops a re-poll from
                # notifying twice.
                new = db.record_reply(
                    c, target["id"], sender, subject, text.strip()[:20000], kind, uid,
                    draft=draft_body, draft_subject=draft_subject)
                db.log(c, target["id"], "REPLY", channel="email",
                       detail=f"{kind} from {sender}")
                if kind == "opt_out":
                    db.suppress(c, target["id"], sender, "replied remove/stop")
                    send_optout_ack(cfg, sender)
                    if new:
                        notify("Outreach — opt-out", f"{target['name']} removed permanently")
                else:
                    try:
                        db.set_state(c, target["id"], "REPLIED", kind)
                    except ValueError:
                        pass
                    # Halting the sequence IS the state change: due_emails() skips REPLIED.
                    if new:
                        # Banner now; red badge whenever the dashboard is next opened.
                        notify("New reply", f"{target['name']} — open dashboard")
                unread = db.unread_count(c)

            if kind != "opt_out":
                p = config.DRAFTS_DIR / f"{target['name'].replace('/', '-')}.txt"
                p.write_text(
                    f"# Reply from {sender} classified as: {kind}\n"
                    f"# --- their message ---\n"
                    + "\n".join("# " + l for l in text.strip().splitlines()[:25])
                    + "\n\n" + draft_for(kind, target["name"], cfg) + "\n",
                    encoding="utf-8",
                )
                print(f"        draft → {p.relative_to(config.ROOT)}  ·  {unread} unread")
        M.close()
        M.logout()
    except imaplib.IMAP4.error as e:
        print(f"  \033[31mIMAP error:\033[0m {e}")
    except Exception as e:
        print(f"  \033[31mwatcher error:\033[0m {e}")
    return hits


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--loop", action="store_true")
    a = ap.parse_args()
    cfg = config.load()
    db.init()
    while True:
        n = poll_once(cfg)
        with db.connect() as c:
            unread = db.unread_count(c)
        print(f"  poll complete · {n} new replies · {unread} awaiting you "
              f"(dashboard → Operations → Outreach)")
        if not a.loop:
            return 0
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    raise SystemExit(main())
