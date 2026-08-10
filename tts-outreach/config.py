"""Central configuration. Everything tunable lives here or in .env."""
from __future__ import annotations

import os
from datetime import time
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
TEMPLATES = ROOT / "templates"
DRAFTS = ROOT / "drafts"
LOGS = ROOT / "logs"
OUTBOX = ROOT / "outbox"
DB_PATH = ROOT / "state.db"

AGENCIES_CSV = DATA / "agencies.csv"
BLOCKLIST_TXT = DATA / "blocklist.txt"
CONTACTS_CSV = DATA / "contacts_found.csv"
FEDEX_CSV = DATA / "fedex_list.csv"

for _d in (DATA, TEMPLATES, DRAFTS, LOGS, OUTBOX):
    _d.mkdir(parents=True, exist_ok=True)


def load_env(path: Path | None = None) -> None:
    """Minimal .env loader. Real environment always wins over the file."""
    path = path or (ROOT / ".env")
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        os.environ.setdefault(k, v)


load_env()


def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def env_bool(key: str, default: bool) -> bool:
    raw = env(key, "").lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    return default


# ── Identity / credentials ────────────────────────────────────────────────
FROM_ADDR = env("FROM_ADDR")
FROM_NAME = env("FROM_NAME", "Jim Goetz")

# ── Proton Mail Bridge ────────────────────────────────────────────────────
# Proton exposes no public SMTP/IMAP. Mail goes through the Proton Mail Bridge desktop
# app, which decrypts locally and serves ordinary mail protocols on loopback. Both ports
# use STARTTLS against a self-signed certificate — see bridge.py for why verification is
# disabled for loopback only.
#
# PROTON_BRIDGE_PW is the password **Bridge generates**, not the Proton account password.
# The account password authenticates Bridge to Proton; this one authenticates us to Bridge.
#
# SMTP_USER/SMTP_PASS remain as fallbacks so an existing .env keeps working, but the
# Proton names are canonical and what the wizard writes.
SMTP_HOST = env("SMTP_HOST", "127.0.0.1")
SMTP_PORT = int(env("SMTP_PORT", "1025"))
IMAP_HOST = env("IMAP_HOST", "127.0.0.1")
IMAP_PORT = int(env("IMAP_PORT", "1143"))
SMTP_USER = env("PROTON_SMTP_USER") or env("SMTP_USER") or FROM_ADDR
SMTP_PASS = env("PROTON_BRIDGE_PW") or env("SMTP_PASS")

# Bridge is a local app, but Proton still throttles the account behind it (~100/hour).
# Our cap is 15–25/day so we are nowhere near it; the pause is simple politeness and
# keeps a burst from looking like automation to Proton's own rate limiter.
SEND_DELAY_SECONDS = float(env("SEND_DELAY_SECONDS", "3"))

HUNTER_API_KEY = env("HUNTER_API_KEY")

CALENDLY = env("CALENDLY", "https://calendly.com/REPLACE-ME")
LOOM = env("LOOM", "https://www.loom.com/share/REPLACE-ME")
MAIL_ADDR = env("MAIL_ADDR", "REPLACE-ME")

# ── Safety ────────────────────────────────────────────────────────────────
# Default ON. Nothing leaves the machine until this is explicitly false.
DRY_RUN = env_bool("DRY_RUN", True)

# ── Sending window / volume ───────────────────────────────────────────────
ET = ZoneInfo("America/New_York")
SEND_DAYS = {0, 1, 2, 3, 4}           # Mon-Fri
SEND_START = time(9, 0)
SEND_END = time(16, 0)
CAP_WEEK_ONE = int(env("CAP_WEEK_ONE", "15"))
CAP_AFTER = int(env("CAP_AFTER", "25"))
WEEK_ONE_DAYS = 7

# ── Sequence cadence (days from enrollment) ───────────────────────────────
# Exactly as specified: D0/D1/D4 email, D3 DM, D7 FedEx, D12 nurture.
#
# NOTE: email_3 is the breakup ("closing conversations this week") yet the
# FedEx and nurture steps land AFTER it, which reads oddly to a recipient who
# was just told you were closing out. Widening to D0/D4/D10 for the emails
# fixes that and is a one-line change here. Left at your spec by default.
CADENCE = {
    "EMAIL_1": 0,
    "EMAIL_2": 1,
    "DM": 3,
    "EMAIL_3": 4,
    "FEDEX": 7,
    "NURTURE": 12,
}
EMAIL_STEPS = {"EMAIL_1": "email_1.txt", "EMAIL_2": "email_2.txt", "EMAIL_3": "email_3.txt"}

# ── HTTP ──────────────────────────────────────────────────────────────────
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
HTTP_TIMEOUT = 10
RATE_LIMIT_SECONDS = 1.0

HARVEST_PATHS = [
    "/", "/contact", "/contact-us", "/about", "/about-us",
    "/privacy", "/privacy-policy", "/terms",
    "/imprint", "/impressum", "/legal",
]
# Privacy/terms/imprint pages carry a real, human-monitored address far more
# often than /contact does — that is how vic.nova@topstarmgmt.com surfaced.
PAGE_WEIGHTS = {
    "privacy": 3.0, "terms": 3.0, "imprint": 3.5, "impressum": 3.5, "legal": 3.0,
    "contact": 2.0, "about": 1.5,
}
SITEMAP_KEYWORDS = ("contact", "about", "privacy", "legal", "imprint")

# ── Statuses ──────────────────────────────────────────────────────────────
CONTACTABLE = {"VERIFIED", "FORM_ONLY"}
TERMINAL = {"REPLIED", "SUPPRESSED", "HOLD", "BLOCKED", "NEEDS_REVIEW"}
