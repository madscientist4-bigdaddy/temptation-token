#!/usr/bin/env python3
"""
verify_all.py — re-scan every artifact already on disk.

The generators enforce compliance at write time, which is the real protection. This is the
independent second pass: it reads what actually landed in promo/ and checks it again, so a
bug in a generator (or a file someone hand-edited afterwards) still gets caught.

    python3 promo/verify_all.py

Exit code 1 if anything fails, so it can gate a commit.
"""

from __future__ import annotations

import json
import sys
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compliance import check, AD_TAG, COMPLIANCE_LINE  # noqa: E402

ROOT = Path(__file__).resolve().parent

# Files that legitimately contain banned words because they DEFINE them, or because they
# are B2B correspondence rather than public promo (see referral_tracker's docstring).
EXEMPT_NAMES = {"compliance.py", "verify_all.py", "README.md"}
EXEMPT_PREFIX = ("email_",)


# The compliance line and the pack README STATE the rules, so they necessarily contain the
# words the rules ban ("no price/earnings claims ... never posted on OnlyFans"). Scanning
# them as if they were promo copy is a false positive — and a checker that cries wolf is
# how people learn to ignore it. Strip the boilerplate, then scan what's left.
BOILERPLATE = [
    COMPLIANCE_LINE,
    "no price/earnings claims",
    "never posted on OnlyFans",
    "Never mention OnlyFans",
    "Never claim or imply what anyone earns, wins, or what $TTS is worth",
    "No prices, no returns",
    "never post the vote link there",
    "no price/earnings claims · link only",
]


def strip_boilerplate(text: str) -> str:
    for b in BOILERPLATE:
        text = text.replace(b, " ")
    return text


def scan_text(path: Path, text: str, failures: list) -> None:
    # HTML artifacts escape apostrophes as &#x27; etc. Decode first so entities are not
    # mistaken for content (this is what made "x27" look like a "27x" price claim).
    if path.suffix == ".html":
        text = unescape(text)
    rep = check(strip_boilerplate(text), where=str(path.relative_to(ROOT)))
    if not rep.ok:
        failures.append((path, rep))


def main() -> int:
    failures: list = []
    checked = 0

    targets = [p for p in ROOT.rglob("*")
               if p.is_file()
               and p.suffix in {".md", ".json", ".html", ".txt"}
               and p.name not in EXEMPT_NAMES
               and not p.name.startswith(EXEMPT_PREFIX)
               and "standings" not in p.name
               and p.name != "agencies.json"
               and p.name != "attribution.json"]

    for p in targets:
        text = p.read_text(encoding="utf-8", errors="replace")
        checked += 1
        scan_text(p, text, failures)

    # Positive check: every caption/story in a generated pack must carry #ad.
    missing_ad = []
    for pack in ROOT.glob("packs/*/pack.json"):
        data = json.loads(pack.read_text(encoding="utf-8"))
        for group in ("captions", "stories"):
            for item in data.get(group, []):
                if AD_TAG not in item["text"].lower():
                    missing_ad.append((pack.parent.name, group, item["label"]))

    for feed in ROOT.glob("out/feed_*.json"):
        data = json.loads(feed.read_text(encoding="utf-8"))
        for post in data.get("posts", []):
            if AD_TAG not in post["text"].lower():
                missing_ad.append((feed.name, "posts", post["kind"]))

    print("── promo artifact verification ──────────────────────────────────")
    print(f"  scanned {checked} file(s) under {ROOT.name}/")

    if failures:
        print(f"\n  ✗ {len(failures)} file(s) contain banned copy:\n")
        for p, rep in failures:
            print(f"  {p.relative_to(ROOT)}\n{rep}\n")
    else:
        print("  ✓ no banned copy in any generated artifact")

    if missing_ad:
        print(f"\n  ✗ {len(missing_ad)} item(s) missing {AD_TAG}:")
        for where, group, label in missing_ad:
            print(f"      {where} · {group} · {label}")
    else:
        print(f"  ✓ every caption, story and post carries {AD_TAG}")

    bad = bool(failures or missing_ad)
    print("─────────────────────────────────────────────────────────────────")
    print("FAIL — do not distribute" if bad else "all artifacts compliant")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
