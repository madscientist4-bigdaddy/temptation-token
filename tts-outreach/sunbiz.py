"""MODULE B — corporate registry lookup (Florida Sunbiz + California bizfile).

Pulls principal address, registered agent and officer names for US-looking
agencies so letters and calls can be addressed to a real person.

This reads PUBLIC business-registration records. Two limits are deliberate:

  1. If a registry blocks automation, we do not try to defeat it — the exact
     search URL is printed for you to click. That is the documented behaviour,
     not a fallback.
  2. Small LLCs frequently register a HOME address as the principal address.
     Anything flagged `residential_risk` should get a business-channel contact
     (the agency's own office/contact address), not a courier to someone's
     house. Review data/fedex_list.csv before sending anything physical.

Requires: pip install playwright && playwright install chromium
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from datetime import datetime
from urllib.parse import quote_plus

import config
import db

FL_SEARCH = "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiretype=EntityName&searchNameOrder={q}"
CA_SEARCH = "https://bizfileonline.sos.ca.gov/search/business"

FIELDS = ["agency", "state", "entity_name", "status", "principal_address",
          "mailing_address", "registered_agent", "officers", "document_number",
          "residential_risk", "source_url", "checked_at"]

RESIDENTIAL_HINTS = re.compile(
    r"\b(apt|apartment|unit|#\s?\d+|suite\s?\d{1,3}\b|po box|p\.o\. box)\b", re.I)


def us_candidates():
    """Agencies worth a registry lookup: named ones, plus any .com with a US phone."""
    named = {"bunny agency", "amourvue"}
    out = []
    for r in db.all_agencies():
        if r["status"] in ("HOLD", "BLOCKED", "SUPPRESSED"):
            continue
        name_hit = r["name"].strip().lower() in named
        phone = (r["phone"] or "").replace(" ", "")
        us_phone = phone.startswith("+1") or re.fullmatch(r"\d{10}", phone or "")
        dotcom = (r["domain"] or "").endswith(".com")
        if name_hit or (dotcom and us_phone):
            out.append(r)
    return out


def manual_urls(rows) -> list[tuple[str, str, str]]:
    out = []
    for r in rows:
        out.append((r["name"], "FL", FL_SEARCH.format(q=quote_plus(r["name"]))))
        out.append((r["name"], "CA", CA_SEARCH))
    return out


def scrape(rows, headed: bool = True, states=("FL", "CA")) -> list[dict]:
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    except ImportError:
        print("playwright not installed. Either:\n"
              "  pip install playwright && playwright install chromium\n"
              "…or use the manual URLs below.\n", file=sys.stderr)
        return []

    results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not headed)
        ctx = browser.new_context(user_agent=config.USER_AGENT, locale="en-US")
        page = ctx.new_page()

        for row in rows:
            name = row["name"]
            if "FL" in states:
                url = FL_SEARCH.format(q=quote_plus(name))
                rec = {f: "" for f in FIELDS}
                rec.update(agency=name, state="FL", source_url=url,
                           checked_at=datetime.now().isoformat(timespec="seconds"))
                try:
                    page.goto(url, timeout=25000, wait_until="domcontentloaded")
                    link = page.locator("table.search-results a").first
                    if link.count():
                        rec["entity_name"] = (link.inner_text() or "").strip()
                        link.click(timeout=10000)
                        page.wait_for_load_state("domcontentloaded", timeout=20000)
                        text = page.inner_text("body")
                        rec.update(parse_fl(text))
                        rec["source_url"] = page.url
                    else:
                        rec["status"] = "no-match"
                except PWTimeout:
                    rec["status"] = "BLOCKED-OR-TIMEOUT — open source_url by hand"
                except Exception as e:
                    rec["status"] = f"ERROR {type(e).__name__} — open source_url by hand"
                rec["residential_risk"] = "YES" if RESIDENTIAL_HINTS.search(rec.get("principal_address", "")) else ""
                results.append(rec)
                print(f"  FL  {name:<20} {rec['status'] or 'ok':<40} {rec.get('principal_address','')[:40]}")

            if "CA" in states:
                rec = {f: "" for f in FIELDS}
                rec.update(agency=name, state="CA", source_url=CA_SEARCH,
                           checked_at=datetime.now().isoformat(timespec="seconds"),
                           status="MANUAL — bizfile is a JS app behind bot protection; search by hand")
                results.append(rec)
    return results


def parse_fl(text: str) -> dict:
    def grab(label, stop):
        m = re.search(rf"{label}\s*(.+?)(?={stop})", text, re.S | re.I)
        return re.sub(r"\n\s*", ", ", m.group(1).strip())[:300] if m else ""

    out = {}
    out["principal_address"] = grab(r"Principal Address", r"Changed:|Mailing Address|Registered Agent")
    out["mailing_address"] = grab(r"Mailing Address", r"Changed:|Registered Agent|Officer")
    out["registered_agent"] = grab(r"Registered Agent Name & Address", r"Name Changed:|Address Changed:|Officer|Authorized")
    officers = re.search(r"(?:Officer/Director Detail|Authorized Person\(s\) Detail)\s*(.+?)(?=Annual Reports|Document Images|$)",
                         text, re.S | re.I)
    if officers:
        names = re.findall(r"(?:Title\s+\w+\s*)?([A-Z][A-Za-z\-']+,\s+[A-Z][A-Za-z\-'\. ]+)", officers.group(1))
        out["officers"] = "; ".join(dict.fromkeys(n.strip() for n in names))[:300]
    m = re.search(r"Document Number\s*([A-Z0-9\-]+)", text, re.I)
    if m:
        out["document_number"] = m.group(1)
    m = re.search(r"\b(Active|Inactive|INACT|ACTIVE)\b", text)
    if m:
        out["status"] = m.group(1)
    return out


def write_csv(rows: list[dict]) -> None:
    with open(config.FEDEX_CSV, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in FIELDS})


def main() -> int:
    ap = argparse.ArgumentParser(description="Look up FL/CA corporate registry records.")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--urls-only", action="store_true", help="print search URLs, no browser")
    args = ap.parse_args()

    db.init()
    rows = us_candidates()
    if not rows:
        print("No US-looking agencies to check.")
        return 0

    print(f"US-looking agencies: {', '.join(r['name'] for r in rows)}\n")

    if args.urls_only:
        print("Open these by hand:\n")
        for name, st, url in manual_urls(rows):
            print(f"  {st}  {name}\n      {url}")
        return 0

    results = scrape(rows, headed=not args.headless)
    if not results:
        print("\nNothing captured. Manual URLs:\n")
        for name, st, url in manual_urls(rows):
            print(f"  {st}  {name}\n      {url}")
        return 1

    write_csv(results)
    print(f"\nwrote {config.FEDEX_CSV}")
    flagged = [r for r in results if r.get("residential_risk") == "YES"]
    if flagged:
        print("\n  ⚠️  Possible RESIDENTIAL addresses — use a business channel, not a courier:")
        for r in flagged:
            print(f"     {r['agency']}: {r['principal_address'][:70]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
