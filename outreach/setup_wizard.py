#!/usr/bin/env python3
"""
Interactive setup. Asks for every credential, explains where to get each one, then
proves the Gmail login actually works before writing anything.

    python3 setup_wizard.py            # interactive
    python3 setup_wizard.py --show     # just print the questions + how-to, ask nothing
    python3 setup_wizard.py --verify   # re-test the SMTP login in the existing .env

The SMTP check is a real login, not a syntax check. An app password that looks right but
is not enabled is the single most common way this kind of system silently sends nothing.
"""

from __future__ import annotations

import argparse
import getpass
import smtplib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV = ROOT / ".env"

Q = [
    ("FROM_EMAIL", "Your partnerships address", True,
     "The address the outreach sends from — e.g. partnerships@temptationtoken.io.\n"
     "     Use a real mailbox you can open; replies land there.\n"
     "     Do NOT use your personal address: if it gets filtered, you lose your own mail too."),
    ("GMAIL_APP_PW", "Gmail / Workspace app password (16 chars)", True,
     "Google Account -> Security -> 2-Step Verification (must be ON) -> App passwords\n"
     "     -> select 'Mail' -> Generate. Google shows 16 characters in 4 groups.\n"
     "     Paste it with or without spaces; spaces are stripped. This is NOT your\n"
     "     normal Google password, and it only works if 2-Step is already enabled."),
    ("CALENDLY_URL", "Calendly booking link", True,
     "calendly.com -> New Event Type -> One-on-One -> name it 'TTS Partnership 15 min'\n"
     "     -> set duration 15 min -> Save -> copy the public link.\n"
     "     Example: https://calendly.com/yourname/tts-partnership-15min"),
    ("LOOM_URL", "Loom walkthrough link (placeholder fine for now)", False,
     "loom.com -> record a 45-second screen walkthrough -> Copy link.\n"
     "     Leave blank for now; email #2 will refuse to send until it is set."),
    ("MAIL_ADDR", "Postal address for the legal footer", True,
     "CAN-SPAM requires a real physical mailing address in every commercial email.\n"
     "     Use a UPS Store mailbox, a virtual office, or your registered agent's address.\n"
     "     NEVER your home address or a clinic address — this goes to strangers and\n"
     "     ends up archived on the public web.\n"
     "     Format: 'Blockchain Entertainment LLC, 123 Main St #200, City, ST 00000'"),
    ("HUNTER_API_KEY", "Hunter.io API key (optional)", False,
     "Optional email enrichment. hunter.io -> sign up (free tier = 25 searches/mo)\n"
     "     -> Dashboard -> API -> copy key. Press Enter to skip; the harvester works\n"
     "     fine without it."),
    ("TTS_API_URL", "Read-only standings endpoint (optional)", False,
     "A READ-ONLY URL returning current leaderboard standings as JSON.\n"
     "     Press Enter to skip and the promo tools will read data/standings.json instead."),
    ("TTS_API_KEY", "API key for that endpoint (optional)", False,
     "Only if the endpoint above needs auth. Press Enter to skip."),
    ("ONEPAGER_URL", "Public one-pager link", False,
     "A public page describing the partnership. Linked (never attached) in emails.\n"
     "     Default: https://temptationtoken.io/partners"),
]


def show() -> None:
    print("\n\033[1mSETUP — what you'll be asked for\033[0m\n")
    for key, label, required, how in Q:
        tag = "\033[31mrequired\033[0m" if required else "\033[2moptional\033[0m"
        print(f"  \033[1m{key}\033[0m — {label}  [{tag}]")
        print(f"     {how}\n")
    print("Then: a REAL SMTP login to smtp.gmail.com:587 to prove the credentials work.\n")


def read_existing() -> dict[str, str]:
    if not ENV.exists():
        return {}
    out = {}
    for line in ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            out[k.strip()] = v.strip()
    return out


def verify_smtp(user: str, pw: str) -> tuple[bool, str]:
    """Real login. Returns (ok, human-readable message)."""
    pw = (pw or "").replace(" ", "")
    if not user or not pw:
        return False, "FROM_EMAIL or GMAIL_APP_PW empty"
    if len(pw) != 16:
        return False, (f"app password is {len(pw)} chars, expected 16 — you may have pasted "
                       "your normal Google password instead of an app password")
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as s:
            s.starttls()
            s.login(user, pw)
        return True, "SMTP login OK — Gmail accepted the app password"
    except smtplib.SMTPAuthenticationError as e:
        return False, (f"Gmail REJECTED the credentials ({e.smtp_code}). Usual causes: "
                       "2-Step Verification is off, the app password was revoked, or the "
                       "address is not the mailbox the password belongs to.")
    except Exception as e:  # network, DNS, TLS
        return False, f"could not reach smtp.gmail.com: {e}"


def write_env(vals: dict[str, str]) -> None:
    lines = [
        "# Temptation Token — B2B outreach configuration.",
        "# Written by setup_wizard.py. NEVER commit this file (outreach/.gitignore blocks it).",
        "",
    ]
    for key, label, _r, _h in Q:
        lines.append(f"# {label}")
        lines.append(f"{key}={vals.get(key,'')}")
    lines += [
        "",
        "# ── THE LIVE SWITCH ────────────────────────────────────────────────────────",
        "# TRUE  = print every email it would send, send nothing (default, and the",
        "#         default on any parse failure or missing value).",
        "# false = actually deliver. Change this one word when you are ready.",
        "DRY_RUN=true",
        "",
    ]
    ENV.write_text("\n".join(lines) + "\n", encoding="utf-8")
    ENV.chmod(0o600)  # contains an app password


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--show", action="store_true", help="print questions and exit")
    ap.add_argument("--verify", action="store_true", help="re-test SMTP from existing .env")
    a = ap.parse_args()

    if a.show:
        show()
        return 0

    existing = read_existing()

    if a.verify:
        ok, msg = verify_smtp(existing.get("FROM_EMAIL", ""), existing.get("GMAIL_APP_PW", ""))
        print(("\033[32m✓ \033[0m" if ok else "\033[31m✗ \033[0m") + msg)
        return 0 if ok else 1

    if not sys.stdin.isatty():
        print("setup_wizard needs an interactive terminal. Run it directly:")
        print("    cd outreach && python3 setup_wizard.py")
        print("\nQuestions it will ask:")
        show()
        return 2

    print("\n\033[1mTemptation Token — outreach setup\033[0m")
    print("Enter to keep the current value shown in [brackets].\n")

    vals: dict[str, str] = {}
    for key, label, required, how in Q:
        cur = existing.get(key, "")
        print(f"\033[1m{label}\033[0m ({key})")
        for ln in how.split("\n"):
            print(f"  \033[2m{ln}\033[0m")
        shown = f" [{'*' * 8 if 'PW' in key or 'KEY' in key else cur}]" if cur else ""
        while True:
            raw = (getpass.getpass(f"  > {key}{shown}: ") if ("PW" in key or "KEY" in key)
                   else input(f"  > {key}{shown}: ")).strip()
            val = raw or cur
            if required and not val:
                print("  \033[31mrequired — please enter a value\033[0m")
                continue
            vals[key] = val
            break
        print()

    print("Testing the Gmail login for real…")
    ok, msg = verify_smtp(vals.get("FROM_EMAIL", ""), vals.get("GMAIL_APP_PW", ""))
    print(("  \033[32m✓ \033[0m" if ok else "  \033[31m✗ \033[0m") + msg)
    if not ok:
        # Refuse to write credentials we have proven do not work — a saved bad password
        # produces a system that looks configured and silently delivers nothing.
        print("\n\033[31mNot writing .env.\033[0m Fix the credential and re-run.")
        return 1

    write_env(vals)
    print(f"\n\033[32mWrote {ENV}\033[0m (chmod 600, gitignored)")
    print("DRY_RUN=true — nothing will actually send until you change it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
