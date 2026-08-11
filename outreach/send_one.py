#!/usr/bin/env python3
"""
Send ONE correspondence email over the same Proton Bridge transport the campaign uses.

For the one-offs — Blockaid, SolidProof, a lawyer, a reply to a person. Deliberately NOT
the campaign path:

  * no marketing footer, no List-Unsubscribe, no CAN-SPAM opt-out line. Those belong on
    bulk commercial mail; bolting them onto a reply to your own attorney is wrong and
    reads as automated.
  * no schedule, no state machine, no daily cap, no send-window gate. This is you
    writing to one person.
  * it DOES honour the suppression list, because someone who asked never to hear from
    us again should not receive a "one-off" either.
  * it does NOT honour DRY_RUN by default — you invoked it deliberately with a
    recipient. Pass --dry-run to preview.

    make send-one TO=x@y.com SUBJECT="Re: #1263614" BODY=outputs/listings/note.txt
    python3 send_one.py --to x@y.com --subject "..." --body-file note.txt --dry-run
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import mailer  # noqa: E402
from tts_outreach import config, db, guardrails  # noqa: E402

ADDR_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


def extract_subject(body: str) -> tuple[str, str]:
    """Allow the body file to carry its own `Subject:` first line."""
    lines = body.splitlines()
    if lines and lines[0].lower().startswith("subject:"):
        return lines[0].split(":", 1)[1].strip(), "\n".join(lines[1:]).lstrip("\n")
    return "", body


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--to", required=True)
    ap.add_argument("--subject", default="")
    ap.add_argument("--body-file", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    cfg = config.load()

    if not ADDR_RE.match(a.to.strip()):
        print(f"\033[31m✗\033[0m not a valid address: {a.to!r}")
        return 1

    bf = Path(a.body_file)
    if not bf.is_absolute():
        bf = (Path.cwd() / bf) if (Path.cwd() / bf).exists() else (ROOT / bf)
    if not bf.exists():
        print(f"\033[31m✗\033[0m body file not found: {bf}")
        return 1

    body = bf.read_text(encoding="utf-8")
    embedded, body = extract_subject(body)
    subject = a.subject or embedded
    if not subject:
        print("\033[31m✗\033[0m no subject (pass SUBJECT= or put 'Subject: ...' on line 1)")
        return 1
    if not body.strip():
        print("\033[31m✗\033[0m body file is empty")
        return 1

    # Suppression still applies. A one-off to someone who opted out is still contact.
    db.init()
    with db.connect() as c:
        if db.is_suppressed_email(c, a.to):
            print(f"\033[31m✗ REFUSED\033[0m {a.to} is on the suppression list "
                  f"(they asked not to be contacted).")
            return 1

    # Token speculation is banned everywhere, including private correspondence.
    try:
        guardrails.assert_email_sendable(body)
    except Exception as e:
        print(f"\033[31m✗ REFUSED\033[0m {e}")
        return 1

    transport = mailer.transport()
    sender_addr = mailer.from_address(cfg)
    if transport == "none":
        print("\033[31m✗\033[0m no mail transport configured — run `make setup`")
        return 1

    up, detail = mailer.check()
    if not up:
        print("\033[31m✗\033[0m transport is down:")
        for ln in detail:
            print(f"    {ln}")
        print("    → open Proton Mail Bridge and leave it running.")
        return 1

    print(f"\n\033[1mSEND ONE\033[0m  ({transport})")
    print(f"  From:    {sender_addr}")
    print(f"  To:      {a.to}")
    print(f"  Subject: {subject}")
    print(f"  Body:    {bf}  ({len(body)} chars, {len(body.splitlines())} lines)")
    print(f"  Footer:  none — correspondence, not marketing\n")

    if a.dry_run:
        print("\033[33mDRY RUN — not sent.\033[0m Body follows:\n")
        print("─" * 70)
        print(body.rstrip())
        print("─" * 70)
        return 0

    try:
        # unsubscribe=False keeps the marketing headers/footer off a personal email.
        mid = mailer.deliver(cfg, a.to, subject, body, unsubscribe=False)
    except TypeError:
        mid = mailer.deliver(cfg, a.to, subject, body)
    except Exception as e:
        print(f"\033[31m✗ send failed:\033[0m {e}")
        return 1

    print(f"\033[32m✓ sent\033[0m  message-id {mid}")
    with db.connect() as c:
        db.set_meta(c, "last_send_one", f"{a.to} :: {subject}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
