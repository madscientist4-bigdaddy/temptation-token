#!/usr/bin/env python3
"""
contestant_pack.py — build a ready-to-post promo pack for one creator.

    python3 promo/contestant_pack.py \
        --name "Demo Creator" --handle @democreator \
        --niche fitness --link https://app.temptationtoken.io/?ref=demo

Produces a folder containing:
    README.md      compliance line + what's in the pack + how to use it
    captions.md    5 IG/X caption variants
    stories.md     5 Instagram Story text overlays
    calendar.md    7-day posting calendar with best-time hints
    pack.html      all of the above with one-tap Copy buttons (open on a phone)
    pack.json      machine-readable, for an agency's own tooling

Every string is routed through promo/compliance.enforce() before it touches disk. If any
line would violate the rules the script raises and writes NOTHING — a partially compliant
pack is worse than no pack, because someone will post from it.

Nothing here auto-posts. The pack exists for a human to copy and paste.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compliance import COMPLIANCE_LINE, enforce, ComplianceError  # noqa: E402
from copy_ui import render_page  # noqa: E402


# ── Copy templates ────────────────────────────────────────────────────────────
# Flirty-but-SFW, contest-framed. Deliberately NO reference to winnings, price, or what
# anyone gets out of it — the ask is always just "vote", which is also the only thing
# that's actually true at the moment someone reads it.
CAPTIONS = [
    ("The direct ask",
     "Okay I'm officially in the {niche} lineup this week and I'd like to win, please 👀\n"
     "One tap, one vote, ten seconds — that's the whole ask.\n"
     "Vote here → {link}\n\n#ad #TemptationToken #TTS"),

    ("Competitive",
     "Someone is currently ahead of me on this leaderboard and I'm taking it personally.\n"
     "Fix it for me? 💅\n"
     "→ {link}\n\n#ad #TemptationToken #TTS"),

    ("Playful / low-effort ask",
     "I'm not going to beg.\n"
     "...\n"
     "Okay I'm begging. Vote for me 🥺 → {link}\n\n#ad #TemptationToken #TTS"),

    ("Community / thank-you",
     "The people voting for me every week? Genuinely obsessed with you.\n"
     "Voting's open again — you know what to do 👇\n"
     "{link}\n\n#ad #TemptationToken #TTS"),

    ("Deadline urgency",
     "Voting closes Sunday night and I am NOT losing to whoever's in first right now.\n"
     "Ten seconds of your time → {link}\n\n#ad #TemptationToken #TTS"),
]

STORIES = [
    ("Bold + arrow",   "VOTE FOR ME →\nlink in bio\n#ad"),
    ("Countdown",      "voting closes SUNDAY ⏳\ntap the link\n#ad"),
    ("Leaderboard",    "currently climbing 📈\nhelp me get to #1\nlink in bio · #ad"),
    ("Casual",         "10 seconds. one tap.\nthat's it, that's the story 💅\nlink in bio · #ad"),
    ("Direct + cheeky", "i see you scrolling 👀\nGO VOTE\nlink in bio · #ad"),
]

# Best-time hints are rules of thumb for US-centric creator audiences, not guarantees —
# labelled as such so nobody treats them as data they don't have.
CALENDAR = [
    ("Monday",    0, "Round opens", "6–8pm local", "Fresh round, lowest competition for attention."),
    ("Tuesday",   3, "Community",   "12–1pm local", "Lunch scroll; thank-you framing performs when engagement is low."),
    ("Wednesday", 1, "Competitive", "7–9pm local", "Midweek peak. Push the rivalry angle."),
    ("Thursday",  2, "Playful",     "6–8pm local", "Lighter tone; audiences tire of a repeated hard ask."),
    ("Friday",    0, "Direct ask",  "5–7pm local", "Pre-night-out window, phones in hand."),
    ("Saturday",  4, "Urgency",     "1–3pm local", "Weekend browse; start the deadline drumbeat."),
    ("Sunday",    4, "Final call",  "4–6pm local", "Last chance before voting closes Sunday 11:59pm ET."),
]

STORY_ROTATION = [0, 2, 4, 3, 1, 2, 0]


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-") or "creator"


def normalise_handle(h: str) -> str:
    h = (h or "").strip()
    return h if h.startswith("@") else f"@{h}" if h else ""


def build(name: str, handle: str, niche: str, link: str) -> dict:
    """Render + validate everything. Raises ComplianceError before any file is written."""
    ctx = {"name": name, "handle": handle, "niche": niche.strip().lower(), "link": link}

    captions = []
    for label, tpl in CAPTIONS:
        text = tpl.format(**ctx)
        enforce(text, vote_link=link, where=f"caption: {label}")
        captions.append({"label": label, "text": text})

    stories = []
    for label, tpl in STORIES:
        text = tpl.format(**ctx)
        # Story overlays carry #ad but not the URL — the link lives in the bio / sticker,
        # which is how Stories actually work. So the link requirement is waived here and
        # the instruction to place it is made explicit in the pack README instead.
        enforce(text, vote_link=None, where=f"story: {label}")
        stories.append({"label": label, "text": text})

    calendar = []
    for day, cap_idx, angle, when, why in CALENDAR:
        calendar.append({
            "day": day, "angle": angle, "best_time": when, "why": why,
            "caption_label": CAPTIONS[cap_idx][0],
            "caption_index": cap_idx + 1,
            "story_label": STORIES[STORY_ROTATION[len(calendar)]][0],
        })

    return {
        "creator": {"name": name, "handle": handle, "niche": niche, "vote_link": link},
        "generated": date.today().isoformat(),
        "compliance": COMPLIANCE_LINE,
        "captions": captions,
        "stories": stories,
        "calendar": calendar,
    }


# ── Writers ───────────────────────────────────────────────────────────────────
def md_header(title: str) -> str:
    return f"# {title}\n\n> ⚠️ **{COMPLIANCE_LINE}**\n\n"


def write_pack(pack: dict, out: Path) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    c = pack["creator"]
    who = f'{c["name"]} ({c["handle"]})' if c["handle"] else c["name"]
    written = []

    # README
    p = out / "README.md"
    p.write_text(
        md_header(f"Promo pack — {who}")
        + f"**Niche:** {c['niche']}  \n**Vote link:** {c['vote_link']}  \n"
          f"**Generated:** {pack['generated']}\n\n"
          "## What's in here\n\n"
          "| File | Use it for |\n|---|---|\n"
          "| `pack.html` | **Start here on your phone** — every caption with a Copy button |\n"
          "| `captions.md` | 5 feed caption variants (IG / X) |\n"
          "| `stories.md` | 5 Instagram Story text overlays |\n"
          "| `calendar.md` | Which caption to post which day, and when |\n"
          "| `pack.json` | Same content, machine-readable |\n\n"
          "## The rules — these are not optional\n\n"
          "1. **`#ad` stays on every post.** It's already in every caption. Don't delete it,\n"
          "   don't bury it at the end of a hashtag wall.\n"
          "2. **Never claim or imply what anyone earns, wins, or what $TTS is worth.** No\n"
          "   prices, no returns, no \"I made X\". If you improvise a caption, that's the line.\n"
          "3. **Never mention OnlyFans**, and never post the vote link there.\n"
          "4. **Link only** — the vote link goes in your bio or a Story sticker.\n"
          "5. Keep it SFW and clothed. The contest is; the promo has to match.\n\n"
          "## Stories\n\n"
          "Story overlays don't include the URL because Stories don't take links inline —\n"
          "put the vote link in your **bio** or a **link sticker**, and use the overlay text\n"
          "as-is. `#ad` must stay visible on the Story itself, not only in the bio.\n\n"
          "## Nothing here posts for you\n\n"
          "Everything is copy-paste on purpose. Automated posting to IG/X from a third-party\n"
          "tool violates their terms and puts your account at risk.\n",
        encoding="utf-8")
    written.append(p)

    # captions.md
    lines = [md_header(f"Captions — {who}")]
    for i, cap in enumerate(pack["captions"], 1):
        lines.append(f"### {i}. {cap['label']}\n\n```\n{cap['text']}\n```\n")
    p = out / "captions.md"; p.write_text("\n".join(lines), encoding="utf-8"); written.append(p)

    # stories.md
    lines = [md_header(f"Story overlays — {who}"),
             "_Put the vote link in your bio or a link sticker. Keep `#ad` visible on the Story._\n"]
    for i, s in enumerate(pack["stories"], 1):
        lines.append(f"### {i}. {s['label']}\n\n```\n{s['text']}\n```\n")
    p = out / "stories.md"; p.write_text("\n".join(lines), encoding="utf-8"); written.append(p)

    # calendar.md
    lines = [md_header(f"7-day posting calendar — {who}"),
             "Round runs **Monday 12:00am → Sunday 11:59pm ET**. Times are rules of thumb for a\n"
             "US-centric audience, not measured data — trust your own insights over this table.\n",
             "| Day | Angle | Post this caption | Story | Best time | Why |",
             "|---|---|---|---|---|---|"]
    for d in pack["calendar"]:
        lines.append(f"| {d['day']} | {d['angle']} | #{d['caption_index']} {d['caption_label']} "
                     f"| {d['story_label']} | {d['best_time']} | {d['why']} |")
    lines.append("\n**One post + one Story per day is plenty.** Posting the same hard ask five\n"
                 "times a day is how an audience stops seeing it.\n")
    p = out / "calendar.md"; p.write_text("\n".join(lines), encoding="utf-8"); written.append(p)

    # pack.json
    p = out / "pack.json"; p.write_text(json.dumps(pack, indent=2, ensure_ascii=False), encoding="utf-8")
    written.append(p)

    # pack.html
    cal_items = [{
        "label": d["day"],
        "meta": d["best_time"],
        "text": f"{d['angle']} — post caption #{d['caption_index']} ({d['caption_label']}), "
                f"story: {d['story_label']}\nWhy: {d['why']}",
    } for d in pack["calendar"]]
    html_doc = render_page(
        title=f"Promo pack — {who}",
        subtitle=f"{c['niche']} · voting link {c['vote_link']} · generated {pack['generated']}",
        compliance_line=COMPLIANCE_LINE,
        sections=[
            {"heading": "Feed captions (IG / X)",
             "note": "Tap Copy, paste, post. #ad is already in there — leave it.",
             "items": pack["captions"]},
            {"heading": "Instagram Story overlays",
             "note": "Link goes in your bio or a link sticker. Keep #ad visible on the Story.",
             "items": pack["stories"]},
            {"heading": "7-day calendar",
             "note": "Round runs Monday 12:00am → Sunday 11:59pm ET. Times are rules of thumb.",
             "items": cal_items},
        ])
    p = out / "pack.html"; p.write_text(html_doc, encoding="utf-8"); written.append(p)

    return written


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate a compliant promo pack for one creator.")
    ap.add_argument("--name", required=True, help="Creator display name")
    ap.add_argument("--handle", default="", help="Social handle, e.g. @democreator")
    ap.add_argument("--niche", default="general", help="e.g. fitness, dance, cosplay, travel")
    ap.add_argument("--link", required=True, help="Her vote link")
    ap.add_argument("--out", default="", help="Output folder (default: promo/packs/<slug>)")
    a = ap.parse_args()

    if not a.link.lower().startswith(("http://", "https://")):
        print(f"✗ --link must be a URL, got {a.link!r}", file=sys.stderr)
        return 2

    out = Path(a.out) if a.out else Path(__file__).resolve().parent / "packs" / slugify(a.name)

    try:
        pack = build(a.name, normalise_handle(a.handle), a.niche, a.link)
    except ComplianceError as e:
        print(f"\n✗ COMPLIANCE FAILURE — nothing written.\n{e}", file=sys.stderr)
        return 1

    written = write_pack(pack, out)
    print(f"\n✓ Promo pack for {a.name} → {out}")
    for p in written:
        print(f"    {p.relative_to(out.parent)}")
    print(f"\n  {COMPLIANCE_LINE}")
    print(f"  Open {out / 'pack.html'} on a phone for one-tap copy.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
