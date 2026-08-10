#!/usr/bin/env python3
"""
Contestant pack generator — the kit a creator gets once her agency signs.

Every caption is passed through guardrails.caption_violations() BEFORE it is written. A
caption that names the subscription platform or makes any price/earnings claim is not
warned about, it is rejected and never reaches the file. Generation fails loudly if a
variant cannot be made clean, because a silently-dropped caption would leave the pack
short without anyone noticing.

    python3 promo/contestant_pack.py --name "Demo Creator" --handle demo_creator \\
        --niche fitness --vote-link https://app.temptationtoken.io/p/demo
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tts_outreach import config, guardrails  # noqa: E402

# Flirty-but-SFW. No platform name, no numbers that could read as an earnings claim.
CAPTIONS = [
    "Someone said I wouldn't make the top 3 this week. Bold of them. "
    "Vote for me here 👉 {link}  #ad",

    "The leaderboard updates live and I am refreshing it like a maniac. "
    "Put me higher 😌 {link}  #ad",

    "Round {round} is open and I intend to be insufferable about winning it. "
    "One tap, that's it 👇 {link}  #ad",

    "Currently accepting votes, compliments, and absolutely no criticism. "
    "Vote 👉 {link}  #ad",

    "They're voting on {niche} girls this week and I'd like to be smug on Sunday. "
    "Help me out 💅 {link}  #ad",
]

STORY_OVERLAYS = [
    "SWIPE UP TO VOTE ↗   #ad",
    "I'm in the top 10. Let's fix that ⬆   #ad",
    "Voting closes Sunday 11:59pm ET   #ad",
    "One tap = one vote 🗳   #ad",
    "Tell me I'm your favourite 😇   #ad",
]

CALENDAR = [
    ("Mon", "Feed post", "Caption 1 — announce you're in this week's round"),
    ("Tue", "Story", "Overlay 1 + link sticker"),
    ("Wed", "—", "Rest day (no post)"),
    ("Thu", "Feed post", "Caption 3 — mid-week standings nudge"),
    ("Fri", "Story", "Overlay 2 + link sticker"),
    ("Sat", "Story", "Overlay 3 — closing-soon reminder"),
    ("Sun", "Feed post", "Caption 5 — final push before 11:59pm ET"),
]

COMPLIANCE = (
    "📌 PINNED / BIO LINE — keep this visible on every post in the campaign:\n\n"
    "  Paid partnership with Temptation Token. #ad\n\n"
    "Rules, so nobody gets in trouble:\n"
    "  • Every post carries #ad. Non-negotiable — it is an FTC requirement, not a style note.\n"
    "  • Never post this campaign on your subscription platform. IG / X / Threads only.\n"
    "  • Never quote a token price, a dollar figure, or what anyone might earn.\n"
    "  • Never promise anyone a return. You are inviting votes, not selling an investment.\n"
    "  • If a fan asks what they get: they get to back you on the leaderboard. That's it.\n"
)


def build(name: str, handle: str, niche: str, link: str, round_no: int) -> dict:
    out = {"captions": [], "overlays": [], "rejected": []}

    for i, tpl in enumerate(CAPTIONS, 1):
        text = tpl.format(link=link, niche=niche, round=round_no)
        v = guardrails.caption_violations(text)
        if v:
            out["rejected"].append((i, text, [str(x) for x in v]))
            continue
        out["captions"].append(text)

    for o in STORY_OVERLAYS:
        v = guardrails.caption_violations(o)
        if v:
            out["rejected"].append((0, o, [str(x) for x in v]))
            continue
        out["overlays"].append(o)

    if len(out["captions"]) < 5 or len(out["overlays"]) < 5:
        raise SystemExit(
            f"pack incomplete: {len(out['captions'])}/5 captions, "
            f"{len(out['overlays'])}/5 overlays survived the filter.\n"
            + "\n".join(f"  rejected: {t!r} -> {r}" for _, t, r in out["rejected"])
        )
    return out


def write(name: str, handle: str, niche: str, link: str, round_no: int) -> Path:
    pack = build(name, handle, niche, link, round_no)
    slug = "".join(ch if ch.isalnum() else "-" for ch in name.lower()).strip("-")
    d = config.PACKS_DIR / slug
    d.mkdir(parents=True, exist_ok=True)

    (d / "captions.md").write_text(
        f"# Captions — {name} (@{handle})\n\n"
        "Pick one per feed post. Rotate; don't repeat within a week.\n"
        "Every one already carries #ad — do not delete it.\n\n"
        + "\n\n".join(f"### Variant {i}\n\n```\n{c}\n```" for i, c in enumerate(pack["captions"], 1))
        + "\n", encoding="utf-8")

    (d / "story_overlays.md").write_text(
        f"# Story overlays — {name}\n\nShort text to sit over a Story. Add the link sticker.\n\n"
        + "\n".join(f"{i}. `{o}`" for i, o in enumerate(pack["overlays"], 1)) + "\n",
        encoding="utf-8")

    start = date.today()
    cal = ["# 7-day posting calendar — " + name, "",
           "| Day | Date | Format | What |", "|---|---|---|---|"]
    for i, (dow, fmt, what) in enumerate(CALENDAR):
        cal.append(f"| {dow} | {start + timedelta(days=i):%b %d} | {fmt} | {what} |")
    cal += ["", "Two feed posts + three stories per week is the commitment we quoted the agency.",
            "", "_Voting closes Sunday 11:59 PM ET._"]
    (d / "calendar.md").write_text("\n".join(cal) + "\n", encoding="utf-8")

    (d / "COMPLIANCE.txt").write_text(COMPLIANCE, encoding="utf-8")

    (d / "README.md").write_text(
        f"# {name} — Temptation Token contestant pack\n\n"
        f"- Handle: @{handle}\n- Niche: {niche}\n- Vote link: {link}\n"
        f"- Generated: {date.today():%Y-%m-%d}\n\n"
        "| File | What |\n|---|---|\n"
        "| `captions.md` | 5 feed captions, all pre-cleared |\n"
        "| `story_overlays.md` | 5 story overlays |\n"
        "| `calendar.md` | 7-day posting plan |\n"
        "| `COMPLIANCE.txt` | Read this first. Pin the line at the top. |\n\n"
        "Every caption passed an automated compliance filter: no platform mentions, no "
        "price or earnings claims, #ad on all of them.\n", encoding="utf-8")
    return d


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--handle", required=True)
    ap.add_argument("--niche", default="creator")
    ap.add_argument("--vote-link", required=True)
    ap.add_argument("--round", type=int, default=7)
    a = ap.parse_args()

    d = write(a.name, a.handle.lstrip("@"), a.niche, a.vote_link, a.round)
    print(f"\n\033[32m✓\033[0m pack → {d.relative_to(config.ROOT)}")
    for f in sorted(d.iterdir()):
        print(f"    {f.name}")
    print("\n  every caption passed the compliance filter (#ad present, no platform "
          "mention, no price/earnings claim)\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
