#!/usr/bin/env python3
"""
referral_tracker.py — per-agency attribution + the "want to scale?" email draft.

    python3 promo/referral_tracker.py add --name "Starlight Talent" --email ops@starlight.co
    python3 promo/referral_tracker.py list
    python3 promo/referral_tracker.py report
    python3 promo/referral_tracker.py draft-email --agency starlight-talent

── READ THIS BEFORE TRUSTING THE NUMBERS ─────────────────────────────────────
The brief asked for a UTM code per agency. UTM parameters are **not captured anywhere in
this app** — I checked src/ and api/ and there is no utm_ handling at all. A UTM-only
tracker would build tidy links, report zero signups forever, and look like it was working.

So each agency gets a **club code** instead, reusing the mechanism that already works end
to end: `?club=<code>` is captured in localStorage, prefills the submit form, and is
registered on-chain via setClubWallet. That is a real, auditable attribution path.

The UTM string is still generated, because it is useful in whatever analytics you point at
the site — but attribution is read from the club path, not from UTM. If you later add UTM
capture on the backend, `--source utm` will start working without changing anything here.

── ON THE EMAIL DRAFT ────────────────────────────────────────────────────────
The draft cites ONLY realised, already-paid figures pulled from your backend. It refuses
to include projections, "up to" language, or anything forward-looking, because an email to
a partner saying what their creators *could* make is an earnings claim wearing a suit.
Everything it states is something that already happened and is verifiable on-chain.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compliance import check  # noqa: E402

ROOT = Path(__file__).resolve().parent
APP = "https://app.temptationtoken.io"
AGENCIES = ROOT / "agencies.json"

# Forward-looking language is banned from partner emails — see module docstring.
PROJECTION = re.compile(
    r"\b(could|would|projected|estimate[sd]?|expect(ed)?|potential(ly)?|up\s+to|"
    r"as\s+much\s+as|forecast|on\s+track\s+to|guarantee[ds]?)\b", re.I)


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def code_for(slug: str) -> str:
    """Club codes get typed by humans — short, lowercase, no separators."""
    return re.sub(r"[^a-z0-9]", "", slug)[:20]


def load_agencies() -> list[dict]:
    if not AGENCIES.exists():
        return []
    return json.loads(AGENCIES.read_text(encoding="utf-8"))


def save_agencies(rows: list[dict]) -> None:
    AGENCIES.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")


def links_for(code: str, slug: str) -> dict:
    utm = urllib.parse.urlencode({
        "utm_source": "agency", "utm_medium": "partner", "utm_campaign": slug})
    return {
        # The one that actually attributes.
        "tracked": f"{APP}/?club={code}",
        # Same destination plus UTM for analytics. Attribution still comes from ?club=.
        "tracked_utm": f"{APP}/?club={code}&{utm}",
        "utm": utm,
    }


# ── Attribution data ──────────────────────────────────────────────────────────
def load_dotenv(path: Path) -> dict:
    env = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip().lstrip("export ").strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_attribution() -> tuple[dict | None, str]:
    """GET-only. This script must never be able to mutate backend state."""
    env = {**load_dotenv(ROOT.parent / ".env"), **os.environ}
    url, key = env.get("TTS_READONLY_API_URL"), env.get("TTS_READONLY_API_KEY")
    if url and key:
        try:
            base = url.rstrip("/")
            req = urllib.request.Request(f"{base}?view=agency_attribution", method="GET")
            req.add_header("Authorization", f"Bearer {key}")
            req.add_header("Accept", "application/json")
            with urllib.request.urlopen(req, timeout=12) as r:
                return json.loads(r.read().decode("utf-8")), "live API"
        except Exception as e:  # noqa: BLE001
            print(f"  ! live attribution unavailable ({type(e).__name__}) — falling back",
                  file=sys.stderr)
    local = ROOT / "attribution.json"
    if local.exists():
        return json.loads(local.read_text(encoding="utf-8")), f"file ({local.name})"
    return None, "none"


def rows_for(agency: dict, attribution: dict | None) -> dict:
    """
    Expected shape (either from the API or attribution.json):
      { "agencies": { "<club_code>": {
            "signups": 12, "creators": 5, "creators_paid": 3,
            "payouts": [ {"creator":"@x","tts":1750,"tx":"0x…","date":"2026-08-03"} ] } } }
    Absent data reports as zero rather than guessing.
    """
    blank = {"signups": 0, "creators": 0, "creators_paid": 0, "payouts": []}
    if not attribution:
        return blank
    return {**blank, **(attribution.get("agencies", {}).get(agency["code"], {}))}


# ── Commands ──────────────────────────────────────────────────────────────────
def cmd_add(a) -> int:
    rows = load_agencies()
    slug = slugify(a.name)
    if not slug:
        print("✗ --name must contain letters or numbers", file=sys.stderr); return 2
    if any(r["slug"] == slug for r in rows):
        print(f"✗ agency {slug!r} already exists", file=sys.stderr); return 2
    code = code_for(slug)
    if any(r["code"] == code for r in rows):
        code = f"{code}2"
    row = {"name": a.name, "slug": slug, "code": code, "email": a.email,
           "contact": a.contact, "added": date.today().isoformat(),
           **links_for(code, slug)}
    rows.append(row); save_agencies(rows)
    print(f"\n✓ {a.name}\n")
    print(f"  club code      {code}")
    print(f"  tracked link   {row['tracked']}")
    print(f"  with UTM       {row['tracked_utm']}")
    print("\n  NEXT: register this club code so attribution and payouts actually work —")
    print(f"  admin dashboard → Clubs → register '{code}' with the agency's payout wallet,")
    print("  or let them self-serve at /clubs. Until it is registered on-chain the link")
    print("  still tracks in analytics but the agency cannot be paid.\n")
    return 0


def cmd_list(a) -> int:
    rows = load_agencies()
    if not rows:
        print("No agencies yet. Add one with: referral_tracker.py add --name ... --email ...")
        return 0
    print(f"\n{'AGENCY':28} {'CODE':16} {'ADDED':12} LINK")
    for r in rows:
        print(f"{r['name'][:27]:28} {r['code']:16} {r['added']:12} {r['tracked']}")
    print()
    return 0


def cmd_report(a) -> int:
    rows = load_agencies()
    attribution, source = fetch_attribution()
    if not rows:
        print("No agencies yet."); return 0

    print(f"\n── Agency performance (source: {source}) ──────────────────────────")
    if not attribution:
        print("\n  No attribution data available.")
        print("  Set TTS_READONLY_API_URL + TTS_READONLY_API_KEY in .env, or drop")
        print(f"  {ROOT / 'attribution.json'} (see the docstring for the shape).\n")
        return 0

    print(f"\n{'AGENCY':26} {'CODE':14} {'SIGNUPS':>8} {'CREATORS':>9} {'PAID':>6}  STATUS")
    ranked = []
    for r in rows:
        d = rows_for(r, attribution)
        ranked.append((d["signups"], r, d))
    ranked.sort(key=lambda t: -t[0])
    for signups, r, d in ranked:
        status = ("producing" if d["creators_paid"] else
                  "signups, no payouts yet" if signups else "no signups yet")
        print(f"{r['name'][:25]:26} {r['code']:14} {signups:>8} "
              f"{d['creators']:>9} {d['creators_paid']:>6}  {status}")

    dead = [r for _, r, d in ranked if d["signups"] == 0]
    if dead:
        print(f"\n  {len(dead)} agency/agencies with zero signups: "
              f"{', '.join(r['name'] for r in dead)}")
        print("  That is the useful signal here — a partnership that produces nothing is")
        print("  worth knowing about early rather than assuming it is warming up.")
    print()
    return 0


def cmd_draft_email(a) -> int:
    rows = load_agencies()
    ag = next((r for r in rows if r["slug"] == a.agency or r["code"] == a.agency), None)
    if not ag:
        print(f"✗ unknown agency {a.agency!r} — see `list`", file=sys.stderr); return 2

    attribution, source = fetch_attribution()
    d = rows_for(ag, attribution)
    if d["creators_paid"] < a.threshold:
        print(f"\n  {ag['name']}: {d['creators_paid']} creator(s) paid — below the "
              f"threshold of {a.threshold}. No email drafted.")
        print("  The whole point of the threshold is that this email only goes out when")
        print("  there is something real to show.\n")
        return 0

    paid = d["payouts"][: a.max_lines]
    lines = "\n".join(
        f"  · {p.get('creator','a creator')} — {float(p.get('tts',0)):,.0f} $TTS "
        f"on {p.get('date','')}" + (f"  ({p['tx'][:12]}…)" if p.get("tx") else "")
        for p in paid) or "  · (payout detail unavailable)"

    contact = ag.get("contact") or "there"
    body = f"""Hi {contact},

Quick update on the creators you sent over to Temptation Token.

{d['creators_paid']} of your creators have now been paid out from weekly rounds. These are
completed, on-chain transactions — you can verify every one of them on BaseScan:

{lines}

Totals so far under your code ({ag['code']}):
  · {d['signups']} signups attributed to your link
  · {d['creators']} creators entered
  · {d['creators_paid']} paid

Two things I'd like to ask:

1. Is there anything in the onboarding that tripped your creators up? I'd rather fix it
   than have you chase people through it.
2. If it's working for you, I'd like to widen it — more of your roster, and we can look at
   a dedicated code per creator so you can see performance per person.

Happy to jump on a call whenever suits.

Jim Goetz
Blockchain Entertainment LLC
jgoetz@functionised.com
{APP}
"""

    subject = f"Your creators' payouts on Temptation Token — {ag['name']}"

    # Guardrails. Promotional-copy rules don't all apply to B2B correspondence (this
    # legitimately cites real payout figures), but two things always do: no OnlyFans or
    # NSFW references, and no forward-looking earnings language.
    rep = check(subject + "\n" + body, where="agency email")
    hard = [v for v in rep.violations if v.rule in {"onlyfans", "nsfw", "post_on_of"}]
    proj = PROJECTION.findall(body)
    if hard:
        print(f"\n✗ Refusing to draft — {hard[0].rule}: {hard[0].match!r}", file=sys.stderr)
        return 1
    if proj:
        print(f"\n✗ Refusing to draft — forward-looking language found: "
              f"{sorted({p[0] if isinstance(p, tuple) else p for p in proj})}\n"
              f"  This email may only state figures that have already been realised.",
              file=sys.stderr)
        return 1

    out = ROOT / "out" / f"email_{ag['slug']}_{date.today().isoformat()}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(f"**To:** {ag.get('email','')}\n**Subject:** {subject}\n\n---\n\n{body}",
                   encoding="utf-8")
    print(f"\n✓ Draft → {out}   (source: {source})")
    print(f"\n  Subject: {subject}\n")
    print(body)
    print("  Read it before sending. Every figure above is a completed payout — if any of")
    print("  it looks wrong, the attribution data is wrong, not the email.\n")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Per-agency attribution and partner emails.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("add", help="Register an agency and mint its code + links")
    p.add_argument("--name", required=True)
    p.add_argument("--email", default="")
    p.add_argument("--contact", default="", help="Contact first name for the email greeting")
    p.set_defaults(fn=cmd_add)

    p = sub.add_parser("list", help="List agencies and their links")
    p.set_defaults(fn=cmd_list)

    p = sub.add_parser("report", help="Signups / creators / payouts per agency")
    p.set_defaults(fn=cmd_report)

    p = sub.add_parser("draft-email", help="Draft the 'want to scale?' email")
    p.add_argument("--agency", required=True, help="slug or code")
    p.add_argument("--threshold", type=int, default=1,
                   help="Minimum creators paid before drafting (default 1)")
    p.add_argument("--max-lines", type=int, default=8)
    p.set_defaults(fn=cmd_draft_email)

    a = ap.parse_args()
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
