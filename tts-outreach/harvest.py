"""MODULE A — contact harvester.

Crawls a small, fixed set of public pages per agency domain, extracts contact
points, validates emails against DNS MX, scores them, and writes the best one
back to agencies.csv.

Politeness rules, all enforced here rather than left to the caller:
  * robots.txt is consulted for every URL and honoured. Disallowed -> skipped.
  * one request per second, globally, across all domains.
  * 10s timeout, no retries beyond one, no parallelism.

Deliberate limit: pages that hide addresses behind Cloudflare's `data-cfemail`
scrambler are reported but NOT decoded. Human-readable obfuscation ("name [at]
domain") is a display choice and is parsed; the Cloudflare control is an
explicit machine anti-harvesting measure, so it is left alone and flagged for a
manual look instead.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
import urllib.robotparser as robotparser
from datetime import datetime
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

import config
import db

try:
    import dns.resolver
    HAVE_DNS = True
except ImportError:
    HAVE_DNS = False

# ── HTTP plumbing ─────────────────────────────────────────────────────────
_last_request = 0.0
_robots_cache: dict[str, robotparser.RobotFileParser | None] = {}
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": config.USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"})


def _throttle() -> None:
    global _last_request
    delta = time.time() - _last_request
    if delta < config.RATE_LIMIT_SECONDS:
        time.sleep(config.RATE_LIMIT_SECONDS - delta)
    _last_request = time.time()


def robots_allows(url: str) -> bool:
    parsed = urlparse(url)
    root = f"{parsed.scheme}://{parsed.netloc}"
    if root not in _robots_cache:
        rp = robotparser.RobotFileParser()
        rp.set_url(urljoin(root, "/robots.txt"))
        try:
            _throttle()
            resp = SESSION.get(urljoin(root, "/robots.txt"), timeout=config.HTTP_TIMEOUT)
            if resp.status_code == 200:
                rp.parse(resp.text.splitlines())
            else:
                rp = None  # no robots.txt published -> allowed
        except requests.RequestException:
            rp = None
        _robots_cache[root] = rp
    rp = _robots_cache[root]
    if rp is None:
        return True
    try:
        return rp.can_fetch(config.USER_AGENT, url)
    except Exception:
        return True


def fetch(url: str) -> tuple[str | None, str]:
    """Return (html, note). Never raises."""
    if not robots_allows(url):
        return None, "robots-disallow"
    try:
        _throttle()
        r = SESSION.get(url, timeout=config.HTTP_TIMEOUT, allow_redirects=True)
    except requests.exceptions.SSLError:
        return None, "ssl-error"
    except requests.exceptions.ConnectionError:
        return None, "conn-error"
    except requests.exceptions.Timeout:
        return None, "timeout"
    except requests.RequestException as e:
        return None, f"error:{type(e).__name__}"
    if r.status_code != 200:
        return None, f"http-{r.status_code}"
    ctype = r.headers.get("Content-Type", "")
    if "html" not in ctype and "xml" not in ctype and "text" not in ctype:
        return None, f"skip-ctype:{ctype.split(';')[0]}"
    return r.text, "ok"


# ── Extraction ────────────────────────────────────────────────────────────
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

# Human-readable obfuscations the site chose to render for people to read.
BRACKET_AT = re.compile(r"\s*[\[\(\{]\s*(?:at|@)\s*[\]\)\}]\s*", re.I)
BRACKET_DOT = re.compile(r"\s*[\[\(\{]\s*(?:dot|punkt|\.)\s*[\]\)\}]\s*", re.I)
SPACED = re.compile(
    r"([A-Za-z0-9._%+\-]+)\s+(?:at|@)\s+([A-Za-z0-9\-]+(?:\s+(?:dot|\.)\s+[A-Za-z0-9\-]+)+)", re.I)

ROLE_SCORES = {
    "office": 6.0, "contact": 5.0, "hello": 5.0, "team": 5.0, "partnerships": 7.0,
    "business": 6.5, "bd": 6.5, "management": 6.0, "booking": 5.5, "models": 5.0,
    "info": 4.0, "inquiries": 4.0, "enquiries": 4.0, "sales": 4.0, "admin": 3.5,
    "support": 3.0, "help": 3.0, "billing": 2.0, "careers": 1.5, "jobs": 1.5,
    "privacy": 1.5, "legal": 1.5, "dmca": 1.0, "abuse": 0.5, "webmaster": 0.5,
    "postmaster": 0.5, "hostmaster": 0.5, "security": 0.5,
}
NEVER = {"noreply", "no-reply", "donotreply", "do-not-reply", "mailer-daemon"}
# Addresses belonging to platforms/agencies-of-the-agency, not the target.
JUNK_DOMAINS = {
    "example.com", "email.com", "domain.com", "yourdomain.com", "sentry.io",
    "wixpress.com", "squarespace.com", "godaddy.com", "cloudflare.com",
    "wordpress.com", "wordpress.org", "gravatar.com", "schema.org", "w3.org",
    "sentry.wixpress.com", "jquery.com", "googleapis.com", "gstatic.com",
}
JUNK_LOCALS = {"user", "name", "your", "test", "email", "someone", "john.doe", "jane.doe"}


def deobfuscate(text: str) -> str:
    t = text.replace("&#64;", "@").replace("&commat;", "@").replace("&#46;", ".")
    t = BRACKET_AT.sub("@", t)
    t = BRACKET_DOT.sub(".", t)

    def _spaced(m):
        local, dom = m.group(1), m.group(2)
        dom = re.sub(r"\s+(?:dot|\.)\s+", ".", dom, flags=re.I)
        return f"{local}@{dom}"

    return SPACED.sub(_spaced, t)


def page_weight(url: str) -> float:
    low = url.lower()
    best = 1.0
    for key, w in config.PAGE_WEIGHTS.items():
        if key in low:
            best = max(best, w)
    return best


def score_email(addr: str, agency_domain: str, weight: float) -> float:
    local, _, dom = addr.partition("@")
    local_l, dom_l = local.lower(), dom.lower()
    if local_l in NEVER or dom_l in JUNK_DOMAINS or local_l in JUNK_LOCALS:
        return -1.0
    if any(dom_l.endswith("." + j) or dom_l == j for j in JUNK_DOMAINS):
        return -1.0

    base = ROLE_SCORES.get(local_l)
    if base is None:
        # Not a role account. first.last@ reads most personal, then firstname@.
        if re.fullmatch(r"[a-z]+\.[a-z]+", local_l):
            base = 10.0
        elif re.fullmatch(r"[a-z]{2,}", local_l):
            base = 8.0
        elif re.fullmatch(r"[a-z]+[._-][a-z]+[._-]?[a-z]*", local_l):
            base = 9.0
        else:
            base = 6.0

    # An address on the agency's own domain is worth far more than a designer's
    # or platform's address that happens to sit in the same imprint block.
    if agency_domain:
        root = agency_domain.lower().replace("www.", "")
        if dom_l == root or dom_l.endswith("." + root):
            base += 6.0
        else:
            base -= 4.0
    return base + weight


def has_mx(domain: str, cache: dict[str, bool]) -> bool:
    if not HAVE_DNS:
        return True  # cannot verify; do not silently drop candidates
    d = domain.lower()
    if d in cache:
        return cache[d]
    ok = False
    try:
        answers = dns.resolver.resolve(d, "MX", lifetime=6.0)
        ok = len(answers) > 0
    except Exception:
        try:
            dns.resolver.resolve(d, "A", lifetime=4.0)
            ok = True   # A-record-only domains still accept mail in practice
        except Exception:
            ok = False
    cache[d] = ok
    return ok


def extract(html: str, url: str) -> dict[str, set]:
    out = {k: set() for k in ("email", "telegram", "whatsapp", "instagram", "x", "phone", "flag")}
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    if "data-cfemail" in html or "/cdn-cgi/l/email-protection" in html:
        out["flag"].add("cloudflare-email-protection (not decoded — check this page by hand)")

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        low = href.lower()
        if low.startswith("mailto:"):
            addr = href[7:].split("?")[0].strip()
            if EMAIL_RE.fullmatch(addr):
                out["email"].add(addr)
        elif low.startswith("tel:"):
            num = re.sub(r"[^\d+]", "", href[4:])
            if 7 <= len(num.lstrip("+")) <= 15:
                out["phone"].add(num)
        elif "t.me/" in low or "telegram.me/" in low:
            h = re.sub(r"^[@/]+", "", low.split("t.me/")[-1].split("telegram.me/")[-1]).split("?")[0].strip("/")
            if h and not h.startswith("joinchat") and re.fullmatch(r"[a-z0-9_]{3,32}", h):
                out["telegram"].add(h)
        elif "wa.me/" in low or "api.whatsapp.com" in low:
            num = re.sub(r"[^\d]", "", low.split("wa.me/")[-1].split("phone=")[-1])[:15]
            if len(num) >= 7:
                out["whatsapp"].add("+" + num)
        elif "instagram.com/" in low:
            h = low.split("instagram.com/")[-1].split("?")[0].strip("/")
            if h and "/" not in h and re.fullmatch(r"[a-z0-9._]{2,30}", h) and h not in {"p", "reel", "explore", "accounts"}:
                out["instagram"].add(h)
        elif "twitter.com/" in low or "x.com/" in low:
            h = low.split("twitter.com/")[-1].split("x.com/")[-1].split("?")[0].strip("/")
            if h and "/" not in h and re.fullmatch(r"[a-z0-9_]{2,15}", h) and h not in {"intent", "share", "home", "i"}:
                out["x"].add(h)

    text = deobfuscate(soup.get_text(" ", strip=True)) + " " + deobfuscate(html)
    for m in EMAIL_RE.findall(text):
        cleaned = m.rstrip(".,;:)")
        # strip file extensions picked up from asset URLs
        if not re.search(r"\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$", cleaned, re.I):
            out["email"].add(cleaned)
    return out


def sitemap_urls(base: str) -> list[str]:
    urls: list[str] = []
    for sm in ("/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"):
        html, note = fetch(urljoin(base, sm))
        if note != "ok" or not html:
            continue
        locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", html, re.I)
        # one level of index expansion
        for loc in locs[:40]:
            if loc.lower().endswith(".xml") and len(urls) < 60:
                sub, n2 = fetch(loc)
                if n2 == "ok" and sub:
                    locs2 = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", sub, re.I)
                    urls.extend(u for u in locs2 if any(k in u.lower() for k in config.SITEMAP_KEYWORDS))
            elif any(k in loc.lower() for k in config.SITEMAP_KEYWORDS):
                urls.append(loc)
        if urls:
            break
    seen, out = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out[:12]


# ── Hunter.io (optional) ──────────────────────────────────────────────────
def hunter(domain: str) -> list[tuple[str, float, str]]:
    if not config.HUNTER_API_KEY:
        return []
    try:
        _throttle()
        r = SESSION.get("https://api.hunter.io/v2/domain-search",
                        params={"domain": domain, "api_key": config.HUNTER_API_KEY, "limit": 10},
                        timeout=config.HTTP_TIMEOUT)
        if r.status_code != 200:
            return []
        data = r.json().get("data", {})
        out = []
        for e in data.get("emails", []):
            addr = e.get("value")
            if not addr:
                continue
            conf = float(e.get("confidence") or 0) / 10.0
            out.append((addr, conf, "hunter.io"))
        return out
    except Exception:
        return []


# ── Main pass ─────────────────────────────────────────────────────────────
def candidate_urls(domain: str) -> list[str]:
    base = domain if domain.startswith("http") else f"https://{domain}"
    base = base.rstrip("/")
    urls = [base + p if p != "/" else base + "/" for p in config.HARVEST_PATHS]
    urls += sitemap_urls(base)
    seen, out = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def harvest_agency(row, mx_cache: dict) -> dict:
    name, domain = row["name"], (row["domain"] or "").strip()
    result = {"name": name, "before_status": row["status"], "before_email": row["email"] or "",
              "pages_ok": 0, "pages_tried": 0, "emails": 0, "best": row["email"] or "",
              "status": row["status"], "notes": [], "socials": {}}

    if not domain:
        result["status"] = "NEEDS_DOMAIN"
        result["notes"].append("no domain — web-search and confirm before harvesting")
        return result

    found: dict[str, set] = {k: set() for k in ("email", "telegram", "whatsapp", "instagram", "x", "phone", "flag")}
    scores: dict[str, float] = {}
    sources: dict[str, str] = {}

    for url in candidate_urls(domain):
        result["pages_tried"] += 1
        html, note = fetch(url)
        if note == "robots-disallow":
            result["notes"].append(f"robots blocked {urlparse(url).path or '/'}")
            continue
        if note != "ok" or not html:
            continue
        result["pages_ok"] += 1
        w = page_weight(url)
        got = extract(html, url)
        for k, vals in got.items():
            found[k] |= vals
        for addr in got["email"]:
            s = score_email(addr, domain, w)
            if s > scores.get(addr, -99):
                scores[addr] = s
                sources[addr] = url

    for addr, conf, src in hunter(domain):
        s = score_email(addr, domain, 2.0) + conf
        if s > scores.get(addr, -99):
            scores[addr] = s
            sources[addr] = src
        found["email"].add(addr)

    # Validate and persist every candidate.
    ranked = []
    for addr, s in scores.items():
        if s < 0:
            continue
        dom = addr.split("@", 1)[1]
        ok = has_mx(dom, mx_cache)
        db.add_contact(row["id"], "email", addr, sources.get(addr, ""), s, ok)
        if ok:
            ranked.append((s, addr))
    ranked.sort(reverse=True)
    result["emails"] = len(ranked)

    for kind in ("telegram", "instagram", "x", "whatsapp", "phone"):
        for v in sorted(found[kind]):
            db.add_contact(row["id"], kind, v, domain, 1.0, True)
        if found[kind]:
            result["socials"][kind] = sorted(found[kind])[:3]

    result["notes"].extend(sorted(found["flag"]))

    if ranked:
        result["best"] = ranked[0][1]
        result["status"] = "VERIFIED"
    elif row["email"]:
        result["best"] = row["email"]
        result["status"] = "VERIFIED"
    elif row["form_url"]:
        result["status"] = "FORM_ONLY"
        result["notes"].append("no email found — contact form only")
    else:
        result["status"] = "NEEDS_REVIEW"
        result["notes"].append("no email and no form URL")

    # Persist back to the row.
    updates = {"email": result["best"], "status": result["status"]}
    for col, key in (("telegram", "telegram"), ("instagram", "instagram"), ("x_handle", "x"), ("phone", "phone")):
        if not row[col] and result["socials"].get(key):
            updates[col] = result["socials"][key][0]
    with db.conn() as c:
        sets = ", ".join(f"{k}=?" for k in updates)
        c.execute(f"UPDATE agencies SET {sets}, updated_at=? WHERE id=?",
                  [*updates.values(), datetime.now().isoformat(timespec="seconds"), row["id"]])
    return result


def report(results: list[dict]) -> None:
    w_name = max(12, max((len(r["name"]) for r in results), default=12))
    line = "─" * (w_name + 74)
    print("\n" + line)
    print(f"{'AGENCY':<{w_name}}  {'BEFORE':<12} {'AFTER':<12} {'PAGES':>7} {'MAILS':>5}  BEST CONTACT")
    print(line)
    for r in sorted(results, key=lambda x: (x["status"] != "VERIFIED", x["name"])):
        changed = "→" if r["status"] != r["before_status"] or r["best"] != r["before_email"] else " "
        print(f"{r['name']:<{w_name}}{changed} {r['before_status']:<12} {r['status']:<12} "
              f"{r['pages_ok']:>3}/{r['pages_tried']:<3} {r['emails']:>5}  {r['best'] or '—'}")
        for n in r["notes"][:3]:
            print(f"{'':<{w_name}}   ↳ {n}")
    print(line)
    tally: dict[str, int] = {}
    for r in results:
        tally[r["status"]] = tally.get(r["status"], 0) + 1
    print("  " + " · ".join(f"{k}: {v}" for k, v in sorted(tally.items())))
    newly = [r for r in results if r["status"] == "VERIFIED" and not r["before_email"] and r["best"]]
    if newly:
        print(f"\n  NEW EMAILS FOUND ({len(newly)}):")
        for r in newly:
            print(f"    {r['name']:<{w_name}} {r['best']}")
    print()


def main() -> int:
    ap = argparse.ArgumentParser(description="Harvest contact points for agencies.")
    ap.add_argument("--only", help="comma-separated agency names")
    ap.add_argument("--all", action="store_true", help="include VERIFIED rows (enrichment pass)")
    args = ap.parse_args()

    db.init()
    db.import_csv()
    if not HAVE_DNS:
        print("WARNING: dnspython missing — MX validation disabled.", file=sys.stderr)

    rows = db.all_agencies()
    if args.only:
        wanted = {n.strip().lower() for n in args.only.split(",")}
        rows = [r for r in rows if r["name"].lower() in wanted]
    else:
        rows = [r for r in rows if r["status"] == "HARVEST" or (args.all and r["status"] == "VERIFIED")]
    rows = [r for r in rows if r["status"] != "HOLD"]

    if not rows:
        print("Nothing to harvest.")
        return 0

    print(f"Harvesting {len(rows)} agencies at {config.RATE_LIMIT_SECONDS:.0f} req/s, robots.txt honoured…\n")
    mx_cache: dict[str, bool] = {}
    results = []
    for i, row in enumerate(rows, 1):
        print(f"[{i}/{len(rows)}] {row['name']} ({row['domain'] or 'no domain'})…", flush=True)
        results.append(harvest_agency(row, mx_cache))

    db.export_csv()
    db.export_contacts()
    report(results)
    print(f"  agencies.csv and {config.CONTACTS_CSV.name} updated.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
