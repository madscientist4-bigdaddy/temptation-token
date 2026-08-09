#!/usr/bin/env python3
"""
my_daily_posts.py — 5 @CryptoFITJim posts a day, from live standings.

    python3 promo/my_daily_posts.py                    # live API if configured, else standings.json
    python3 promo/my_daily_posts.py --standings my.json
    python3 promo/my_daily_posts.py --date 2026-08-10

Standings source, in order:
  1. TTS_READONLY_API_URL + TTS_READONLY_API_KEY in .env  (READ-ONLY endpoint only)
  2. --standings <file>, else promo/standings.json

Writes to promo/out/:
  posts_YYYY-MM-DD.md     copy-paste posts
  posts_YYYY-MM-DD.html   same, with one-tap Copy buttons
  feed_YYYY-MM-DD.json    machine-readable feed

About that feed: @CryptoFitJim is manual-only today — api/social-post.js automates
@temptationtoken and explicitly notes "@CryptoFitJim posts manually". So there is no
existing auto-poster to plug into and this toolkit does NOT add one (posting to X/IG from
a third-party tool is a ToS problem). The JSON feed exists so that IF you ever wire up an
approved poster, it reads this instead of anyone re-implementing the generator.

Every line is routed through promo/compliance.enforce() before it is written.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compliance import COMPLIANCE_LINE, enforce, ComplianceError  # noqa: E402
from copy_ui import render_page  # noqa: E402

ROOT = Path(__file__).resolve().parent
APP = "https://app.temptationtoken.io"


# ── Standings ─────────────────────────────────────────────────────────────────
def load_dotenv(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip().lstrip("export ").strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_live(url: str, key: str) -> dict | None:
    """
    Read-only fetch. Deliberately GET-only with a short timeout — this script must never
    be able to mutate backend state, so it has no code path that could.
    """
    try:
        import urllib.request
        req = urllib.request.Request(url, method="GET")
        req.add_header("Authorization", f"Bearer {key}")
        req.add_header("Accept", "application/json")
        with urllib.request.urlopen(req, timeout=12) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001 — any failure falls back to the local file
        print(f"  ! live standings unavailable ({type(e).__name__}: {e}) — falling back", file=sys.stderr)
        return None


def normalise(raw: dict) -> dict:
    """Accept a few plausible shapes so a backend tweak doesn't break the generator."""
    standings = raw.get("standings") or raw.get("leaderboard") or raw.get("profiles") or []
    out = []
    for i, row in enumerate(standings, 1):
        out.append({
            "rank": int(row.get("rank") or i),
            "name": (row.get("name") or row.get("displayName") or row.get("display_name")
                     or row.get("profileId") or "Unknown"),
            "handle": row.get("handle") or "",
            "votes": float(row.get("votes") or row.get("rawVotes") or row.get("totalVotes") or 0),
        })
    out.sort(key=lambda r: r["rank"])
    return {
        "round": raw.get("round") or raw.get("roundId") or "current",
        "updated": raw.get("updated") or raw.get("updatedAt") or "",
        "standings": out,
        "new_creators": raw.get("new_creators") or raw.get("newCreators") or [],
    }


def get_standings(explicit: Path | None) -> tuple[dict, str]:
    env = {**load_dotenv(ROOT.parent / ".env"), **os.environ}
    url, key = env.get("TTS_READONLY_API_URL"), env.get("TTS_READONLY_API_KEY")
    if url and key:
        raw = fetch_live(url, key)
        if raw:
            return normalise(raw), f"live API ({url.split('//')[-1].split('/')[0]})"
    path = explicit or (ROOT / "standings.json")
    if not path.exists():
        raise SystemExit(
            f"✗ No standings. Either set TTS_READONLY_API_URL + TTS_READONLY_API_KEY in .env,\n"
            f"  or drop a standings file at {path}. See {ROOT / 'standings.example.json'}.")
    return normalise(json.loads(path.read_text(encoding="utf-8"))), f"file ({path.name})"


# ── Post generation ───────────────────────────────────────────────────────────
def nm(row: dict) -> str:
    """Prefer the handle — crediting a creator by @ is the whole point of a shout-out."""
    return row.get("handle") or row.get("name") or "a new face"


def generate(st: dict, seed: str) -> list[dict]:
    rng = random.Random(seed)  # deterministic per day: rerunning gives the same posts
    s = st["standings"]
    posts: list[dict] = []

    def add(kind: str, text: str):
        posts.append({"kind": kind, "text": text})

    # 1 — who's winning
    if s:
        lead = s[0]
        if len(s) > 1:
            gap = lead["votes"] - s[1]["votes"]
            gap_txt = ("by a nose" if gap <= max(1.0, lead["votes"] * 0.05)
                       else "and not by a little")
            add("whos_winning",
                f"Current #1: {nm(lead)} — {gap_txt}.\n"
                f"#2 is {nm(s[1])} and there are days left. This is not over.\n"
                f"Standings → {APP}\n\n#ad #TemptationToken #TTS")
        else:
            add("whos_winning",
                f"{nm(lead)} is leading the board right now.\n"
                f"Anyone want to do something about that? 👀\n{APP}\n\n#ad #TemptationToken #TTS")

    # 2 — leaderboard drama
    if len(s) >= 3:
        a, b = s[1], s[2]
        add("drama",
            f"The fight for #2 is genuinely the best thing on this leaderboard.\n"
            f"{nm(a)} and {nm(b)} keep trading places and I am NOT emotionally prepared.\n"
            f"Go break the tie → {APP}\n\n#ad #TemptationToken #TTS")
    elif s:
        add("drama",
            f"Leaderboard's still wide open this round. Whoever shows up decides it.\n{APP}\n\n"
            f"#ad #TemptationToken #TTS")

    # 3 — new creator shout-out
    newbies = st.get("new_creators") or []
    if newbies:
        who = ", ".join(nm(x) if isinstance(x, dict) else str(x) for x in newbies[:3])
        add("new_creators",
            f"New this week: {who} 👋\n"
            f"Everyone starts at zero votes. Go make their first day a good one.\n{APP}\n\n"
            f"#ad #TemptationToken #TTS")
    elif len(s) >= 5:
        tail = s[-1]
        add("new_creators",
            f"Reminder that {nm(tail)} is sitting at the bottom of this board and does not "
            f"deserve that.\nUnderdog votes are the best votes 👇\n{APP}\n\n"
            f"#ad #TemptationToken #TTS")

    # 4 — how it works
    add("how_it_works", rng.choice([
        f"How this works, quickly:\n"
        f"· Creators enter, the public votes with $TTS\n"
        f"· Winner is drawn on-chain with Chainlink VRF — I can't pick it, nobody can\n"
        f"· 10% of every pool goes to the Polaris Project, automatically\n{APP}\n\n"
        f"#ad #TemptationToken #TTS",

        f"The part people don't believe until they check:\n"
        f"the winner is selected on-chain by Chainlink VRF, and the charity cut goes out in "
        f"the same transaction as everything else. It's all verifiable.\n{APP}\n\n"
        f"#ad #TemptationToken #TTS",
    ]))

    # 5 — closing call
    add("closing", rng.choice([
        f"Voting closes Sunday 11:59pm ET. After that the round settles on-chain and that's "
        f"the week.\nIf you've been meaning to vote — this is the reminder.\n{APP}\n\n"
        f"#ad #TemptationToken #TTS",

        f"Ten seconds. One vote. Someone's week genuinely changes because you tapped a link.\n"
        f"{APP}\n\n#ad #TemptationToken #TTS",
    ]))

    return posts[:5]


# ── Writers ───────────────────────────────────────────────────────────────────
def write_all(posts: list[dict], st: dict, day: str, source: str, out: Path) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    written = []

    top = st["standings"][:10]
    board = "\n".join(f"| {r['rank']} | {r['name']} | {r.get('handle') or '—'} | "
                      f"{r['votes']:,.0f} |" for r in top) or "| — | no standings | — | — |"

    md = [f"# @CryptoFITJim — posts for {day}\n",
          f"> ⚠️ **{COMPLIANCE_LINE}**\n",
          f"_Source: {source} · round {st['round']} · post manually, nothing here auto-posts._\n",
          "## Posts\n"]
    for i, p in enumerate(posts, 1):
        md.append(f"### {i}. {p['kind'].replace('_', ' ').title()}\n\n```\n{p['text']}\n```\n")
    md += ["## Standings used\n",
           "| # | Creator | Handle | Votes |", "|---|---|---|---|", board, ""]
    p = out / f"posts_{day}.md"; p.write_text("\n".join(md), encoding="utf-8"); written.append(p)

    html_doc = render_page(
        title=f"@CryptoFITJim — {day}",
        subtitle=f"5 posts · source: {source} · round {st['round']}",
        compliance_line=COMPLIANCE_LINE,
        sections=[{"heading": "Today's posts",
                   "note": "Tap Copy, paste into X or IG, post. Nothing auto-posts.",
                   "items": [{"label": f"{i}. {p['kind'].replace('_',' ').title()}",
                              "text": p["text"]} for i, p in enumerate(posts, 1)]}])
    p = out / f"posts_{day}.html"; p.write_text(html_doc, encoding="utf-8"); written.append(p)

    feed = {"account": "@CryptoFITJim", "date": day, "source": source,
            "round": st["round"], "compliance": COMPLIANCE_LINE,
            "auto_post": False,
            "note": "Feed for an approved poster to READ. This toolkit never posts.",
            "posts": posts}
    p = out / f"feed_{day}.json"
    p.write_text(json.dumps(feed, indent=2, ensure_ascii=False), encoding="utf-8")
    written.append(p)
    return written


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate 5 daily @CryptoFITJim posts.")
    ap.add_argument("--standings", default="", help="Path to a standings JSON file")
    ap.add_argument("--date", default=date.today().isoformat(), help="YYYY-MM-DD")
    ap.add_argument("--out", default=str(ROOT / "out"))
    a = ap.parse_args()

    st, source = get_standings(Path(a.standings) if a.standings else None)
    posts = generate(st, seed=a.date)

    try:
        for p in posts:
            enforce(p["text"], vote_link=None, where=f"post: {p['kind']}")
    except ComplianceError as e:
        print(f"\n✗ COMPLIANCE FAILURE — nothing written.\n{e}", file=sys.stderr)
        return 1

    written = write_all(posts, st, a.date, source, Path(a.out))
    print(f"\n✓ {len(posts)} posts for {a.date} (source: {source})")
    for p in written:
        print(f"    {p}")
    print(f"\n  {COMPLIANCE_LINE}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
