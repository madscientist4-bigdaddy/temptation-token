"""
Pulling contact details out of HTML, and deciding which of them is worth using.

Two pieces of hard-won knowledge are encoded here:

1. Legal pages beat contact pages. A /contact page usually hosts a form and, at best,
   info@. The privacy policy, terms and (in the EU) the Impressum are written by a
   lawyer who has to name a real accountable human — which is how a real named mailbox
   was found for TopStar. PAGE_WEIGHT encodes that, and ranking multiplies by it.

2. Addresses are obfuscated far more often than they are missing. "name [at] domain
   [dot] com", entity-encoded, or reversed-CSS. The deobfuscation pass runs before
   extraction so those turn into ordinary addresses.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field

# Pages we try on every domain, best-signal first.
CANDIDATE_PATHS = [
    "/", "/contact", "/contact-us", "/about", "/about-us",
    "/privacy", "/privacy-policy", "/terms", "/terms-of-service",
    "/imprint", "/impressum", "/legal", "/legal-notice",
]

# Multiplier applied to a contact's score based on where it was found.
PAGE_WEIGHT = {
    "impressum": 3.0, "imprint": 3.0, "legal": 2.6, "legal-notice": 2.6,
    "privacy": 2.4, "privacy-policy": 2.4, "terms": 2.2, "terms-of-service": 2.2,
    "contact": 1.6, "contact-us": 1.6, "about": 1.2, "about-us": 1.2,
    "": 1.0,
}


def page_weight(url: str) -> float:
    seg = url.rstrip("/").rsplit("/", 1)[-1].lower().split("?")[0]
    return PAGE_WEIGHT.get(seg, 1.0)


# ── Deobfuscation ────────────────────────────────────────────────────────────
_AT = r"(?:@|\s*\[\s*at\s*\]\s*|\s*\(\s*at\s*\)\s*|\s+at\s+|\s*&#64;\s*|\s*%40\s*)"
_DOT = r"(?:\.|\s*\[\s*dot\s*\]\s*|\s*\(\s*dot\s*\)\s*|\s+dot\s+|\s*&#46;\s*)"

_OBFUSCATED = re.compile(
    rf"([A-Za-z0-9._%+-]+){_AT}([A-Za-z0-9-]+(?:{_DOT}[A-Za-z0-9-]+)*){_DOT}([A-Za-z]{{2,24}})",
    re.IGNORECASE,
)


def deobfuscate(text: str) -> str:
    """Rewrite obfuscated addresses into plain ones, then let the normal regex find them."""
    text = html.unescape(text)

    def _fix(m: re.Match) -> str:
        user, domain, tld = m.group(1), m.group(2), m.group(3)
        domain = re.sub(_DOT, ".", domain, flags=re.IGNORECASE)
        return f"{user}@{domain}.{tld}"

    return _OBFUSCATED.sub(_fix, text)


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}")
MAILTO_RE = re.compile(r"mailto:([^\"'?>\s]+)", re.IGNORECASE)
TEL_RE = re.compile(r"tel:([+0-9().\-\s]{7,})", re.IGNORECASE)
TG_RE = re.compile(r"(?:https?://)?(?:t\.me|telegram\.me)/([A-Za-z0-9_]{4,32})", re.IGNORECASE)
WA_RE = re.compile(r"(?:https?://)?(?:wa\.me|api\.whatsapp\.com/send\?phone=)/?([+0-9]{7,20})", re.IGNORECASE)
IG_RE = re.compile(r"(?:https?://)?(?:www\.)?instagram\.com/([A-Za-z0-9_.]{2,30})", re.IGNORECASE)
X_RE = re.compile(r"(?:https?://)?(?:www\.)?(?:x|twitter)\.com/([A-Za-z0-9_]{2,15})", re.IGNORECASE)

# Handles that are the platform's own pages, not the agency's.
_HANDLE_NOISE = {
    "share", "explore", "p", "reel", "reels", "stories", "accounts", "about", "home",
    "privacy", "legal", "tos", "intent", "hashtag", "i", "search", "login", "signup",
    "direct", "developer", "settings", "help", "web",
    # Site-builder and template badges. These link to the BUILDER's socials, not the
    # agency's — Pure Angels picked up "bolt" this way on the first run.
    "bolt", "wix", "wixcom", "squarespace", "webflow", "shopify", "framer",
    "elementor", "wordpress", "godaddy", "vercel", "netlify", "canva", "linktree",
}

# Addresses that are never a human at the agency.
_EMAIL_NOISE = re.compile(
    r"(sentry|wixpress|example\.|yourdomain|domain\.com|email\.com|@2x|\.png|\.jpg|\.jpeg|"
    r"\.gif|\.svg|\.webp|\.css|\.js|godaddy|squarespace|wordpress|cloudflare|"
    r"no-?reply|donotreply|abuse@|postmaster@|webmaster@|hostmaster@)",
    re.IGNORECASE,
)

ROLE_PREFIXES = ("info", "office", "contact", "hello", "hi", "team", "admin", "mail",
                 "support", "help", "sales", "booking", "management", "partnerships",
                 "press", "billing", "career", "careers", "jobs", "legal", "privacy")


@dataclass
class Candidate:
    email: str
    source_url: str
    score: float = 0.0
    mx_ok: bool | None = None
    notes: list[str] = field(default_factory=list)


def _valid_syntax(addr: str) -> bool:
    if not EMAIL_RE.fullmatch(addr):
        return False
    if _EMAIL_NOISE.search(addr):
        return False
    local, _, dom = addr.partition("@")
    if len(local) > 64 or len(addr) > 254 or ".." in addr:
        return False
    # A TLD that is only digits is an IP fragment picked out of a stylesheet.
    return not dom.rsplit(".", 1)[-1].isdigit()


def extract_emails(text: str, url: str) -> list[Candidate]:
    clean = deobfuscate(text)
    found: dict[str, Candidate] = {}
    for raw in list(MAILTO_RE.findall(clean)) + list(EMAIL_RE.findall(clean)):
        addr = raw.strip().strip(".,;:").lower()
        addr = addr.split("?")[0]
        if not _valid_syntax(addr):
            continue
        if addr not in found:
            found[addr] = Candidate(email=addr, source_url=url)
    return list(found.values())


def extract_socials(text: str, url: str) -> dict[str, str]:
    out: dict[str, str] = {}

    def first(rx: re.Pattern, key: str) -> None:
        for m in rx.findall(text):
            h = m.strip().strip("/").lower()
            if h and h not in _HANDLE_NOISE:
                out[key] = h
                return

    first(TG_RE, "telegram")
    first(IG_RE, "instagram")
    first(X_RE, "x_handle")
    for m in TEL_RE.findall(text):
        digits = re.sub(r"[^\d+]", "", m)
        if len(re.sub(r"\D", "", digits)) >= 7:
            out["phone"] = digits
            break
    for m in WA_RE.findall(text):
        out["whatsapp"] = re.sub(r"[^\d+]", "", m)
        break
    return out


def score(cand: Candidate, agency_domain: str) -> float:
    """
    Higher is better. firstname@ / first.last@ beats office@/info@ beats support@,
    then multiplied by where it was found (legal pages win).
    """
    local, _, dom = cand.email.partition("@")
    s = 1.0

    on_domain = bool(agency_domain) and (
        dom == agency_domain.lower() or dom.endswith("." + agency_domain.lower())
    )
    if on_domain:
        s += 4.0
        cand.notes.append("on-domain")
    elif dom in ("gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "protonmail.com"):
        s += 1.0
        cand.notes.append("free mailbox")

    base = local.split("+")[0]
    if re.fullmatch(r"[a-z]{2,}\.[a-z]{2,}", base):            # first.last@
        s += 5.0
        cand.notes.append("first.last")
    elif base in ROLE_PREFIXES:
        s += {"office": 2.5, "info": 2.0, "contact": 2.0, "hello": 2.0,
              "partnerships": 3.0, "management": 2.5, "team": 1.8}.get(base, 0.8)
        cand.notes.append(f"role:{base}")
    elif re.fullmatch(r"[a-z]{3,20}", base):                    # firstname@
        s += 4.0
        cand.notes.append("firstname")
    else:
        s += 1.0

    if base in ("support", "help", "billing", "careers", "jobs", "press"):
        s -= 1.5
        cand.notes.append("low-value role")

    s *= page_weight(cand.source_url)
    cand.score = round(s, 2)
    return cand.score


_MX_CACHE: dict[str, bool] = {}


def mx_ok(domain: str, timeout: float = 5.0) -> bool:
    """Does the domain actually accept mail? Cached; a resolver failure reads as False."""
    d = domain.lower().strip()
    if d in _MX_CACHE:
        return _MX_CACHE[d]
    ok = False
    try:
        import dns.resolver

        res = dns.resolver.Resolver()
        res.lifetime = timeout
        res.timeout = timeout
        try:
            ok = len(res.resolve(d, "MX")) > 0
        except Exception:
            # Some small hosts run mail on the A record with no MX. RFC 5321 allows it.
            try:
                ok = len(res.resolve(d, "A")) > 0
            except Exception:
                ok = False
    except ImportError:
        ok = True  # dnspython absent: do not silently drop every candidate
    _MX_CACHE[d] = ok
    return ok


def best(cands: list[Candidate], agency_domain: str, *, check_mx: bool = True) -> Candidate | None:
    for c in cands:
        score(c, agency_domain)
    ranked = sorted(cands, key=lambda c: c.score, reverse=True)
    for c in ranked:
        if check_mx:
            c.mx_ok = mx_ok(c.email.partition("@")[2])
            if not c.mx_ok:
                c.notes.append("no MX")
                continue
        return c
    return None
