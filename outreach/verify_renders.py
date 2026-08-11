#!/usr/bin/env python3
"""
Pre-flight render verification.

Renders the ACTUAL outbound email for every contact due in a given window using the
sender's own render() and the mailer's own build() — not a reimplementation — then
asserts six things about each one. Any failure disarms the campaign (DRY_RUN=true) and
refuses to re-arm.

    python3 verify_renders.py --date 2026-08-12
    python3 verify_renders.py --date 2026-08-12 --no-network   # skip link checks

Exit 0 = every render clean and the campaign left as it was found.
Exit 1 = something failed; DRY_RUN has been forced to true.
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import mailer  # noqa: E402
import sender  # noqa: E402
from tts_outreach import config, db, guardrails  # noqa: E402

EXPECTED_FROM = "jim@temptationtoken.io"

# (a) Forbidden claims. Each is a lesson already learned the hard way; a regression here
#     puts a false financial statement in a stranger's inbox, so they are hard failures.
FORBIDDEN = [
    (r"\$\s?\d[\d,]*", "dollar amount"),
    (r"keeps?\s+50\s*%|50\s*%\s+of\s+every", "'keep 50%' claim"),
    (r"weekly\s+in\s+USDC|paid\s+weekly", "'weekly in USDC' / weekly-payment claim"),
    # Affirmative guarantees only. "rather than a guaranteed monthly figure" is the
    # copy DENYING a guarantee — the single most important honest sentence in the
    # pitch — and a bare \bguarantee\w*\b flagged all 14 renders for saying it.
    # Negative lookbehind for the denial forms; everything else still fails.
    (r"(?<!not a )(?<!rather than a )(?<!no )(?<!never a )\bguarantee(s|d|ing)?\b(?! monthly figure)",
     "affirmative guarantee"),
    (r"\bpassive\s+income\b", "passive income"),
    (r"\b\d+\s*x\b", "multiple claim (10x)"),
    (r"\b\d+\s*%\s*(apy|apr|returns?|profit)", "yield claim"),
    (r"\bmarket\s*cap\b", "market cap"),
    (r"\bfunded\s+(prize\s+)?pool\b", "'funded pool' claim"),
    (r"\bearn\s+up\s+to\b", "'earn up to'"),
]

# (b) The truth that must be present, on the FIRST touch specifically.
REQUIRED_STEP1 = [
    (r"\b35\s*%", "35% share"),
    (r"\b10\s*%", "10% charity"),
    (r"\b20\s*%", "20% house"),
    (r"\bburn(ed|s)?\b", "the burn named"),
]

URL_RE = re.compile(r"https?://[^\s<>\"'\)\],]+")
MERGE_RE = re.compile(r"\{\{[^}]*\}\}|\{[A-Za-z_]+\}")

RED, GRN, YEL, DIM, OFF = "\033[31m", "\033[32m", "\033[33m", "\033[2m", "\033[0m"


def disarm(reason: str) -> None:
    """Force DRY_RUN=true in .env. Idempotent, and never silently."""
    p = ROOT / ".env"
    txt = p.read_text(encoding="utf-8")
    new = re.sub(r"(?m)^DRY_RUN=.*$", "DRY_RUN=true", txt)
    if new == txt and "DRY_RUN=" not in txt:
        new = txt.rstrip("\n") + "\nDRY_RUN=true\n"
    p.write_text(new, encoding="utf-8")
    print(f"\n{RED}*** DISARMED — DRY_RUN=true written to .env ***{OFF}\n    {reason}")


def check_url(url: str, cache: dict) -> tuple[bool, str]:
    if url in cache:
        return cache[url]
    try:
        import requests

        r = requests.get(url, timeout=15, allow_redirects=True,
                         headers={"User-Agent": "Mozilla/5.0 (compatible; TTS-preflight)"})
        ok = r.status_code == 200
        res = (ok, f"HTTP {r.status_code}")
    except Exception as e:
        res = (False, f"{type(e).__name__}")
    cache[url] = res
    return res


def due_on(target: date) -> list[tuple[dict, int]]:
    """Exactly what sender.due_emails() would pick up on `target`."""
    with db.connect() as c:
        return sender.due_emails(c, target)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", required=True, help="YYYY-MM-DD window to verify")
    ap.add_argument("--no-network", action="store_true")
    a = ap.parse_args()

    target = date.fromisoformat(a.date)
    cfg = config.load()
    db.init()

    print(f"\n\033[1mRENDER VERIFICATION — window {target:%A %d %B %Y}\033[0m")
    print(f"  DRY_RUN={cfg.dry_run}  transport={mailer.transport()}  "
          f"from={mailer.from_address(cfg)}")

    win, why = guardrails.in_send_window(
        __import__("datetime").datetime.combine(
            target, __import__("datetime").time(9, 5), tzinfo=guardrails.SEND_TZ))
    print(f"  send window: {why}")

    pending = due_on(target)
    if not pending:
        print(f"\n  {YEL}nothing due on {target}{OFF} — nothing to verify.\n")
        return 0

    print(f"  {len(pending)} email(s) due\n")

    url_cache: dict = {}
    failures: list[str] = []
    samples: list[tuple[str, str, str]] = []

    for row, step in pending:
        name = row.get("name", "?")
        label = f"{name} (step {step})"
        errs: list[str] = []

        # THE REAL RENDER — sender's own function, same as a live send.
        try:
            subject, body = sender.render(sender.STEPS[step], cfg, row)
        except Exception as e:
            failures.append(f"{label}: render raised {type(e).__name__}: {e}")
            print(f"  {RED}FAIL{OFF} {label}: render raised {e}")
            continue

        # And the real MIME envelope, so From/headers are what actually ships.
        msg = mailer.build(cfg, row["email"], subject, body)
        full = f"{subject}\n{body}"

        # (a) forbidden claims
        for pat, what in FORBIDDEN:
            m = re.search(pat, full, re.I)
            if m:
                errs.append(f"(a) forbidden {what}: {m.group(0)!r}")

        # (b) the truth, on first touch
        if step == 1:
            for pat, what in REQUIRED_STEP1:
                if not re.search(pat, full, re.I):
                    errs.append(f"(b) missing {what}")

        # (c) links resolve
        urls = sorted(set(URL_RE.findall(full)))
        if not a.no_network:
            for u in urls:
                ok, detail = check_url(u, url_cache)
                if not ok:
                    errs.append(f"(c) link {u} -> {detail}")
        if not urls:
            errs.append("(c) no links at all — CTA missing")

        # (d) From identity
        frm = str(msg.get("From", ""))
        if EXPECTED_FROM.lower() not in frm.lower():
            errs.append(f"(d) From={frm!r}, expected {EXPECTED_FROM}")

        # (e) CAN-SPAM
        try:
            guardrails.assert_can_spam_ready(body, cfg.mail_addr)
        except Exception as e:
            errs.append(f"(e) CAN-SPAM: {e}")
        if not msg.get("List-Unsubscribe"):
            errs.append("(e) List-Unsubscribe header missing")

        # (f) merge fields resolved + recipient name actually rendered
        leftover = MERGE_RE.findall(full)
        if leftover:
            errs.append(f"(f) unresolved merge field(s): {leftover[:3]}")
        if not name or name.strip() in ("", "?"):
            errs.append("(f) agency name blank")
        elif name not in body:
            errs.append(f"(f) agency name {name!r} does not appear in the body")
        if re.search(r"Hi\s+(team|,|\s*$)", body):
            errs.append("(f) greeting rendered without a name")

        if errs:
            failures.extend(f"{label}: {e}" for e in errs)
            print(f"  {RED}FAIL{OFF} {label}")
            for e in errs:
                print(f"         {e}")
        else:
            print(f"  {GRN}PASS{OFF} {label}  -> {row['email']}  "
                  f"{DIM}({len(urls)} link(s) 200){OFF}")
            samples.append((name, subject, body))

    print()
    if failures:
        disarm(f"{len(failures)} assertion failure(s) across {len(pending)} render(s)")
        print(f"{RED}{len(failures)} FAILURE(S){OFF} — campaign disarmed, NOT re-armed.")
        return 1

    print(f"{GRN}All {len(pending)} render(s) passed every assertion.{OFF}")
    print(f"  DRY_RUN left as found: {config.load().dry_run}")

    if samples:
        n, s, b = samples[0]
        print(f"\n{'='*72}\nSAMPLE — {n}\n{'='*72}")
        print(f"From: {mailer.from_address(cfg)}")
        print(f"Subject: {s}\n")
        print(b)
        print("=" * 72)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
