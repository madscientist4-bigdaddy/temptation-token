"""
Compliance rule engine for every piece of promo copy this toolkit produces.

This is the load-bearing module. Every generator routes 100% of its output through
`enforce()` before anything reaches disk, and `enforce()` RAISES rather than warns. A
linter that only warns is decorative — the whole point is that non-compliant copy cannot
be produced, not that someone notices afterwards.

The rules, from the brief:
  · "#ad" on every promotional caption or story overlay (FTC material-connection
    disclosure — a creator promoting a brand she has a relationship with must disclose).
  · Zero price or earnings claims. This is the one that carries real regulatory risk:
    $TTS is a digital asset, and "you'll make X" or "it's going to Y" is exactly the
    shape regulators and platforms treat as an unregistered financial promotion.
  · Never reference OnlyFans — brand-association and platform-ToS risk.
  · Link-only. Never instruct anyone to post the vote link ON OnlyFans.
  · SFW. The contest itself is clothed/SFW; the promo copy has to match.

Nothing here is legal advice. It encodes the constraints the operator specified and
catches the obvious violations — it is a seatbelt, not a compliance department. Anything
novel a human writes still needs a human's judgement.

Self-test:  python3 promo/compliance.py
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field

# The disclosure that must appear on promotional copy.
AD_TAG = "#ad"

# Pinned to the top of every generated artifact so the rule travels with the file.
COMPLIANCE_LINE = (
    "#ad required · no price/earnings claims · link only, never posted on OnlyFans."
)


@dataclass(frozen=True)
class Rule:
    """One banned pattern and a human explanation of why it is banned."""
    name: str
    pattern: str
    why: str
    flags: int = re.IGNORECASE


# ── Banned patterns ───────────────────────────────────────────────────────────
# Written to be specific. An over-broad rule that fires on innocent copy trains people
# to bypass the checker, which is worse than no checker.
BANNED: list[Rule] = [
    # -- Platform / brand association -----------------------------------------
    Rule("onlyfans",
         r"\bonly\s*[-_.]?\s*f[a4@]ns?\b|\bo\.?f\.?\s+(page|link|content)\b|\b0nlyfans\b",
         "Never reference OnlyFans — brand-association and platform-ToS risk."),

    # -- Price / market claims -------------------------------------------------
    Rule("price_claim",
         r"\b(price|pric(ed|ing)|market\s*cap|mcap|all[-\s]?time\s*high|\bath\b|"
         r"to\s+the\s+moon|moon(ing|shot)?|pump(ing|ed)?|dip|bull\s*run|"
         r"\d+\s*x\b|(?<![&#\w])x\d+\b)",
         "No price or market claims — this is a digital asset, not a stock tip."),
    # note: the "x\\d+" half is guarded with (?<![&#\\w]) so HTML entities like &#x27;
    # (an escaped apostrophe, which appears in every generated .html) do not read as "x27".

    # -- Earnings / return claims ---------------------------------------------
    Rule("earnings_claim",
         r"\b(earn(ing|ings|s)?|profit(s|able)?|\broi\b|\bapr\b|\bapy\b|yield|"
         r"passive\s+income|make\s+(money|bank|\$)|get\s+rich|financial\s+freedom|"
         r"guaranteed|life[-\s]?changing\s+money|cash\s+out|payday)\b",
         "No earnings claims — cannot promise or imply what anyone will make."),

    # -- Investment framing ----------------------------------------------------
    Rule("investment_framing",
         r"\b(invest(ing|ment|ors?)?|buy\s+now|don'?t\s+miss\s+out|early\s+in|"
         r"financial\s+advice|portfolio|hodl)\b",
         "No investment framing — promoting a contest, not soliciting investment."),

    # -- Concrete money amounts ------------------------------------------------
    # "$TTS" is the ticker and must stay legal; "$500" is a claim.
    Rule("money_amount",
         r"\$\s*\d|\b\d[\d,.]*\s*(usd|dollars?)\b|\b\d[\d,.]*\s*%\s*(return|gain|apr|apy)",
         "No concrete money amounts — reads as an earnings claim."),

    # -- NSFW ------------------------------------------------------------------
    Rule("nsfw",
         r"\b(nude|nudes|naked|nsfw|xxx|porn(o|hub)?|explicit|topless|strip(ping|per|tease)?|"
         r"lingerie\s+shoot|sexy\s+time|hook\s*up)\b",
         "Contest is SFW/clothed — promo copy must match."),

    # -- Instructing where to post --------------------------------------------
    Rule("post_on_of",
         r"post\s+(this|it|the\s+link)\s+(on|to)\s+(your\s+)?(only|o\.?f)",
         "Link-only: never instruct posting the vote link on OnlyFans."),
]


@dataclass
class Violation:
    rule: str
    why: str
    match: str
    where: str


@dataclass
class Report:
    violations: list[Violation] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.violations

    def __str__(self) -> str:
        if self.ok:
            return "compliant"
        return "\n".join(
            f"  [{v.rule}] {v.where}\n      matched: {v.match!r}\n      why: {v.why}"
            for v in self.violations
        )


def check(text: str, where: str = "copy") -> Report:
    """Scan one string. Never raises — use enforce() when you want a hard stop."""
    rep = Report()
    for rule in BANNED:
        for m in re.finditer(rule.pattern, text or "", rule.flags):
            rep.violations.append(Violation(rule.name, rule.why, m.group(0), where))
    return rep


def check_promo(text: str, vote_link: str | None = None, where: str = "caption") -> Report:
    """
    A promotional caption or overlay: banned-pattern scan PLUS the positive requirements.
    """
    rep = check(text, where)
    if AD_TAG not in (text or "").lower():
        rep.violations.append(Violation(
            "missing_ad_tag", "Every promotional caption must carry #ad.", "(absent)", where))
    if vote_link and vote_link not in (text or ""):
        rep.violations.append(Violation(
            "missing_vote_link", "Promo copy must carry her vote link.", "(absent)", where))
    return rep


class ComplianceError(RuntimeError):
    pass


def enforce(text: str, vote_link: str | None = None, where: str = "copy",
            promo: bool = True) -> str:
    """
    Gate every generated string through this. Raises ComplianceError on any violation, so
    a non-compliant pack cannot be written to disk. Returns the text unchanged when clean.
    """
    rep = check_promo(text, vote_link, where) if promo else check(text, where)
    if not rep.ok:
        raise ComplianceError(
            f"Refusing to generate non-compliant copy ({where}):\n{rep}\n\n  text: {text!r}"
        )
    return text


# ── Self-test ─────────────────────────────────────────────────────────────────
# These are the cases the engine exists to catch. If any regress, the toolkit is unsafe.
_MUST_FAIL = [
    ("earnings", "Vote for me and earn big! #ad https://x"),
    ("price", "$TTS is going to the moon 🚀 #ad https://x"),
    ("multiplier", "This could 100x #ad https://x"),
    ("onlyfans", "Link in bio, also on my OnlyFans #ad https://x"),
    ("onlyfans_spaced", "check my only fans #ad https://x"),
    ("money", "I made $500 last week #ad https://x"),
    ("nsfw", "nudes for voters #ad https://x"),
    ("invest", "Invest early, don't miss out #ad https://x"),
    ("apr", "45% APR just for holding #ad https://x"),
    ("no_ad_tag", "Vote for me! https://x"),
    ("post_on_of", "post the link on your OnlyFans #ad https://x"),
]

_MUST_PASS = [
    "Voting is open and I need you 👀 Tap my link and vote — takes 10 seconds. #ad https://x",
    "I'm on the board this week. One vote from you, that's all I'm asking 💅 #ad https://x",
    "Currently climbing the leaderboard and I refuse to lose. Vote 👇 #ad https://x",
    "New week, new contest. My link's below — go be a legend. #ad https://x",
    "$TTS voting closes Sunday. Don't leave me on read. #ad https://x",
]


def _self_test() -> int:
    failures = 0
    print("── compliance self-test ─────────────────────────────────────────")
    for label, bad in _MUST_FAIL:
        rep = check_promo(bad, "https://x")
        status = "BLOCKED" if not rep.ok else "LET THROUGH"
        good = not rep.ok
        failures += 0 if good else 1
        rules = ",".join(sorted({v.rule for v in rep.violations})) or "-"
        print(f"  {'✓' if good else '✗'} must-fail  {label:16} {status:12} [{rules}]")
    for good_text in _MUST_PASS:
        rep = check_promo(good_text, "https://x")
        ok = rep.ok
        failures += 0 if ok else 1
        print(f"  {'✓' if ok else '✗'} must-pass  {good_text[:48]!r:52} "
              f"{'clean' if ok else str(rep)}")
    print("─────────────────────────────────────────────────────────────────")
    print("all clear" if not failures else f"{failures} FAILURES — do not ship")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(_self_test())
