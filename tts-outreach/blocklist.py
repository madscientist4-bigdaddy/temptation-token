"""Blocklist matching. Fail CLOSED: if we cannot read the list, nothing sends."""
from __future__ import annotations

import difflib
import re
import sys
from functools import lru_cache

import config

FUZZ_THRESHOLD = 0.86


def _normalize(s: str) -> str:
    """Lowercase, strip scheme/www/TLD and every non-alphanumeric character, so
    'Ash Agency', ash-agency.com and https://www.ashagency.io/ all collapse to
    'ashagency'."""
    s = (s or "").strip().lower()
    s = re.sub(r"^[a-z]+://", "", s)
    s = re.sub(r"^www\.", "", s)
    s = s.split("/")[0]
    s = re.sub(r"\.(com|net|org|io|co|co\.uk|agency|xyz|app|me|tv|biz|info|us|eu|de|nl)$", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


@lru_cache(maxsize=1)
def entries() -> tuple[str, ...]:
    if not config.BLOCKLIST_TXT.exists():
        print(f"FATAL: blocklist missing at {config.BLOCKLIST_TXT}; refusing to send.", file=sys.stderr)
        raise SystemExit(2)
    out = []
    for line in config.BLOCKLIST_TXT.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        # tolerate the comma-separated form the spec was written in
        for part in line.split(","):
            part = part.strip()
            if part:
                out.append(_normalize(part))
    return tuple(sorted(set(filter(None, out))))


def check(*candidates: str) -> tuple[bool, str]:
    """Return (blocked, reason). Any candidate matching any entry blocks."""
    blocked_on = entries()
    for raw in candidates:
        if not raw:
            continue
        norm = _normalize(raw)
        if not norm:
            continue
        for e in blocked_on:
            if norm == e:
                return True, f"'{raw}' exactly matches blocklist entry '{e}'"
            if e in norm or norm in e:
                return True, f"'{raw}' contains/is contained by blocklist entry '{e}'"
            ratio = difflib.SequenceMatcher(None, norm, e).ratio()
            if ratio >= FUZZ_THRESHOLD:
                return True, f"'{raw}' fuzzy-matches '{e}' at {ratio:.2f}"
    return False, ""


def check_agency(row) -> tuple[bool, str]:
    """Check an agency row across name, domain and the email's domain."""
    email_domain = ""
    if row["email"] and "@" in row["email"]:
        email_domain = row["email"].split("@", 1)[1]
    return check(row["name"], row["domain"] or "", email_domain)


if __name__ == "__main__":
    print(f"{len(entries())} blocklist entries: {', '.join(entries())}\n")
    for probe in sys.argv[1:] or ["moxymgt.com", "Ash Agency", "ash-agency.io",
                                  "Content X", "AROA", "aroaagency.com", "Siren Agency LLC"]:
        blocked, why = check(probe)
        print(f"  {'BLOCK ' if blocked else 'allow '} {probe:<24} {why}")
