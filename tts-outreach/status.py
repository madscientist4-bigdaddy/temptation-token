"""`make status` — what the system believes right now."""
from __future__ import annotations

import subprocess
from datetime import datetime

import bridge
import config
import db
import sender


def main() -> int:
    db.init()
    rows = db.all_agencies()
    tally: dict[str, int] = {}
    for r in rows:
        tally[r["status"]] = tally.get(r["status"], 0) + 1
    ok, why = sender.in_window()

    print()
    print(f"  now           {datetime.now(config.ET):%Y-%m-%d %H:%M %Z}")
    print(f"  mode          {'DRY-RUN (nothing sends)' if config.DRY_RUN else 'LIVE'}")
    print(f"  from          {config.FROM_ADDR or '(unset)'}")

    # Proton Bridge — the single most common reason this system silently does nothing.
    bridge_ok, bridge_lines = bridge.check()
    print(f"  proton bridge {'UP' if bridge_ok else 'DOWN'}")
    for ln in bridge_lines:
        print(f"                {ln}")
    if not bridge_ok:
        print(f"                {bridge.RED}{bridge.BRIDGE_DOWN_MESSAGE}{bridge.OFF}")
    cred = bridge.credentials_problem()
    if cred:
        print(f"                {bridge.RED}{cred}{bridge.OFF}")
    print(f"  agencies      {len(rows)}   " + "  ".join(f"{k}={v}" for k, v in sorted(tally.items())))
    print(f"  send window   {'OPEN' if ok else 'CLOSED — ' + why}")
    print(f"  cap today     {sender.daily_cap()}   sent so far {db.sends_today()}")
    print(f"  tasks due     {len(db.due_tasks())}")

    with db.conn() as c:
        pend = c.execute("""SELECT kind, COUNT(*) n FROM tasks WHERE status='PENDING'
                            GROUP BY kind ORDER BY kind""").fetchall()
        repl = c.execute("SELECT COUNT(*) FROM replies").fetchone()[0]
    if pend:
        print("  pending       " + "  ".join(f"{r['kind']}={r['n']}" for r in pend))
    print(f"  replies seen  {repl}")

    missing = [r["name"] for r in rows if r["status"] in ("NEEDS_DOMAIN", "NEEDS_REVIEW")]
    if missing:
        print(f"\n  needs you:    {', '.join(missing)}")

    print("\n  launchd jobs:")
    try:
        out = subprocess.run(["launchctl", "list"], capture_output=True, text=True, timeout=10).stdout
        jobs = [ln for ln in out.splitlines() if "outreach" in ln]
        print("\n".join("    " + j for j in jobs) if jobs else "    (none loaded — run `make install`)")
    except Exception:
        print("    (could not query launchctl)")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
