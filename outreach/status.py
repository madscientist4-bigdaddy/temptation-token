#!/usr/bin/env python3
"""`make status` — what the outreach system believes right now."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mailer  # noqa: E402
from tts_outreach import config, db, guardrails  # noqa: E402


def api_status() -> tuple[bool, str]:
    """Checked over HTTP rather than by port scan, so a stale listener with a broken
    app cannot report itself healthy."""
    host = os.environ.get("OUTREACH_API_HOST", "127.0.0.1")
    port = os.environ.get("OUTREACH_API_PORT", "8787")
    url = f"http://{host}:{port}/outreach/status"
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            data = json.loads(r.read().decode())
        return True, f"UP    {url}  ({data.get('unread', 0)} unread)"
    except urllib.error.URLError as e:
        return False, f"DOWN  {url}  ({getattr(e, 'reason', e)}) — run `make api` or `make install`"
    except Exception as e:
        return False, f"DOWN  {url}  ({type(e).__name__}: {e})"


def main() -> int:
    cfg = config.load()
    db.init()

    with db.connect() as c:
        rows = db.board(c)
        unread = db.unread_count(c)
        sent_live = c.execute("SELECT COUNT(*) n FROM sends WHERE dry_run=0").fetchone()["n"]
        sent_dry = c.execute("SELECT COUNT(*) n FROM sends WHERE dry_run=1").fetchone()["n"]
        open_tasks = c.execute("SELECT kind, COUNT(*) n FROM tasks WHERE done=0 "
                               "GROUP BY kind ORDER BY kind").fetchall()
        today = db.sends_today(c)

    tally: dict[str, int] = {}
    for r in rows:
        tally[r["state"]] = tally.get(r["state"], 0) + 1

    win_ok, win_why = guardrails.in_send_window()
    mail_ok, mail_lines = mailer.check()
    api_ok, api_line = api_status()

    print()
    print(f"  mode          {'DRY-RUN (nothing sends)' if cfg.dry_run else 'LIVE'}")
    print(f"  transport     {mailer.transport()}   from {mailer.from_address(cfg) or '(unset)'}")
    print(f"  reachable     {'yes' if mail_ok else 'NO'}")
    for ln in mail_lines:
        print(f"                {ln}")
    print(f"  agencies      {len(rows)}")
    print(f"  board         " + "  ".join(f"{k}={v}" for k, v in sorted(tally.items())))
    print(f"  send window   {'OPEN' if win_ok else 'CLOSED — ' + win_why}")
    print(f"  emails        {sent_live} live · {sent_dry} previewed · {today} today")
    if open_tasks:
        print("  open tasks    " + "  ".join(f"{r['kind']}={r['n']}" for r in open_tasks))
    print(f"  unread        {unread}" + ("   <- waiting on you" if unread else ""))
    print(f"  dashboard api {api_line}")
    if api_ok:
        print("                dashboard tab: Operations -> Outreach")

    print("\n  launchd jobs:")
    try:
        out = subprocess.run(["launchctl", "list"], capture_output=True, text=True,
                             timeout=10).stdout
        jobs = [ln for ln in out.splitlines() if "outreach" in ln]
        print("\n".join("    " + j for j in jobs) if jobs
              else "    (none loaded — run `make install`)")
    except Exception:
        print("    (could not query launchctl)")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
