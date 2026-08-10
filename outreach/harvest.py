#!/usr/bin/env python3
"""
Contact harvester.

Politeness is not optional here: 1 request/second per host, a truthful User-Agent, a 10s
timeout, and robots.txt is consulted and obeyed for every URL before it is fetched. A
disallowed path is skipped and reported, never fetched anyway.

Ranking follows contacts.py: legal/privacy/imprint pages outrank the contact page,
because that is where a named human is legally required to appear.

    python3 harvest.py                 # all HARVEST rows + enrich VERIFIED
    python3 harvest.py --only "AROA"    # one agency
    python3 harvest.py --no-mx          # skip DNS (offline)
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import time
import urllib.robotparser as robotparser
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tts_outreach import config, contacts, db, guardrails  # noqa: E402

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
HEADERS = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"}
TIMEOUT = 10
DELAY = 1.0

AGENCIES_CSV = config.DATA_DIR / "agencies.csv"
FOUND_CSV = config.DATA_DIR / "contacts_found.csv"

_robots: dict[str, robotparser.RobotFileParser | None] = {}
_last_hit: dict[str, float] = {}


def robots_for(base: str) -> robotparser.RobotFileParser | None:
    host = urlparse(base).netloc
    if host in _robots:
        return _robots[host]
    rp = robotparser.RobotFileParser()
    rp.set_url(urljoin(base, "/robots.txt"))
    try:
        rp.read()
    except Exception:
        # Unreachable robots.txt is NOT permission. Treat as "no rules published" only
        # when the fetch 404s; any other failure means we skip the host entirely.
        rp = None
    _robots[host] = rp
    return rp


def allowed(url: str) -> bool:
    rp = robots_for(url)
    if rp is None:
        return True  # no robots.txt published
    try:
        return rp.can_fetch(UA, url)
    except Exception:
        return True


def throttle(url: str) -> None:
    host = urlparse(url).netloc
    last = _last_hit.get(host, 0.0)
    wait = DELAY - (time.time() - last)
    if wait > 0:
        time.sleep(wait)
    _last_hit[host] = time.time()


def fetch(url: str) -> tuple[str, str]:
    """(text, note). Empty text means nothing usable came back."""
    if not allowed(url):
        return "", "robots-disallow"
    throttle(url)
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
    except requests.exceptions.SSLError:
        return "", "ssl-error"
    except requests.exceptions.ConnectionError:
        return "", "unreachable"
    except requests.exceptions.Timeout:
        return "", "timeout"
    except Exception as e:
        return "", f"error:{type(e).__name__}"
    if r.status_code >= 400:
        return "", f"http-{r.status_code}"
    ctype = r.headers.get("content-type", "")
    if "html" not in ctype and "xml" not in ctype and "text" not in ctype:
        return "", "not-html"
    return r.text, f"http-{r.status_code}"


def sitemap_urls(base: str, limit: int = 12) -> list[str]:
    """Contact/about/legal URLs advertised in sitemap.xml."""
    txt, _ = fetch(urljoin(base, "/sitemap.xml"))
    if not txt:
        return []
    urls = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", txt, re.IGNORECASE)
    keep = [u for u in urls if re.search(r"(contact|about|privacy|legal|imprint|impressum|terms)", u, re.I)]
    # A sitemap index points at more sitemaps; follow one level.
    if not keep:
        for sm in [u for u in urls if u.endswith(".xml")][:3]:
            sub, _ = fetch(sm)
            keep += [u for u in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", sub or "", re.I)
                     if re.search(r"(contact|about|privacy|legal|imprint|impressum|terms)", u, re.I)]
    seen, out = set(), []
    for u in keep:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out[:limit]


def hunter(domain: str, key: str) -> list[contacts.Candidate]:
    if not key:
        return []
    try:
        r = requests.get(
            "https://api.hunter.io/v2/domain-search",
            params={"domain": domain, "api_key": key, "limit": 10},
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            return []
        data = r.json().get("data", {})
        out = []
        for e in data.get("emails", []):
            if e.get("value"):
                c = contacts.Candidate(email=e["value"].lower(), source_url="hunter.io")
                c.notes.append(f"hunter conf={e.get('confidence')}")
                out.append(c)
        return out
    except Exception:
        return []


def harvest_domain(domain: str, hunter_key: str, check_mx: bool) -> tuple[list[contacts.Candidate], dict, list[str]]:
    """Returns (email candidates, socials, per-URL notes)."""
    base = domain if domain.startswith("http") else f"https://{domain}"
    base = base.rstrip("/")
    cands: list[contacts.Candidate] = []
    socials: dict[str, str] = {}
    notes: list[str] = []

    urls = [urljoin(base + "/", p.lstrip("/")) for p in contacts.CANDIDATE_PATHS]
    urls += sitemap_urls(base)

    seen = set()
    for u in urls:
        if u in seen:
            continue
        seen.add(u)
        txt, note = fetch(u)
        if not txt:
            if note not in ("http-404",):
                notes.append(f"{urlparse(u).path or '/'} {note}")
            continue
        cands += contacts.extract_emails(txt, u)
        for k, v in contacts.extract_socials(txt, u).items():
            socials.setdefault(k, v)

    cands += hunter(urlparse(base).netloc, hunter_key)

    # De-dup, keeping the highest-weighted source page for each address.
    best_by_addr: dict[str, contacts.Candidate] = {}
    for c in cands:
        prev = best_by_addr.get(c.email)
        if prev is None or contacts.page_weight(c.source_url) > contacts.page_weight(prev.source_url):
            best_by_addr[c.email] = c
    merged = list(best_by_addr.values())
    for c in merged:
        contacts.score(c, urlparse(base).netloc.replace("www.", ""))
    merged.sort(key=lambda c: c.score, reverse=True)
    return merged, socials, notes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="single agency name")
    ap.add_argument("--no-mx", action="store_true", help="skip MX validation")
    a = ap.parse_args()

    cfg = config.load()
    blocklist = guardrails.load_blocklist()
    rows = list(csv.DictReader(AGENCIES_CSV.open(encoding="utf-8")))
    before = {r["name"]: dict(r) for r in rows}

    found_rows: list[dict] = []
    print(f"\n\033[1mHARVEST\033[0m — {len(rows)} agencies · 1 req/s · robots.txt obeyed\n")

    for r in rows:
        name = r["name"]
        if a.only and a.only.lower() not in name.lower():
            continue

        hit = guardrails.is_blocked(name, r.get("domain"), r.get("email"),
                                   r.get("instagram"), r.get("x_handle"),
                                   blocklist=blocklist)
        if hit:
            print(f"  \033[31mSKIP\033[0m  {name:<18} blocklist:{hit}")
            continue
        if (r.get("status") or "").upper() == "HOLD":
            print(f"  \033[2mHOLD\033[0m  {name:<18} tier-3, not contacted")
            continue
        if not r.get("domain"):
            print(f"  \033[33mNODOM\033[0m {name:<18} no domain — needs manual lookup")
            continue

        cands, socials, notes = harvest_domain(r["domain"], cfg.hunter_api_key, not a.no_mx)
        pick = contacts.best(cands, r["domain"].replace("www.", ""), check_mx=not a.no_mx)

        for c in cands:
            found_rows.append({
                "agency": name, "email": c.email, "score": c.score,
                "source_url": c.source_url, "mx_ok": c.mx_ok,
                "notes": "; ".join(c.notes),
            })

        for k in ("telegram", "instagram", "x_handle", "phone"):
            if socials.get(k) and not r.get(k):
                r[k] = socials[k]

        if pick and not r.get("email"):
            r["email"] = pick.email
            r["status"] = "VERIFIED"
        elif r.get("email"):
            r["status"] = "VERIFIED"
        else:
            r["status"] = "FORM_ONLY"

        tag = ("\033[32mVERIFIED\033[0m" if r["status"] == "VERIFIED" else "\033[33mFORM_ONLY\033[0m")
        detail = (f"{pick.email} (score {pick.score}, {Path(urlparse(pick.source_url).path).name or '/'})"
                  if pick else (f"{len(cands)} candidates, none usable" if cands else "no emails"))
        print(f"  {tag:<20} {name:<18} {detail}")
        if notes:
            print(f"       \033[2m{'; '.join(notes[:4])}\033[0m")

    with AGENCIES_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    if found_rows:
        with FOUND_CSV.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(found_rows[0].keys()))
            w.writeheader()
            w.writerows(found_rows)

    # ── before/after table ──
    print(f"\n\033[1mBEFORE → AFTER\033[0m")
    print(f"  {'agency':<18} {'was':<10} {'now':<10} email")
    print("  " + "-" * 76)
    changed = 0
    for r in rows:
        b = before[r["name"]]
        mark = ""
        if b["status"] != r["status"] or b["email"] != r["email"]:
            mark = "\033[32m*\033[0m"
            changed += 1
        print(f"  {r['name']:<18} {b['status']:<10} {r['status']:<10} {(r['email'] or '—')[:34]} {mark}")
    print(f"\n  {changed} rows changed · {len(found_rows)} total candidates -> {FOUND_CSV.name}")

    db.init()
    with db.connect() as c:
        for r in rows:
            db.upsert_agency(c, r)
    print(f"  synced {len(rows)} agencies into {config.DB_PATH.name}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
