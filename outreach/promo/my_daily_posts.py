#!/usr/bin/env python3
"""
Five @CryptoFITJim posts a day: leaderboard drama, standings, new-creator shout-outs.

Reads live standings from TTS_API_URL when configured, else data/standings.json. Writes
posts_YYYY-MM-DD.md plus a copy-button HTML page (same pattern as dm_copilot).

Nothing auto-posts. There is no posting function in this file.

    python3 promo/my_daily_posts.py
"""
from __future__ import annotations

import argparse, json, html, sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tts_outreach import config, guardrails  # noqa: E402

STANDINGS_JSON = config.DATA_DIR / "standings.json"


def load_standings(cfg) -> dict:
    if cfg.tts_api_url:
        try:
            import requests
            h = {"Authorization": f"Bearer {cfg.tts_api_key}"} if cfg.tts_api_key else {}
            r = requests.get(cfg.tts_api_url, headers=h, timeout=10)
            if r.ok:
                return r.json()
            print(f"  standings API HTTP {r.status_code} — falling back to standings.json")
        except Exception as e:
            print(f"  standings API unreachable ({type(e).__name__}) — falling back")
    if STANDINGS_JSON.exists():
        return json.loads(STANDINGS_JSON.read_text())
    return {"round": "?", "closes": "Sunday 11:59 PM ET", "standings": []}


def build(s: dict) -> list[tuple[str, str]]:
    """(kind, text). Filtered so no post can carry a price/earnings claim."""
    rows = s.get("standings", [])
    rnd = s.get("round", "?")
    closes = s.get("closes", "Sunday 11:59 PM ET")
    top = rows[0]["name"] if rows else "our leader"
    second = rows[1]["name"] if len(rows) > 1 else "second place"
    gap = ""
    if len(rows) > 1 and "votes" in rows[0] and "votes" in rows[1]:
        gap = f"{rows[0]['votes'] - rows[1]['votes']:,} votes"

    drafts = [
        ("standings",
         f"Round {rnd} standings 🏆\n\n" +
         "\n".join(f"{i}. {r['name']}" for i, r in enumerate(rows[:5], 1)) +
         f"\n\nVoting closes {closes}. #ad"),
        ("drama",
         f"{second} is {gap or 'right'} behind {top} and there are hours left in Round {rnd}. "
         f"This is the good part. #ad"),
        ("leader",
         f"{top} has held #1 all week. Someone is going to make a run at it before "
         f"{closes} — I'd like to see it. #ad"),
        ("shoutout",
         f"New faces entered Round {rnd} this week. Go look at the board and back "
         f"whoever you like. #ad"),
        ("mechanic",
         "How it works, one more time: fans vote, the winning creator and the top voter "
         "split the pool, and every vote settles on-chain. That's the whole game. #ad"),
    ]
    out, rejected = [], []
    for kind, text in drafts:
        v = guardrails.caption_violations(text)
        if v:
            rejected.append((text, [str(x) for x in v]))
            continue
        out.append((kind, text))
    if rejected:
        print(f"  \033[33m{len(rejected)} draft(s) rejected by the filter:\033[0m")
        for t, r in rejected:
            print(f"    {r} :: {t[:60]}…")
    return out


CSS = """body{margin:0;padding:24px;background:#0d0d12;color:#e8e6e3;
font:15px/1.55 -apple-system,BlinkMacSystemFont,sans-serif}
h1{font-size:20px;margin:0 0 18px}
.card{background:#16161f;border:1px solid #2a2a38;border-radius:12px;padding:16px;margin-bottom:14px}
.k{font-size:11px;color:#9a97a4;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
textarea{width:100%;min-height:96px;background:#0a0a0f;color:#e8e6e3;border:1px solid #2a2a38;
border-radius:8px;padding:11px;font:13px/1.5 ui-monospace,Menlo,monospace;resize:vertical}
button{margin-top:10px;background:#d4af37;color:#111;border:none;border-radius:7px;
padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer;min-height:38px}
button.done{background:#2ecc71}
.warn{background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.3);border-radius:10px;
padding:12px 14px;margin-bottom:18px;font-size:13px;color:#d4af37}"""


def main() -> int:
    ap = argparse.ArgumentParser(); ap.add_argument("--no-open", action="store_true")
    a = ap.parse_args()
    cfg = config.load()
    s = load_standings(cfg)
    posts = build(s)
    today = date.today()

    md = [f"# @CryptoFITJim posts — {today:%A %d %B %Y}", "",
          f"Round {s.get('round','?')} · closes {s.get('closes','?')}", "",
          "_Nothing here auto-posts. Copy, review, post yourself._", ""]
    for i, (kind, t) in enumerate(posts, 1):
        md += [f"## {i}. {kind}", "", "```", t, "```", ""]
    out_md = config.ROOT / f"posts_{today}.md"
    out_md.write_text("\n".join(md), encoding="utf-8")

    cards = "".join(
        f'<div class="card"><div class="k">{html.escape(k)}</div>'
        f'<textarea id="t{i}" readonly>{html.escape(t)}</textarea>'
        f'<button id="b{i}" onclick="cp({i})">COPY</button></div>'
        for i, (k, t) in enumerate(posts))
    out_html = config.ROOT / f"posts_{today}.html"
    out_html.write_text(
        f"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Posts {today}</title><style>{CSS}</style></head><body>
<h1>@CryptoFITJim — {today:%b %d}</h1>
<div class="warn"><b>Manual posting only.</b> Every post already carries #ad and was
checked for price/earnings claims. Read before you post.</div>{cards}
<script>function cp(i){{const t=document.getElementById('t'+i),b=document.getElementById('b'+i);
t.select();navigator.clipboard.writeText(t.value).then(()=>{{b.textContent='COPIED ✓';
b.classList.add('done');setTimeout(()=>{{b.textContent='COPY';b.classList.remove('done')}},1600)}})}}
</script></body></html>""", encoding="utf-8")

    print(f"\n  {len(posts)} posts → {out_md.name} · {out_html.name}")
    for k, t in posts:
        print(f"    \033[2m[{k}]\033[0m {t.splitlines()[0][:66]}…")
    if not a.no_open:
        import subprocess; subprocess.run(["open", str(out_html)], check=False, capture_output=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
