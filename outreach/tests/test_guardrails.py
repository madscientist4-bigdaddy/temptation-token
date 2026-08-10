"""
Proof that the seven non-negotiables actually hold.

Run: cd outreach && python3 -m pytest tests/ -q     (or: python3 tests/test_guardrails.py)

These are the tests that matter. If one of them goes red, the system is not merely buggy
— it is doing something it promised a regulator, a platform, or a stranger's inbox that
it would not do.
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tts_outreach import db, guardrails as g  # noqa: E402

ET = ZoneInfo("America/New_York")
FAILS: list[str] = []


def check(cond: bool, label: str) -> None:
    print(("  \033[32mPASS\033[0m  " if cond else "  \033[31mFAIL\033[0m  ") + label)
    if not cond:
        FAILS.append(label)


def raises(fn, exc=Exception) -> bool:
    try:
        fn()
        return False
    except exc:
        return True


# ── 1. CAN-SPAM ──────────────────────────────────────────────────────────────
def test_can_spam() -> None:
    print("\n1. CAN-SPAM")
    addr = "Blockchain Entertainment LLC, 1 Main St #2, Miami FL 33101"
    good = f"Hi there,\n\nPitch.\n\n--\nBlockchain Entertainment LLC · {addr}\nReply \"remove\" and I'm gone.\n"
    check(not raises(lambda: g.assert_can_spam_ready(good, addr)), "compliant body passes")
    check(raises(lambda: g.assert_can_spam_ready("Hi, pitch.", addr), ValueError),
          "body with no entity/address/opt-out is rejected")
    check(raises(lambda: g.assert_can_spam_ready(good, ""), ValueError),
          "unset MAIL_ADDR is rejected")
    check(raises(lambda: g.assert_can_spam_ready(good.replace('Reply "remove" and I\'m gone.', ""), addr),
                 ValueError),
          "missing opt-out instruction is rejected")
    h = g.unsubscribe_headers("p@x.io")
    check("List-Unsubscribe" in h and "remove" in h["List-Unsubscribe"],
          "List-Unsubscribe header present")
    for w in ("remove", "STOP", "please unsubscribe", "Not interested"):
        check(g.is_optout(w), f"opt-out detected: {w!r}")
    check(not g.is_optout("interested, let's talk"), "positive reply is not an opt-out")


# ── 2. never auto-DM / auto-post ─────────────────────────────────────────────
def test_channels() -> None:
    print("\n2. Automation policy")
    check(g.may_automate("email"), "email may be automated")
    for ch in ("instagram", "x", "telegram", "whatsapp", "form", "phone", "fedex"):
        check(not g.may_automate(ch), f"{ch} is NOT automatable")
        check(raises(lambda ch=ch: g.assert_manual_only(ch), PermissionError),
              f"assert_manual_only raises for {ch}")
    src = (Path(__file__).resolve().parent.parent / "daily_brief.py").read_text()
    check("smtplib" not in src and "requests.post" not in src,
          "daily_brief.py contains no send path at all")


# ── 3 + 4. content rules ─────────────────────────────────────────────────────
def test_captions() -> None:
    print("\n3+4. Caption rules (strict, public promo)")
    ok = "Round 7 is open — vote for me 👉 https://x #ad"
    check(g.caption_violations(ok) == [], "clean caption passes")
    for bad in ("Vote for me, link in bio to my OnlyFans #ad",
                "vote for me on only fans #ad",
                "0nlyfans link #ad"):
        v = g.caption_violations(bad)
        check(any(x.rule == "PLATFORM" for x in v), f"platform mention blocked: {bad[:34]!r}")
    for bad in ("Vote — this token does 10x #ad",
                "Earn $500 a week, vote now #ad",
                "guaranteed returns, vote #ad",
                "45% APY if you vote #ad"):
        v = g.caption_violations(bad)
        check(any(x.rule == "MONEY_CLAIM" for x in v), f"money claim blocked: {bad[:34]!r}")
    v = g.caption_violations("Vote for me, no disclosure")
    check(any(x.rule == "FTC" for x in v), "missing #ad blocked")
    check(raises(lambda: g.assert_publishable("buy now on OnlyFans"), ValueError),
          "assert_publishable raises")


def test_email_body() -> None:
    print("\n   Email rules (B2B — deal terms allowed, speculation not)")
    real = (Path(__file__).resolve().parent.parent / "templates" / "email_1.txt").read_text()
    check(g.email_body_violations(real) == [],
          "shipped email_1 passes (states $2,500 pool + 50% share + platform name)")
    check(g.email_body_violations("creators keep 50% of every vote") == [],
          "revenue-share term is allowed in B2B email")
    for bad in ("our token will 10x", "guaranteed returns for holders",
                "market cap will triple", "45% APY"):
        check(g.email_body_violations(bad) != [], f"token speculation blocked: {bad!r}")


# ── 5. blocklist ─────────────────────────────────────────────────────────────
def test_blocklist() -> None:
    print("\n5. Blocklist")
    bl = g.load_blocklist()
    check(len(bl) == 11, f"11 entries loaded (got {len(bl)})")
    cases = [("Moxy", "moxymgt.com", None), ("Unruly", "unrulyagency.com", None),
             ("DYSRPT", "dysrpt.com", None), ("Behave", "behaveagency.com", None),
             ("Ash", None, "hi@ashagency.co"), ("ContentX", "contentx.io", None),
             ("Verge", "vergeagency.net", None), ("Elite", "elitecreators.co", None),
             ("Boss Baddies", "bossbaddies.com", None), ("Creators Inc", "creatorsinc.io", None),
             ("Siren", "sirenagency.com", None)]
    for name, dom, mail in cases:
        check(g.is_blocked(name, dom, mail) is not None, f"blocked: {name}")
    check(g.is_blocked("AROA", "aroaagency.com", "office@aroaagency.com") is None,
          "legitimate target not blocked")
    allowed, why = g.can_contact({"name": "Moxy", "domain": "moxymgt.com", "state": "NEW"})
    check(not allowed and "BLOCKLIST" in why, "can_contact refuses a blocked target")
    missing = Path("/tmp/definitely-not-here-blocklist.txt")
    check(raises(lambda: g.load_blocklist(missing), FileNotFoundError),
          "missing blocklist fails CLOSED (not 'nobody blocked')")


# ── 6. identity ──────────────────────────────────────────────────────────────
def test_identity() -> None:
    print("\n6. Sender identity")
    check(not raises(lambda: g.assert_sender_identity("p@tts.io", "p@tts.io")),
          "configured identity allowed")
    check(raises(lambda: g.assert_sender_identity("jim@gmail.com", "p@tts.io"), PermissionError),
          "any other From address refused")


# ── 7. yes-path routes through counsel ───────────────────────────────────────
def test_yes_path() -> None:
    print("\n7. Legal gate on the 'yes' path")
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    import reply_watcher as rw
    from tts_outreach import config as cfgmod

    d = rw.draft_for("yes", "Test Agency", cfgmod.load())
    for term in ("licensing", "consent", "FTC"):
        check(term.lower() in d.lower(), f"yes-draft mentions {term}")
    check(d.index("rider") < d.index("load their profiles"),
          "the rider comes BEFORE profiles go live")
    check(rw.classify("please remove me") == "opt_out", "opt-out classified")
    check(rw.classify("what's the catch on pricing?") == "pricing", "pricing classified")
    check(rw.classify("we're in, let's do it") == "yes", "yes classified")
    check(rw.classify("interested, tell me more") == "interested", "interest classified")


# ── send window, caps, attachments, state machine ────────────────────────────
def test_window_and_caps() -> None:
    print("\n8. Send window, caps, attachments")
    check(not g.in_send_window(datetime(2026, 8, 8, 12, 0, tzinfo=ET))[0], "Saturday blocked")
    check(not g.in_send_window(datetime(2026, 8, 9, 12, 0, tzinfo=ET))[0], "Sunday blocked")
    check(g.in_send_window(datetime(2026, 8, 10, 12, 0, tzinfo=ET))[0], "Monday noon allowed")
    check(not g.in_send_window(datetime(2026, 8, 10, 8, 59, tzinfo=ET))[0], "08:59 ET blocked")
    check(not g.in_send_window(datetime(2026, 8, 10, 16, 1, tzinfo=ET))[0], "16:01 ET blocked")
    check(g.in_send_window(datetime(2026, 8, 10, 9, 0, tzinfo=ET))[0], "09:00 ET allowed")

    start = datetime(2026, 8, 10, 9, 0, tzinfo=ET)
    check(g.daily_cap(start, datetime(2026, 8, 12, 9, 0, tzinfo=ET)) == 15, "week 1 cap = 15")
    check(g.daily_cap(start, datetime(2026, 8, 20, 9, 0, tzinfo=ET)) == 25, "after week 1 = 25")
    check(g.daily_cap(None) == 15, "unknown start -> conservative 15")

    check(raises(lambda: g.assert_no_attachments(1, ["onepager.pdf"]), ValueError),
          "attachment on first touch refused")
    check(not raises(lambda: g.assert_no_attachments(1, None)), "no attachment is fine")


def test_state_machine() -> None:
    print("\n9. State machine")
    p = Path("/tmp/tts_test_outreach.db")
    p.unlink(missing_ok=True)
    db.init(p)
    with db.connect(p) as c:
        aid = db.upsert_agency(c, {"name": "T", "domain": "t.com", "email": "a@t.com",
                                   "tier": 1, "status": "VERIFIED", "angle_line": "x"})
        db.set_state(c, aid, "QUEUED")
        db.set_state(c, aid, "CONTACTED")
        check(raises(lambda: db.set_state(c, aid, "PILOT"), ValueError),
              "illegal jump CONTACTED -> PILOT refused")
        db.suppress(c, aid, "a@t.com", "asked to be removed")
        st = c.execute("SELECT state FROM agencies WHERE id=?", (aid,)).fetchone()["state"]
        check(st == "SUPPRESSED", "suppress() sets SUPPRESSED")
        check(db.is_suppressed_email(c, "a@t.com"), "address recorded in suppressions")
        check(raises(lambda: db.set_state(c, aid, "QUEUED"), ValueError),
              "SUPPRESSED is terminal — cannot be resurrected")
        allowed, why = g.can_contact({"name": "T", "state": "SUPPRESSED"})
        check(not allowed, "can_contact refuses SUPPRESSED")
        allowed, _ = g.can_contact({"name": "T", "state": "REPLIED"})
        check(not allowed, "can_contact halts on REPLIED (no follow-up after a reply)")
        allowed, _ = g.can_contact({"name": "C", "state": "NEW", "status": "HOLD"})
        check(not allowed, "tier-3 HOLD never contacted")
    p.unlink(missing_ok=True)


def main() -> int:
    print("\033[1mGUARDRAIL TEST SUITE\033[0m")
    test_can_spam(); test_channels(); test_captions(); test_email_body()
    test_blocklist(); test_identity(); test_yes_path()
    test_window_and_caps(); test_state_machine()
    print()
    if FAILS:
        print(f"\033[31m{len(FAILS)} FAILURE(S)\033[0m")
        for f in FAILS:
            print(f"  - {f}")
        return 1
    print("\033[32mAll guardrail tests passed.\033[0m\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
