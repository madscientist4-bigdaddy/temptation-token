"""MODULE F — TODAY.md + the DM copilot page.

The copilot is assist-only by design: it renders the message and a deep link,
and you copy/paste/send by hand. It never posts to Instagram, X, Telegram or
WhatsApp — automating those DMs violates their terms and is the fastest way to
lose the accounts you need.
"""
from __future__ import annotations


# ── SUPERSEDED — DO NOT RUN ──────────────────────────────────────────────────
# Replaced by ../outreach/, which sends unattended over Proton Bridge SMTP.
#
# A DRY_RUN of this file wrote 27 .eml files addressed to real agencies containing
# claims now known to be false ("$2,500 funded prize pool", "keeps 50% of every vote",
# "paid weekly in USDC") plus a footer with no postal address (CAN-SPAM). macOS binds
# .eml to Mail.app, so opening one produced a Mail compose window that looked like a
# draft waiting to be sent. Those files are quarantined in ./QUARANTINE/.
#
#   cd ../outreach && make send        # campaign, unattended
#   cd ../outreach && make send-one    # one-off correspondence
import sys as _sys
print("SUPERSEDED — use ../outreach/. See tts-outreach/QUARANTINE/README.txt",
      file=_sys.stderr)
raise SystemExit(2)
# ─────────────────────────────────────────────────────────────────────────────

import argparse
import html
import re
import subprocess
import sys
from datetime import date, datetime, timedelta

import blocklist
import config
import db
import sender

DM_TEMPLATE = (config.TEMPLATES / "dm.txt")


def dm_text() -> str:
    return DM_TEMPLATE.read_text(encoding="utf-8").strip() if DM_TEMPLATE.exists() else ""


def dm_links(row) -> list[tuple[str, str]]:
    out = []
    if row["instagram"]:
        h = row["instagram"].lstrip("@")
        out.append(("Instagram", f"https://www.instagram.com/{h}/"))
    if row["x_handle"]:
        # X's compose deep link needs a numeric recipient_id we don't have, so
        # link the profile — the DM button is one tap from there.
        out.append(("X profile", f"https://x.com/{row['x_handle'].lstrip('@')}"))
    if row["telegram"]:
        h = row["telegram"].lstrip("@")
        out.append(("Telegram", f"https://t.me/{h}"))
    if row["phone"]:
        num = "".join(ch for ch in row["phone"] if ch.isdigit())
        if num:
            out.append(("WhatsApp", f"https://wa.me/{num}"))
    if row["form_url"]:
        out.append(("Contact form", row["form_url"]))
    return out


EU_TLDS = (".de", ".nl", ".eu", ".co.uk", ".uk", ".fr", ".es", ".it", ".at", ".ch", ".pl", ".ie")


def eu_flag(row) -> str:
    """Why this target may be EU/UK, and therefore not safe to cold-email.

    US CAN-SPAM allows opt-out-only commercial email. The EU/UK do not work that
    way: GDPR + ePrivacy generally require a lawful basis, and Germany's UWG §7
    treats unsolicited B2B advertising email as unlawful WITHOUT prior consent —
    with published Impressum addresses specifically not usable for advertising.
    An Impressum page is a German-law artifact, so finding one is a strong
    signal.
    """
    reasons = []
    dom = (row["domain"] or "").lower()
    if dom.endswith(EU_TLDS):
        reasons.append(f"{dom.rsplit('.', 1)[-1]} domain")
    with db.conn() as c:
        srcs = c.execute(
            "SELECT source_url FROM contacts_found WHERE agency_id=? AND kind='email'",
            (row["id"],)).fetchall()
    if any(re.search(r"impressum|imprint", (s["source_url"] or ""), re.I) for s in srcs):
        reasons.append("publishes an Impressum (German-law requirement)")
    angle = (row["angle_line"] or "").lower()
    for kw, why in (("european", "angle line says European"), ("uk ", "angle line says UK"),
                    ("amsterdam", "angle line references Amsterdam")):
        if kw in angle:
            reasons.append(why)
    return "; ".join(dict.fromkeys(reasons))


def collect(target_day: date) -> dict:
    email_tasks, dm_tasks, fedex_tasks, nurture_tasks = [], [], [], []
    for t in db.due_email_steps(on=target_day):
        row = db.get_agency(t["agency_id"])
        blocked, _ = blocklist.check_agency(row)
        if not blocked and row["email"]:
            email_tasks.append((t, row))
    for t in db.due_tasks(on=target_day):
        row = db.get_agency(t["agency_id"])
        blocked, why = blocklist.check_agency(row)
        if blocked:
            continue
        if t["kind"] in config.EMAIL_STEPS:
            continue
        elif t["kind"] == "DM":
            dm_tasks.append((t, row))
        elif t["kind"] == "FEDEX":
            fedex_tasks.append((t, row))
        elif t["kind"] == "NURTURE":
            nurture_tasks.append((t, row))

    calls = [r for r in db.all_agencies()
             if r["phone"] and r["status"] in config.CONTACTABLE]

    with db.conn() as c:
        replies = c.execute(
            """SELECT r.*, a.name FROM replies r JOIN agencies a ON a.id=r.agency_id
               WHERE a.status='REPLIED' ORDER BY r.ts DESC LIMIT 25""").fetchall()
        fedex_rows = c.execute("SELECT * FROM agencies WHERE status NOT IN ('HOLD','BLOCKED','SUPPRESSED')").fetchall()

    return {"email": email_tasks, "dm": dm_tasks, "fedex": fedex_tasks,
            "nurture": nurture_tasks, "calls": calls, "replies": replies,
            "fedex_rows": fedex_rows}


def write_today_md(day: date, data: dict) -> str:
    cap = sender.daily_cap()
    ok, why = sender.in_window(datetime.combine(day, datetime.min.time().replace(hour=10), config.ET))
    mode = "DRY-RUN" if config.DRY_RUN else "LIVE"

    L = []
    L.append(f"# TODAY — {day:%A, %B %-d, %Y}")
    L.append("")
    L.append(f"Mode **{mode}** · daily cap **{cap}** · send window Mon–Fri 09:00–16:00 ET"
             + ("" if ok else f" · ⚠️ {why}"))
    L.append("")

    L.append("## 1. Emails auto-queued today")
    L.append("")
    if data["email"]:
        L.append("| # | Agency | Step | To | Tier |")
        L.append("|---|---|---|---|---|")
        for i, (t, row) in enumerate(data["email"][:cap], 1):
            L.append(f"| {i} | {row['name']} | {t['kind']} | `{row['email']}` | {row['tier']} |")
        overflow = len(data["email"]) - cap
        if overflow > 0:
            L.append("")
            L.append(f"_{overflow} more queued beyond today's cap — they roll to tomorrow._")
        L.append("")
        L.append(f"These go out automatically when `sender.py` runs inside the window."
                 + ("  \n**DRY_RUN is on — nothing will actually send.**" if config.DRY_RUN else ""))
    else:
        L.append("_Nothing queued._")
    L.append("")

    L.append("## 2. DM tasks — manual, copy/paste")
    L.append("")
    if data["dm"]:
        for t, row in data["dm"]:
            links = dm_links(row)
            L.append(f"### {row['name']}")
            if links:
                L.append("Open: " + " · ".join(f"[{lbl}]({url})" for lbl, url in links))
            else:
                L.append("_No handle on file — find one first._")
            L.append("")
            L.append("```")
            L.append(dm_text())
            L.append("```")
            L.append("")
        L.append("Use `dm_copilot.html` for one-tap copy buttons.")
    else:
        L.append("_No DM tasks due._")
    L.append("")

    L.append("## 3. Calls due")
    L.append("")
    if data["calls"]:
        L.append("| Agency | Phone | Status |")
        L.append("|---|---|---|")
        for r in data["calls"]:
            L.append(f"| {r['name']} | `{r['phone']}` | {r['status']} |")
    else:
        L.append("_No phone numbers on file yet._")
    L.append("")

    L.append("## 4. FedEx due")
    L.append("")
    if data["fedex"]:
        L.append("Run `sunbiz.py` first if any address below is blank —")
        L.append("that is where the registered-agent and principal address come from.")
        L.append("")
        L.append("| Agency | Address | Officer |")
        L.append("|---|---|---|")
        for t, row in data["fedex"]:
            L.append(f"| {row['name']} | _(see data/fedex_list.csv)_ | _(see data/fedex_list.csv)_ |")
    else:
        L.append("_None due._")
    L.append("")

    L.append("## 5. Replies awaiting you")
    L.append("")
    if data["replies"]:
        for r in data["replies"]:
            L.append(f"- **{r['name']}** — `{r['intent']}` — _{r['subject']}_  ")
            L.append(f"  draft: `drafts/{r['name'].replace(' ', '_')}.txt`")
    else:
        L.append("_No replies yet._")
    L.append("")

    eu = [(r, eu_flag(r)) for r in db.all_agencies()
          if r["status"] in config.CONTACTABLE and eu_flag(r)]
    if eu:
        L.append("## 6. ⚠️ EU / UK jurisdiction — do not send opt-out-only")
        L.append("")
        L.append("CAN-SPAM's opt-out model does not apply here. Germany's UWG §7 treats")
        L.append("unsolicited B2B advertising email as unlawful without **prior consent**, and")
        L.append("an address published in an Impressum may not be used for advertising at all.")
        L.append("Get these reviewed before they are emailed — or reach them via their own")
        L.append("contact form, which is a request *they* invited.")
        L.append("")
        L.append("| Agency | Email | Why flagged |")
        L.append("|---|---|---|")
        for r, why in eu:
            L.append(f"| {r['name']} | `{r['email'] or '—'}` | {why} |")
        L.append("")

    L.append("---")
    L.append("")
    L.append("### Standing rules")
    L.append("- DMs are **assisted manual only** — never automate IG/X/Telegram sending.")
    L.append("- Anyone who says remove/stop/not interested is suppressed permanently, automatically.")
    L.append("- Blocklist is enforced at send time; a match halts that target's whole sequence.")
    L.append("- EU/UK targets in section 6 need a lawful basis before any email — not just an opt-out link.")
    L.append("")

    out = config.ROOT / "TODAY.md"
    out.write_text("\n".join(L), encoding="utf-8")
    return str(out)


def write_copilot(day: date, data: dict) -> str:
    dm = dm_text()
    cards = []
    for t, row in data["dm"]:
        links = "".join(
            f'<a class="lnk" href="{html.escape(u)}" target="_blank" rel="noopener">{html.escape(l)} ↗</a>'
            for l, u in dm_links(row))
        cards.append(f"""
  <article class="card">
    <h2>{html.escape(row['name'])} <span class="tier">tier {row['tier']}</span></h2>
    <div class="links">{links or '<em class="muted">no handle on file</em>'}</div>
    <textarea readonly rows="5">{html.escape(dm)}</textarea>
    <button onclick="copyBox(this)">Copy message</button>
  </article>""")

    body = "".join(cards) or '<p class="muted">No DM tasks due today.</p>'
    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DM Copilot — {day:%b %-d}</title>
<style>
  :root {{ color-scheme: light dark; --bg:#fbfbfd; --fg:#16161a; --mut:#6b6b76;
           --card:#fff; --line:#e4e4ea; --accent:#5b3df5; }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --bg:#111114; --fg:#ececf1; --mut:#9a9aa5; --card:#1a1a20; --line:#2a2a33; --accent:#8b74ff; }}
  }}
  * {{ box-sizing:border-box }}
  body {{ margin:0; padding:32px 20px 64px; background:var(--bg); color:var(--fg);
         font:15px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif; }}
  .wrap {{ max-width:760px; margin:0 auto }}
  h1 {{ font-size:1.5rem; margin:0 0 4px }}
  .sub {{ color:var(--mut); margin:0 0 28px }}
  .warn {{ border:1px solid var(--line); border-left:3px solid var(--accent);
           background:var(--card); padding:12px 16px; border-radius:8px; margin-bottom:28px;
           color:var(--mut); font-size:.9rem }}
  .card {{ background:var(--card); border:1px solid var(--line); border-radius:12px;
           padding:18px 20px; margin-bottom:18px }}
  .card h2 {{ font-size:1.05rem; margin:0 0 10px; display:flex; align-items:center; gap:10px }}
  .tier {{ font-size:.7rem; font-weight:500; color:var(--mut); border:1px solid var(--line);
           padding:2px 7px; border-radius:99px }}
  .links {{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px }}
  .lnk {{ font-size:.85rem; text-decoration:none; color:var(--accent);
          border:1px solid var(--line); padding:5px 10px; border-radius:7px }}
  .lnk:hover {{ border-color:var(--accent) }}
  textarea {{ width:100%; border:1px solid var(--line); border-radius:8px; padding:11px;
              background:var(--bg); color:var(--fg); font:13px/1.5 ui-monospace,Menlo,monospace;
              resize:vertical }}
  button {{ margin-top:10px; background:var(--accent); color:#fff; border:0; cursor:pointer;
            padding:9px 16px; border-radius:8px; font-size:.9rem; font-weight:500 }}
  button.done {{ background:#1a9c5b }}
  .muted {{ color:var(--mut) }}
</style></head><body><div class="wrap">
<h1>DM Copilot</h1>
<p class="sub">{day:%A, %B %-d, %Y}</p>
<div class="warn"><strong>Assisted manual only.</strong> Copy → open → paste → send yourself.
Nothing here posts on your behalf; automating DMs on Instagram, X or Telegram breaks their
terms and risks the accounts.</div>
{body}
</div>
<script>
function copyBox(btn) {{
  const ta = btn.parentElement.querySelector('textarea');
  navigator.clipboard.writeText(ta.value).then(() => {{
    const old = btn.textContent;
    btn.textContent = 'Copied ✓'; btn.classList.add('done');
    setTimeout(() => {{ btn.textContent = old; btn.classList.remove('done'); }}, 1600);
  }});
}}
</script></body></html>"""
    out = config.ROOT / "dm_copilot.html"
    out.write_text(doc, encoding="utf-8")
    return str(out)


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate TODAY.md and dm_copilot.html")
    ap.add_argument("--for", dest="when", default="today", choices=["today", "tomorrow"])
    ap.add_argument("--open", action="store_true", help="open both files when done")
    args = ap.parse_args()

    db.init()
    day = date.today() + (timedelta(days=1) if args.when == "tomorrow" else timedelta(0))
    data = collect(day)
    md = write_today_md(day, data)
    hp = write_copilot(day, data)
    print(f"wrote {md}")
    print(f"wrote {hp}")
    if args.open:
        subprocess.run(["open", md], check=False)
        subprocess.run(["open", hp], check=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
