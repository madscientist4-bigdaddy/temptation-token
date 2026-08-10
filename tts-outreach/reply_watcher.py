"""MODULE E — inbound reply watcher.

Polls IMAP, matches senders to target domains, halts that target's sequence,
raises a macOS notification, and drafts a suggested reply.

Opt-out is handled first and unconditionally: anything that looks like a
removal request suppresses the target permanently and queues a one-line
confirmation. That path is never overridden by a later intent match.
"""
from __future__ import annotations

import argparse
import email
import imaplib
import re
import subprocess
import sys
from datetime import datetime
from email.header import decode_header, make_header

import bridge
import config
import db

OPT_OUT = re.compile(
    r"\b(remove|unsubscribe|opt[\s-]?out|stop\s+(?:emailing|contacting)|take me off|"
    r"not interested|no thanks|no thank you|do not contact|don'?t contact)\b", re.I)

INTENTS = [
    ("OPT_OUT", OPT_OUT),
    ("PRICING", re.compile(r"\b(cost|price|pricing|fee|commission|rev[\s-]?share|split|how much|"
                           r"what.s the catch|percentage|%)\b", re.I)),
    ("YES", re.compile(r"\b(let'?s do it|sounds good|we'?re in|interested in moving|"
                       r"next steps?|send (?:the )?(?:contract|agreement|paperwork)|sign)\b", re.I)),
    ("MEETING", re.compile(r"\b(call|meet|zoom|calendar|schedule|book|availability|times?)\b", re.I)),
    ("INTERESTED", re.compile(r"\b(tell me more|more info|one[\s-]?pager|details|interested|"
                              r"send (?:me )?(?:info|the deck)|curious)\b", re.I)),
]

DRAFTS = {
    "INTERESTED": """Subject: Re: {subject}

Hi {who},

Happy to. Short version: fans buy votes for a creator; the creator's share is paid out
weekly, and every profile page links back to her own properties so the traffic is yours,
not ours. No posting on OnlyFans itself — the creator posts twice a week on IG/X using a
kit we supply.

I'll send the one-pager right after this. If it's easier to just talk, these work on my
side this week:
  • Tue 10:00–12:00 ET
  • Wed 13:00–16:00 ET
  • Thu 09:00–11:00 ET
Or grab any slot directly: {calendly}

Jim
""",
    "PRICING": """Subject: Re: {subject}

Hi {who},

Straight answer, because I'd rather you evaluate this properly than be sold to:

  • No fee to you, and no cost to your creators. You are not buying anything.
  • The creator's share of each vote is paid out weekly.
  • Your agency's cut sits on top of that and is what we'd agree in writing.
  • The launch pool is funded by us, not by your roster.

Our incentives only line up if your creators actually earn, so the deal is structured to
pay on performance rather than on signing.

I'll put exact numbers in writing before anything is agreed — including what is paid
on-chain versus what we fund directly, so there's no ambiguity about where the money
comes from.

{calendly}

Jim
""",
    "YES": """Subject: Re: {subject} — next steps

Hi {who},

Great. Here's the sequence so nothing gets done out of order:

  1. Partnership agreement — revenue share, term, termination.
  2. Likeness/content licence for each participating creator, signed by the creator
     herself, covering use of her images on game profile pages.
  3. Written consent + age/ID verification per creator (we already run KYC; this
     documents it on your side too).
  4. FTC disclosure rider — creators' promo posts carry #ad, and we supply the exact
     wording.
  5. Payout details and the weekly reporting format.

Our attorney prepares 1–4; your counsel should review before any creator is onboarded.
I'd rather move a week slower and have this clean.

What's the best address for the documents?

{calendly}

Jim
""",
    "MEETING": """Subject: Re: {subject}

Hi {who},

Yes — easiest is to grab whatever suits: {calendly}

If none of those work, send me two or three windows in your timezone and I'll make one
of them work.

Jim
""",
    "OPT_OUT": """Subject: Re: {subject}

Removed — you won't hear from me again. Thanks for the reply, and good luck with the
roster.

Jim
""",
}


def notify(title: str, message: str) -> None:
    try:
        subprocess.run(
            ["osascript", "-e",
             f'display notification {message!r} with title {title!r} sound name "Glass"'],
            check=False, capture_output=True, timeout=5)
    except Exception:
        pass


def decode(val) -> str:
    if not val:
        return ""
    try:
        return str(make_header(decode_header(val)))
    except Exception:
        return str(val)


def body_text(msg) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                try:
                    return part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "replace")
                except Exception:
                    continue
        return ""
    try:
        return msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", "replace")
    except Exception:
        return str(msg.get_payload())


def classify(text: str) -> str:
    for name, rx in INTENTS:
        if rx.search(text):
            return name
    return "UNKNOWN"


def match_agency(from_addr: str):
    dom = from_addr.split("@")[-1].strip(">").lower()
    if not dom:
        return None
    for row in db.all_agencies():
        adom = (row["domain"] or "").lower().replace("www.", "")
        if adom and (dom == adom or dom.endswith("." + adom)):
            return row
        if row["email"] and row["email"].lower() == from_addr.lower():
            return row
    return None


def write_draft(row, intent: str, subject: str, from_addr: str, snippet: str) -> str:
    who = from_addr.split("@")[0].split(".")[0].title() or row["name"]
    tmpl = DRAFTS.get(intent)
    path = config.DRAFTS / f"{row['name'].replace(' ', '_')}.txt"
    if tmpl:
        content = tmpl.format(who=who, subject=subject, calendly=config.CALENDLY)
    else:
        content = (f"Subject: Re: {subject}\n\nHi {who},\n\n"
                   f"[intent unclear — read their message and answer directly]\n\n"
                   f"Their message:\n{snippet}\n\nJim\n")
    header = (f"# {row['name']} · intent={intent} · from={from_addr}\n"
              f"# received {datetime.now():%Y-%m-%d %H:%M}\n"
              f"# ---- their message ----\n"
              + "".join(f"# {ln}\n" for ln in snippet.splitlines()[:15])
              + "# ---- suggested reply ----\n\n")
    path.write_text(header + content, encoding="utf-8")
    return str(path)


def poll(folder: str = "INBOX", limit: int = 50) -> int:
    cred = bridge.credentials_problem()
    if cred:
        print(f"Cannot poll: {cred}")
        return 1

    # Same hard gate as the sender. A watcher that quietly returns "0 replies" because
    # Bridge is closed is worse than one that fails — you would carry on sending follow-ups
    # to people who had already replied.
    if not bridge.preflight(verbose=False):
        return 4

    db.init()
    handled = 0
    # Bridge speaks IMAP on 1143 with STARTTLS, not implicit TLS on 993 — IMAP4_SSL would
    # hang trying to negotiate TLS against a plaintext greeting.
    with imaplib.IMAP4(config.IMAP_HOST, config.IMAP_PORT) as M:
        M.starttls(ssl_context=bridge.loopback_tls_context(config.IMAP_HOST))
        M.login(config.SMTP_USER or config.FROM_ADDR, config.SMTP_PASS)
        M.select(folder)
        typ, data = M.search(None, "UNSEEN")
        if typ != "OK":
            return 1
        uids = data[0].split()[-limit:]
        for uid in uids:
            typ, raw = M.fetch(uid, "(RFC822)")
            if typ != "OK" or not raw or not raw[0]:
                continue
            msg = email.message_from_bytes(raw[0][1])
            from_addr = email.utils.parseaddr(decode(msg.get("From")))[1].lower()
            subject = decode(msg.get("Subject"))
            text = body_text(msg)
            row = match_agency(from_addr)
            if not row:
                continue

            snippet = "\n".join(text.strip().splitlines()[:20])[:1200]
            intent = classify(subject + "\n" + text)

            with db.conn() as c:
                c.execute("""INSERT OR IGNORE INTO replies(agency_id,from_addr,subject,snippet,intent,ts,uid)
                             VALUES(?,?,?,?,?,?,?)""",
                          (row["id"], from_addr, subject, snippet, intent,
                           datetime.now().isoformat(timespec="seconds"), uid.decode()))

            if intent == "OPT_OUT":
                db.set_status(row["id"], "SUPPRESSED")
                db.halt_sequence(row["id"], "opt-out received")
                notify("Outreach: opt-out", f"{row['name']} asked to be removed")
                print(f"  SUPPRESSED  {row['name']} ({from_addr}) — opt-out")
            else:
                db.set_status(row["id"], "REPLIED")
                db.halt_sequence(row["id"], f"reply received ({intent})")
                notify(f"Reply: {row['name']}", f"{intent.title()} — {subject[:60]}")
                print(f"  REPLIED     {row['name']} ({from_addr}) — {intent}")

            path = write_draft(row, intent, subject, from_addr, snippet)
            print(f"              draft -> {path}")
            handled += 1
    print(f"\n  {handled} reply/replies processed.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Poll IMAP for replies from target domains.")
    ap.add_argument("--folder", default="INBOX")
    ap.add_argument("--self-test", action="store_true", help="exercise classifier + drafts, no network")
    args = ap.parse_args()

    if args.self_test:
        db.init()
        cases = [
            ("please remove me from your list", "OPT_OUT"),
            ("what's the commission split?", "PRICING"),
            ("Sounds good, let's do it - send the contract", "YES"),
            ("can we set up a call next week?", "MEETING"),
            ("tell me more, send the one-pager", "INTERESTED"),
            ("who is this", "UNKNOWN"),
        ]
        print("  classifier self-test:")
        bad = 0
        for text, expect in cases:
            got = classify(text)
            ok = got == expect
            bad += (not ok)
            print(f"    {'ok  ' if ok else 'FAIL'} {expect:<11} got {got:<11} {text!r}")
        return 1 if bad else 0

    return poll(args.folder)


if __name__ == "__main__":
    sys.exit(main())
