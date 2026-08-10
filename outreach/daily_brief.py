#!/usr/bin/env python3
"""
07:30 daily brief + DM copilot.

Writes TODAY.md (what the software will do, and what only you can do) and
dm_copilot.html — today's DM targets, each with the exact text in a copy box and a deep
link that opens that agency's IG / X / Telegram / WhatsApp.

The copilot never sends. It cannot: there is no send path in this file, by design
(guardrails.CHANNEL_POLICY). Tap copy, tap link, paste, send — a human action every time.

    python3 daily_brief.py             # write + open
    python3 daily_brief.py --no-open   # write only
"""

from __future__ import annotations

import argparse
import html
import json
import sys
import subprocess
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tts_outreach import config, db, guardrails  # noqa: E402

TODAY_MD = config.ROOT / "TODAY.md"
COPILOT = config.ROOT / "dm_copilot.html"


def deep_links(r: dict) -> list[tuple[str, str]]:
    """(label, url) per available channel. Deep links open the app on macOS/iOS."""
    out = []
    if r.get("instagram"):
        h = r["instagram"].lstrip("@")
        out.append(("Instagram DM", f"https://ig.me/m/{h}"))
        out.append(("IG profile", f"https://instagram.com/{h}"))
    if r.get("x_handle"):
        out.append(("X DM", f"https://x.com/messages/compose?recipient_id={r['x_handle'].lstrip('@')}"))
        out.append(("X profile", f"https://x.com/{r['x_handle'].lstrip('@')}"))
    if r.get("telegram"):
        out.append(("Telegram", f"https://t.me/{r['telegram'].lstrip('@')}"))
    if r.get("phone"):
        digits = "".join(ch for ch in r["phone"] if ch.isdigit())
        out.append(("WhatsApp", f"https://wa.me/{digits}"))
        out.append(("Call", f"tel:{r['phone']}"))
    if r.get("form_url"):
        out.append(("Contact form", r["form_url"]))
    return out


def gather(c, today: date) -> dict:
    bl = guardrails.load_blocklist()
    out = {"emails": [], "dms": [], "calls": [], "fedex": [], "replies": [], "lookups": []}

    # 1. emails the sender will pick up today
    for row in c.execute("SELECT * FROM agencies WHERE seq_started IS NOT NULL").fetchall():
        r = dict(row)
        if not r.get("email"):
            continue
        ok, _ = guardrails.can_contact(r, blocklist=bl)
        if not ok:
            continue
        start = date.fromisoformat(r["seq_started"])
        for offset, step in ((0, 1), (1, 2), (4, 3)):
            if start + timedelta(days=offset) == today:
                done = c.execute("SELECT 1 FROM sends WHERE agency_id=? AND step=?",
                                 (r["id"], step)).fetchone()
                if not done:
                    out["emails"].append({**r, "step": step})

    # 2/3/4. manual tasks due
    for t in c.execute(
        "SELECT t.*, a.name, a.instagram, a.x_handle, a.telegram, a.phone, a.form_url, "
        "a.postal_addr, a.owner_name, a.domain, a.tier "
        "FROM tasks t JOIN agencies a ON a.id = t.agency_id "
        "WHERE t.done = 0 AND t.due_date <= ? ORDER BY a.tier, a.name", (today.isoformat(),)
    ).fetchall():
        r = dict(t)
        ok, why = guardrails.can_contact(
            {**r, "state": c.execute("SELECT state FROM agencies WHERE id=?",
                                     (r["agency_id"],)).fetchone()["state"]},
            blocklist=bl)
        if not ok:
            continue
        if r["kind"] == "LOOKUP":
            out["lookups"].append(r)
        elif r["kind"] == "FEDEX":
            out["fedex"].append(r)
        elif r["kind"] == "CALL":
            out["calls"].append(r)
        else:
            out["dms"].append(r)

    # 5. replies awaiting a human
    for row in c.execute("SELECT * FROM agencies WHERE state = 'REPLIED'").fetchall():
        r = dict(row)
        d = config.DRAFTS_DIR / f"{r['name'].replace('/', '-')}.txt"
        r["draft"] = str(d.relative_to(config.ROOT)) if d.exists() else None
        out["replies"].append(r)
    return out


def write_today_md(data: dict, today: date, cfg: config.Config) -> None:
    L = [f"# TODAY — {today:%A %d %B %Y}", ""]
    mode = "DRY RUN (nothing sends)" if cfg.dry_run else "LIVE"
    L.append(f"**Mode:** {mode}  ·  **From:** {cfg.from_email or '(not configured)'}")
    # Describe the window for the DAY BEING SHOWN. Using now() here made a preview of
    # Monday print "Sunday — weekends are not send days".
    from datetime import time as _t
    probe = datetime.combine(today, _t(12, 0)).replace(tzinfo=guardrails.SEND_TZ)
    win, why = guardrails.in_send_window(probe)
    L.append(f"**Send window ({today:%a}):** {why}")
    L.append("")

    L.append("## 1. Emails queued (automatic)")
    if data["emails"]:
        L.append("")
        L.append("| Agency | Step | To |")
        L.append("|---|---|---|")
        for e in data["emails"]:
            L.append(f"| {e['name']} | email_{e['step']} | {e['email']} |")
    else:
        L.append("\n_None due._")
    L.append("")

    L.append("## 2. DMs / forms — YOU send these (never automated)")
    if data["dms"]:
        L.append("")
        for d in data["dms"]:
            ch = d.get("channel") or "form"
            L.append(f"- **{d['name']}** via `{ch}` — open `dm_copilot.html` to copy + deep-link")
    else:
        L.append("\n_None due._")
    L.append("")

    L.append("## 2b. No contact channel — find the site first")
    if data["lookups"]:
        L.append("")
        for d in data["lookups"]:
            L.append(f"- **{d['name']}** — web-search `{d['name']} OnlyFans agency official site`, "
                     "add the domain to `data/agencies.csv`, then `make harvest`")
    else:
        L.append("\n_None._")
    L.append("")

    L.append("## 3. Calls due")
    if data["calls"]:
        for d in data["calls"]:
            L.append(f"- **{d['name']}** — {d.get('phone') or 'no number'}")
    else:
        L.append("\n_None due._")
    L.append("")

    L.append("## 4. FedEx / physical")
    if data["fedex"]:
        for d in data["fedex"]:
            L.append(f"- **{d['name']}** → {d.get('owner_name') or '(owner unknown)'}")
            L.append(f"  - {d.get('postal_addr') or 'no address — run sunbiz.py'}")
    else:
        L.append("\n_None due._")
    L.append("")

    L.append("## 5. Replies waiting on you")
    if data["replies"]:
        for r in data["replies"]:
            L.append(f"- **{r['name']}** — draft: `{r['draft'] or '(none)'}`")
    else:
        L.append("\n_None._")
    L.append("")
    L.append("---")
    L.append(f"_Generated {datetime.now():%Y-%m-%d %H:%M}. "
             "DMs and posts are assisted-manual by design — platform ToS._")
    TODAY_MD.write_text("\n".join(L) + "\n", encoding="utf-8")


CSS = """
:root{--bg:#0d0d12;--card:#16161f;--b:#2a2a38;--tx:#e8e6e3;--mu:#9a97a4;--acc:#d4af37;--ok:#2ecc71}
*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--bg);color:var(--tx);
font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
h1{font-size:20px;margin:0 0 4px}.sub{color:var(--mu);font-size:13px;margin-bottom:22px}
.card{background:var(--card);border:1px solid var(--b);border-radius:12px;padding:16px;margin-bottom:14px}
.hd{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}
.nm{font-weight:700}.tier{font-size:11px;color:var(--mu);border:1px solid var(--b);border-radius:20px;padding:2px 9px}
textarea{width:100%;min-height:92px;background:#0a0a0f;color:var(--tx);border:1px solid var(--b);
border-radius:8px;padding:11px;font:13px/1.5 ui-monospace,Menlo,monospace;resize:vertical}
.row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
a.lnk,button{border:1px solid var(--b);background:#1e1e29;color:var(--tx);border-radius:7px;
padding:9px 14px;font-size:13px;cursor:pointer;text-decoration:none;display:inline-block;min-height:38px}
button.copy{background:var(--acc);color:#111;border-color:var(--acc);font-weight:700}
button.copy.done{background:var(--ok);border-color:var(--ok)}
a.lnk:hover,button:hover{border-color:var(--acc)}
.warn{background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.3);border-radius:10px;
padding:12px 14px;margin-bottom:20px;font-size:13px;color:var(--acc)}
.empty{color:var(--mu);text-align:center;padding:40px}
"""

JS = """
function cp(i){
  const t=document.getElementById('t'+i), b=document.getElementById('b'+i);
  t.select(); t.setSelectionRange(0,99999);
  navigator.clipboard.writeText(t.value).then(()=>{
    b.textContent='COPIED ✓'; b.classList.add('done');
    setTimeout(()=>{b.textContent='COPY'; b.classList.remove('done');},1600);
  });
}
"""


def write_copilot(data: dict, today: date) -> None:
    cards = []
    for i, d in enumerate(data["dms"]):
        links = "".join(
            f'<a class="lnk" href="{html.escape(u)}" target="_blank" rel="noopener">{html.escape(lbl)}</a>'
            for lbl, u in deep_links(d)
        ) or '<span style="color:var(--mu);font-size:13px">no channel on file — needs manual lookup</span>'
        txt = html.escape(d.get("payload") or "")
        cards.append(f"""
  <div class="card">
    <div class="hd"><span class="nm">{html.escape(d['name'])}</span>
      <span class="tier">tier {d.get('tier','?')} · {html.escape(d.get('channel') or 'form')}</span></div>
    <textarea id="t{i}" readonly>{txt}</textarea>
    <div class="row">
      <button class="copy" id="b{i}" onclick="cp({i})">COPY</button>{links}
    </div>
  </div>""")

    body = "".join(cards) or '<div class="empty">No DM tasks due today.</div>'
    COPILOT.write_text(f"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DM Copilot — {today}</title><style>{CSS}</style></head><body>
<h1>DM Copilot</h1><div class="sub">{today:%A %d %B %Y} · {len(data['dms'])} target(s)</div>
<div class="warn"><b>Assisted-manual only.</b> This page never sends. Tap COPY, tap the
channel link, paste, and send it yourself — automated DMs violate every platform's ToS.</div>
{body}
<script>{JS}</script></body></html>""", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-open", action="store_true")
    ap.add_argument("--date", help="YYYY-MM-DD (default today) — use to preview tomorrow")
    a = ap.parse_args()

    cfg = config.load()
    db.init()
    today = date.fromisoformat(a.date) if a.date else date.today()
    with db.connect() as c:
        data = gather(c, today)
        counts = db.counts_by_state(c)

    write_today_md(data, today, cfg)
    write_copilot(data, today)

    print(f"\n\033[1mDAILY BRIEF — {today}\033[0m")
    print(f"  emails queued : {len(data['emails'])}")
    print(f"  DM/form tasks : {len(data['dms'])}")
    print(f"  need a site   : {len(data['lookups'])}")
    print(f"  calls due     : {len(data['calls'])}")
    print(f"  FedEx due     : {len(data['fedex'])}")
    print(f"  replies open  : {len(data['replies'])}")
    print(f"  states        : {counts}")
    print(f"  → {TODAY_MD.name} · {COPILOT.name}")

    if not a.no_open:
        for p in (TODAY_MD, COPILOT):
            subprocess.run(["open", str(p)], check=False, capture_output=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
