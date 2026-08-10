#!/usr/bin/env python3
"""
Per-agency UTM codes, signup attribution, and the auto-drafted "your creators just got
paid — want to scale?" email.

The draft is written to drafts/, never sent: an expansion email quoting payout numbers
should be read by a human before it goes out.

    python3 promo/referral_tracker.py --assign          # mint UTM codes
    python3 promo/referral_tracker.py --record AROA 12  # log 12 signups
    python3 promo/referral_tracker.py --check           # draft for anyone over threshold
"""
from __future__ import annotations

import argparse, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tts_outreach import config, db, guardrails  # noqa: E402

THRESHOLD = 5          # signups before we ask about scaling
BASE = "https://app.temptationtoken.io"

SCHEMA = """
CREATE TABLE IF NOT EXISTS referrals (
  agency_id  INTEGER PRIMARY KEY REFERENCES agencies(id),
  utm_code   TEXT UNIQUE NOT NULL,
  signups    INTEGER NOT NULL DEFAULT 0,
  drafted_at TEXT
);
"""


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:24]


def assign() -> None:
    with db.connect() as c:
        c.executescript(SCHEMA)
        n = 0
        for r in c.execute("SELECT id, name FROM agencies").fetchall():
            code = slug(r["name"])
            c.execute("INSERT OR IGNORE INTO referrals (agency_id, utm_code) VALUES (?,?)",
                      (r["id"], code))
            c.execute("UPDATE agencies SET utm_code = ? WHERE id = ?", (code, r["id"]))
            n += 1
        print(f"  {n} UTM codes assigned")
        for r in c.execute(
            "SELECT a.name, r.utm_code, r.signups FROM referrals r "
            "JOIN agencies a ON a.id = r.agency_id ORDER BY a.name").fetchall():
            url = f"{BASE}/?utm_source=agency&utm_medium=partner&utm_campaign={r['utm_code']}"
            print(f"    {r['name']:<18} {r['signups']:>3}  {url}")


def record(name: str, count: int) -> None:
    with db.connect() as c:
        c.executescript(SCHEMA)
        row = c.execute("SELECT id, name FROM agencies WHERE name LIKE ?", (f"%{name}%",)).fetchone()
        if not row:
            raise SystemExit(f"no agency matching {name!r}")
        c.execute("INSERT OR IGNORE INTO referrals (agency_id, utm_code) VALUES (?,?)",
                  (row["id"], slug(row["name"])))
        c.execute("UPDATE referrals SET signups = signups + ? WHERE agency_id = ?",
                  (count, row["id"]))
        tot = c.execute("SELECT signups FROM referrals WHERE agency_id = ?",
                        (row["id"],)).fetchone()["signups"]
        db.log(c, row["id"], "REFERRAL", detail=f"+{count} signups (total {tot})")
        print(f"  {row['name']}: +{count} → {tot} total")


def draft(agency: str, signups: int, cfg) -> str:
    return (f"Subject: Your creators just got paid — want to scale it?\n\n"
            f"Hi {agency} team,\n\n"
            f"{signups} of your creators are now live on Temptation Token and this week's "
            "payouts have settled — they keep 50% of every vote, paid weekly in USDC, and "
            "you can see each settlement on-chain.\n\n"
            "Two things worth deciding now:\n\n"
            "  1. Do you want to add more of your roster? Onboarding another creator takes "
            "us about a day.\n"
            "  2. Do you want the leaderboard cards for your own channels? We generate them "
            f"per round.\n\n"
            f"Happy to walk through the numbers: {cfg.calendly_url or '[set CALENDLY_URL]'}\n\n"
            "Jim Goetz\nFounder — Temptation Token · Blockchain Entertainment LLC\n")


def check() -> None:
    cfg = config.load()
    with db.connect() as c:
        c.executescript(SCHEMA)
        rows = c.execute(
            "SELECT a.id, a.name, r.signups, r.drafted_at FROM referrals r "
            "JOIN agencies a ON a.id = r.agency_id WHERE r.signups >= ?", (THRESHOLD,)).fetchall()
        if not rows:
            print(f"  nobody over the threshold of {THRESHOLD} signups yet")
            return
        for r in rows:
            if r["drafted_at"]:
                print(f"  \033[2m{r['name']}: already drafted\033[0m")
                continue
            body = draft(r["name"], r["signups"], cfg)
            guardrails.assert_email_sendable(body)
            p = config.DRAFTS_DIR / f"{r['name'].replace('/', '-')}-scale.txt"
            p.write_text(body, encoding="utf-8")
            c.execute("UPDATE referrals SET drafted_at = ? WHERE agency_id = ?",
                      (db.now_iso(), r["id"]))
            print(f"  \033[32mdrafted\033[0m {r['name']} ({r['signups']} signups) → {p.name}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--assign", action="store_true")
    ap.add_argument("--record", nargs=2, metavar=("AGENCY", "N"))
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    db.init()
    if a.assign: assign()
    elif a.record: record(a.record[0], int(a.record[1]))
    elif a.check: check()
    else: ap.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
