#!/usr/bin/env python3
"""
Owner + registered-address lookup against public state business registries.

Sources are public records: Florida Sunbiz and California bizfile. We read search
results only — no account, no form submission, nothing written back. The point is to get
a real human's legal name onto a FedEx envelope instead of "To whom it may concern".

Registries are aggressively anti-automation and change markup often. So this fails LOUD
and useful: when a lookup is blocked or the layout has moved, it prints the exact search
URL for you to click rather than guessing at a result.

    python3 sunbiz.py                    # every US-looking agency
    python3 sunbiz.py --name "AmourVue"
    python3 sunbiz.py --urls-only        # skip the browser, just print URLs
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path
from urllib.parse import quote_plus

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tts_outreach import config, db  # noqa: E402

FEDEX_CSV = config.DATA_DIR / "fedex_list.csv"

FL_SEARCH = "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&searchNounNumber=&searchTerm={q}"
CA_SEARCH = "https://bizfileonline.sos.ca.gov/search/business"

US_AREA = re.compile(r"^\+?1[-. ]?\(?\d{3}\)?")


def looks_us(row: dict) -> bool:
    if US_AREA.match((row.get("phone") or "").strip()):
        return True
    dom = (row.get("domain") or "").lower()
    return dom.endswith(".com") and bool(row.get("phone"))


def search_urls(name: str) -> dict[str, str]:
    return {
        "FL Sunbiz": FL_SEARCH.format(q=quote_plus(name)),
        "CA bizfile": f"{CA_SEARCH}?q={quote_plus(name)}",
    }


def try_playwright(name: str, timeout_ms: int = 25000) -> dict | None:
    """Best-effort FL Sunbiz scrape. Returns None on any block/uncertainty."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("    playwright not installed — pip install playwright && playwright install chromium")
        return None

    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True)
            pg = b.new_page(user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"))
            pg.goto(FL_SEARCH.format(q=quote_plus(name)), timeout=timeout_ms,
                    wait_until="domcontentloaded")
            rows = pg.query_selector_all("table tbody tr, .search-results tr")
            if not rows:
                b.close()
                return None
            link = None
            for r in rows:
                a = r.query_selector("a")
                if a and name.split()[0].lower() in (a.inner_text() or "").lower():
                    link = a
                    break
            if link is None:
                b.close()
                return None
            link.click()
            pg.wait_for_load_state("domcontentloaded", timeout=timeout_ms)
            text = pg.inner_text("body")
            b.close()

        def grab(label: str) -> str:
            m = re.search(rf"{label}\s*\n(.{{0,240}}?)(?:\n\s*\n|\Z)", text, re.I | re.S)
            return re.sub(r"\s*\n\s*", ", ", m.group(1).strip()) if m else ""

        principal = grab("Principal Address")
        agent = grab("Registered Agent Name & Address")
        officers = ""
        mo = re.search(r"Officer/Director Detail\s*\n(.{0,400}?)(?:\n\s*\n|\Z)", text, re.I | re.S)
        if mo:
            officers = re.sub(r"\s*\n\s*", " | ", mo.group(1).strip())
        if not (principal or agent or officers):
            return None
        return {"principal_address": principal, "registered_agent": agent, "officers": officers}
    except Exception as e:
        print(f"    lookup failed ({type(e).__name__}) — use the URL below")
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name")
    ap.add_argument("--urls-only", action="store_true")
    a = ap.parse_args()

    db.init()
    with db.connect() as c:
        rows = [dict(r) for r in c.execute("SELECT * FROM agencies").fetchall()]

    targets = [r for r in rows if (a.name and a.name.lower() in r["name"].lower())
               or (not a.name and looks_us(r))]
    if not targets:
        print("No US-looking agencies (need a +1 phone or an explicit --name).")

    out = []
    print(f"\n\033[1mOWNER / ADDRESS LOOKUP\033[0m — {len(targets)} target(s)\n")
    for r in targets:
        print(f"  \033[1m{r['name']}\033[0m")
        urls = search_urls(r["name"])
        rec = {"agency": r["name"], "domain": r.get("domain", ""), "phone": r.get("phone", ""),
               "principal_address": "", "registered_agent": "", "officers": "",
               "fl_url": urls["FL Sunbiz"], "ca_url": urls["CA bizfile"]}

        if not a.urls_only:
            got = try_playwright(r["name"])
            if got:
                rec.update(got)
                print(f"    \033[32mfound\033[0m principal: {got['principal_address'][:70] or '—'}")
                if got["officers"]:
                    print(f"          officers : {got['officers'][:70]}")
                with db.connect() as c:
                    c.execute(
                        "UPDATE agencies SET postal_addr = COALESCE(NULLIF(?,''), postal_addr), "
                        "owner_name = COALESCE(NULLIF(?,''), owner_name), updated_at = ? WHERE id = ?",
                        (got["principal_address"], got["officers"].split("|")[0].strip(),
                         db.now_iso(), r["id"]))
            else:
                print("    \033[33mno automated result\033[0m — click these:")
                for k, u in urls.items():
                    print(f"      {k}: {u}")
        else:
            for k, u in urls.items():
                print(f"      {k}: {u}")
        out.append(rec)
        print()

    if out:
        with FEDEX_CSV.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
            w.writeheader()
            w.writerows(out)
        print(f"  → {FEDEX_CSV.relative_to(config.ROOT)}  ({len(out)} rows)\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
