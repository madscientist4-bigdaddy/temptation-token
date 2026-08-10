"""
The guardrails. Every hard rule in the spec lives HERE and nowhere else.

Design rule: a guarantee scattered across five call sites is not a guarantee — it is
five places to forget. So no other module is allowed to decide whether a contact may be
emailed, whether a caption is publishable, or whether it is a legal hour to send. They
ask this module, and this module is the only thing the test suite has to prove.

The seven non-negotiables, and where each is enforced:

  1. CAN-SPAM          -> render_footer() + assert_can_spam_ready(); no email body is
                          ever produced without the LLC name, postal address and a
                          working remove instruction. "remove" is honoured permanently
                          by db.suppress().
  2. Never auto-DM /   -> CHANNEL_POLICY. Only EMAIL is 'auto'. dm_copilot and the
     never auto-post      promo writers physically have no send function to call.
  3. Never OnlyFans    -> caption_violations() rejects any mention, in captions AND in
                          outbound email bodies.
  4. #ad + no price    -> caption_violations() requires the disclosure and rejects
     /earnings claims     price, ROI, and earnings claims.
  5. Blocklist         -> is_blocked(), consulted by can_contact() which the sender must
                          call for every single target, every single time.
  6. One identity      -> assert_sender_identity() pins the From address to the
                          configured partnerships address.
  7. Legal-first "yes" -> YES_PATH_GATE, injected into every positive-reply draft so the
                          attorney rider precedes anything going live.

Nothing here reaches the network, so all of it is cheap to unit-test.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# ── 1. Sending window + volume ───────────────────────────────────────────────
SEND_TZ = ZoneInfo("America/New_York")
SEND_START = time(9, 0)
SEND_END = time(16, 0)
WEEK1_DAILY_CAP = 15
STEADY_DAILY_CAP = 25

# ── 2. Channel policy. Read this as the answer to "may software press send?" ──
# Email is CAN-SPAM territory: legal to automate for B2B with the required footer.
# Every social channel forbids automated unsolicited DMs in its ToS, so the system is
# built so that pressing send there is a human action. There is no DM send function
# anywhere in this codebase — that is the enforcement, not a flag.
CHANNEL_POLICY = {
    "email": "auto",
    "instagram": "assisted-manual",
    "x": "assisted-manual",
    "telegram": "assisted-manual",
    "whatsapp": "assisted-manual",
    "form": "assisted-manual",
    "phone": "assisted-manual",
    "fedex": "assisted-manual",
}


def may_automate(channel: str) -> bool:
    """True only for channels we are permitted to send on without a human."""
    return CHANNEL_POLICY.get(channel.lower()) == "auto"


def assert_manual_only(channel: str) -> None:
    if may_automate(channel):
        return
    # Called defensively at the top of anything that could be mistaken for a sender.
    raise PermissionError(
        f"{channel} is assisted-manual only (platform ToS). "
        "Generate the text and a deep link; a human presses send."
    )


# ── 3. Content rules ─────────────────────────────────────────────────────────
#
# Two audiences, two rule sets. Collapsing them into one filter is wrong in both
# directions, so they are separate functions:
#
#   PUBLIC PROMO CAPTION (a creator posts it to IG/X)
#     - must not name the subscription platform: it is against that platform's
#       promotional rules and it drags the creator's own account into the exposure
#     - must carry #ad (FTC endorsement disclosure)
#     - must make no price/earnings claim of any kind
#
#   B2B EMAIL (private, to an agency's business inbox)
#     - naming the platform is a SELLING POINT — "nothing ever posts on OnlyFans
#       itself" is the reassurance the agency actually wants, and suppressing it makes
#       the pitch worse and less honest
#     - stating commercial terms ($2,500 pool, 50% revenue share) is ordinary
#       contracting language, not an earnings claim
#     - what stays banned is TOKEN speculation: price targets, market cap, APY,
#       guaranteed returns, "10x". That is the thing that creates securities and
#       advertising exposure, and it has no place in a partnership pitch.
#
# Spelled variants are included below because "0nlyfans" is the obvious way around a
# naive check.
_PLATFORM_BAN = re.compile(
    r"\b(only\s*fans|onlyfans|0nlyfans|0nly\s*fans|o\W?n\W?l\W?y\W?f\W?a\W?n\W?s|of\.com|onlyf)\b",
    re.IGNORECASE,
)

# Any claim that a reader could act on financially. Deliberately broad: a false positive
# costs one rewritten caption, a false negative is an unregistered securities-flavoured
# earnings claim attached to a token.
_MONEY_CLAIM = re.compile(
    r"("
    r"\$\s?\d"                                  # $5, $ 100
    r"|\b\d+(?:\.\d+)?\s*(?:usd|usdc|eth|cents?)\b"
    r"|\bprice\s+(?:target|prediction|will|going)\b"
    r"|\b(?:worth|valued?\s+at|market\s+cap)\b"
    r"|\b\d+\s*x\b"                             # 10x
    r"|\b(?:moon|pump|guaranteed|passive\s+income|get\s+rich)\b"
    r"|\bearn\s+(?:up\s+to\s+)?\$?\d"
    r"|\b\d+\s*%\s*(?:apy|apr|returns?|gains?|profit)"
    r"|\b(?:roi|returns?)\s+of\b"
    r")",
    re.IGNORECASE,
)

_AD_DISCLOSURE = re.compile(r"(^|\s)#ad\b", re.IGNORECASE)


@dataclass(frozen=True)
class Violation:
    rule: str
    detail: str

    def __str__(self) -> str:  # pragma: no cover - formatting only
        return f"[{self.rule}] {self.detail}"


# Token speculation. Narrower than _MONEY_CLAIM on purpose: this is what may never
# appear even in private B2B copy, because it is the securities/advertising-exposure
# language, not ordinary deal terms.
_TOKEN_SPECULATION = re.compile(
    r"("
    r"\bprice\s+(?:target|prediction|will|going|forecast)\b"
    r"|\bmarket\s*cap\b"
    r"|\b\d+\s*x\b"
    r"|\b(?:to\s+the\s+)?moon\b|\bpump\b|\bget\s+rich\b|\bpassive\s+income\b"
    r"|\bguaranteed\s+(?:returns?|profit|gains?|income)\b"
    r"|\b\d+\s*%\s*(?:apy|apr|returns?|gains?|profit)"
    r"|\b(?:roi|returns?)\s+of\s+\d"
    r"|\btoken\s+(?:will|going\s+to)\s+(?:rise|moon|increase)"
    r")",
    re.IGNORECASE,
)


def caption_violations(text: str, *, require_ad: bool = True) -> list[Violation]:
    """
    Every reason a PUBLIC PROMO CAPTION may not ship. Empty list == publishable.
    This is the strict filter: platform name, any money claim, and #ad.
    """
    out: list[Violation] = []

    m = _PLATFORM_BAN.search(text)
    if m:
        out.append(Violation("PLATFORM", f"names the subscription platform: {m.group(0)!r}"))

    m = _MONEY_CLAIM.search(text)
    if m:
        out.append(Violation("MONEY_CLAIM", f"price/earnings claim: {m.group(0)!r}"))

    if require_ad and not _AD_DISCLOSURE.search(text):
        out.append(Violation("FTC", "missing #ad disclosure"))

    return out


def email_body_violations(text: str) -> list[Violation]:
    """
    Every reason an outbound B2B EMAIL may not ship.

    Intentionally permits what caption_violations() rejects: naming the platform (the
    "nothing ever posts on OnlyFans itself" reassurance) and stating commercial terms
    ("$2,500 pool", "keeps 50%"). Those are the pitch. Token speculation is still out.
    """
    out: list[Violation] = []
    m = _TOKEN_SPECULATION.search(text)
    if m:
        out.append(Violation("TOKEN_SPECULATION", f"speculative claim: {m.group(0)!r}"))
    return out


def assert_publishable(text: str, *, require_ad: bool = True) -> None:
    v = caption_violations(text, require_ad=require_ad)
    if v:
        raise ValueError("caption rejected:\n  " + "\n  ".join(str(x) for x in v))


def assert_email_sendable(text: str) -> None:
    v = email_body_violations(text)
    if v:
        raise ValueError("email rejected:\n  " + "\n  ".join(str(x) for x in v))


# ── 4. Blocklist ─────────────────────────────────────────────────────────────
def load_blocklist(path: Path | None = None) -> list[str]:
    p = path or (DATA_DIR / "blocklist.txt")
    if not p.exists():
        # Fail CLOSED. A missing blocklist must never read as "nobody is blocked".
        raise FileNotFoundError(
            f"blocklist missing at {p} — refusing to run without it (fail-closed)"
        )
    return [
        ln.strip().lower()
        for ln in p.read_text(encoding="utf-8").splitlines()
        if ln.strip() and not ln.lstrip().startswith("#")
    ]


def is_blocked(*fields: str | None, blocklist: list[str] | None = None) -> str | None:
    """
    Substring match across every identifying field of a target (name, domain, email,
    handles). Returns the matched blocklist term, or None.

    Substring rather than exact because the list mixes domains ("moxymgt.com") with bare
    brand names ("contentx"), and a brand can appear as a handle, a subdomain, or the
    right-hand side of an email address.
    """
    bl = blocklist if blocklist is not None else load_blocklist()
    hay = " ".join(f.lower() for f in fields if f)
    hay_compact = re.sub(r"[^a-z0-9.]+", "", hay)
    for term in bl:
        if term in hay or re.sub(r"[^a-z0-9.]+", "", term) in hay_compact:
            return term
    return None


# ── 5. Contactability: the single question the sender must ask ───────────────
CONTACTABLE_STATES = {"NEW", "QUEUED", "CONTACTED", "NO_REPLY", "NURTURE"}
TERMINAL_STATES = {"SUPPRESSED", "REPLIED", "CALL_BOOKED", "PILOT"}


def can_contact(target: dict, *, blocklist: list[str] | None = None) -> tuple[bool, str]:
    """
    (allowed, reason). The reason is always populated so the log explains itself.

    `target` is a row dict from the agencies table.
    """
    hit = is_blocked(
        target.get("name"),
        target.get("domain"),
        target.get("email"),
        target.get("instagram"),
        target.get("x_handle"),
        target.get("telegram"),
        blocklist=blocklist,
    )
    if hit:
        return False, f"BLOCKLIST match on {hit!r}"

    state = (target.get("state") or "NEW").upper()
    if state == "SUPPRESSED":
        return False, "SUPPRESSED (opted out — permanent)"
    if state == "REPLIED":
        return False, "REPLIED — sequence halted, human owns it"
    if state in ("CALL_BOOKED", "PILOT"):
        return False, f"{state} — past outreach stage"

    if (target.get("status") or "").upper() == "HOLD":
        return False, "status=HOLD (tier 3 — awaiting case study)"

    return True, "ok"


# ── 6. Time + volume gate ────────────────────────────────────────────────────
def in_send_window(now: datetime | None = None) -> tuple[bool, str]:
    n = (now or datetime.now(SEND_TZ)).astimezone(SEND_TZ)
    if n.weekday() > 4:
        return False, f"{n:%A} — weekends are not send days"
    if not (SEND_START <= n.time() <= SEND_END):
        return False, f"{n:%H:%M} ET outside {SEND_START:%H:%M}–{SEND_END:%H:%M} ET"
    return True, f"{n:%a %H:%M} ET — inside window"


def daily_cap(campaign_started: datetime | None, now: datetime | None = None) -> int:
    """15/day for the first 7 days of the campaign, 25/day after. Warms the domain."""
    if campaign_started is None:
        return WEEK1_DAILY_CAP
    n = (now or datetime.now(SEND_TZ)).astimezone(SEND_TZ)
    started = campaign_started.astimezone(SEND_TZ)
    return WEEK1_DAILY_CAP if (n - started).days < 7 else STEADY_DAILY_CAP


# ── 7. Identity + CAN-SPAM ───────────────────────────────────────────────────
def assert_sender_identity(from_email: str, configured: str) -> None:
    """Everything goes out as Blockchain Entertainment LLC / the TTS partnerships box."""
    if (from_email or "").strip().lower() != (configured or "").strip().lower():
        raise PermissionError(
            f"refusing to send as {from_email!r}; this system sends only as {configured!r}"
        )


LEGAL_ENTITY = "Blockchain Entertainment LLC"
REMOVE_WORDS = ("remove", "unsubscribe", "stop", "opt out", "opt-out", "not interested")


def assert_can_spam_ready(body: str, mail_addr: str) -> None:
    """
    A rendered email is only allowed out if a regulator reading it would find the three
    things CAN-SPAM requires: who sent it, where they physically are, and how to stop it.
    """
    problems = []
    if LEGAL_ENTITY.lower() not in body.lower():
        problems.append(f"missing legal entity name ({LEGAL_ENTITY})")
    if not mail_addr or mail_addr.strip() in ("", "TODO", "CHANGEME"):
        problems.append("MAIL_ADDR is not configured — a real postal address is required")
    elif mail_addr.strip().lower() not in body.lower():
        problems.append("postal address missing from body")
    if not any(w in body.lower() for w in ("reply \"remove\"", "reply 'remove'", "remove")):
        problems.append("missing opt-out instruction")
    if problems:
        raise ValueError("CAN-SPAM check failed: " + "; ".join(problems))


def is_optout(text: str) -> bool:
    """Does an inbound reply ask us to stop? Matched generously and honoured forever."""
    t = (text or "").lower()
    return any(w in t for w in REMOVE_WORDS)


def unsubscribe_headers(from_email: str) -> dict[str, str]:
    return {
        "List-Unsubscribe": f"<mailto:{from_email}?subject=remove>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }


# ── 8. The "yes" path always routes through counsel ──────────────────────────
YES_PATH_GATE = (
    "Before anything goes live: my attorney's content-licensing + model-consent + "
    "FTC #ad disclosure rider has to be signed first. After that you pick 3–5 creators "
    "and we load their profiles."
)

# First touch carries no attachment — attachments from an unknown sender are the single
# fastest way into spam. The one-pager is always a link.
FIRST_TOUCH_ALLOWS_ATTACHMENTS = False


def assert_no_attachments(step: int, attachments: list | None) -> None:
    if step <= 1 and attachments:
        raise ValueError(
            "no attachments on first touch — link the one-pager instead "
            "(attachments wreck cold deliverability)"
        )
