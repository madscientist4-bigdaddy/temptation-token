#!/usr/bin/env python3
"""TTS sale — daily digest email via Proton Mail Bridge.

Reads tasks.json (same schedule as the workbook Plan tab and the Proton Calendar .ics)
and emails: today's tasks, outreach touches, tomorrow's preview, days to offer review,
and a live-metrics block (filled by metrics_hook() — Claude Code wires it to the app).

Config (env vars, read from the repo .env by the launchd wrapper):
  DIGEST_TO            default jim@temptationtoken.io
  DIGEST_FROM          default jim@temptationtoken.io
  BRIDGE_HOST          default 127.0.0.1
  BRIDGE_SMTP_PORT     default 1025 (Proton Mail Bridge default SMTP port)
  BRIDGE_USER          the Proton address Bridge is logged into
  BRIDGE_PASS          the Bridge-generated password (NOT your Proton login password)
  TTS_TASKS_JSON       path to tasks.json
  DIGEST_MODE          "morning" (default) or "evening" (tomorrow-only preview)
Usage:
  python3 tts_daily_digest.py            # send
  python3 tts_daily_digest.py --dry-run  # print, don't send
"""
import json
import os
import smtplib
import ssl
import sys
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")


def load_plan(path):
    with open(path) as f:
        return json.load(f)


def metrics_hook():
    """Live numbers for the digest. Never raises — see tts_metrics.collect().

    Kept as a thin wrapper so the digest still sends if the metrics module is missing
    entirely (a bad deploy, a half-finished edit): an ImportError here would otherwise
    take the whole morning email down.
    """
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import tts_metrics
        return tts_metrics.collect()
    except Exception as exc:
        return [f"(metrics unavailable: {type(exc).__name__})"]


def fmt_items(items):
    return "\n".join(f"  {i['time_et'] or '--:--'}  [{i['owner']}] {i['task']}" +
                     (f"\n         {i['detail']}" if i.get("detail") else "") for i in items) or "  Nothing scheduled."


def fmt_seq(items):
    return "\n".join(f"  {s['time_et']}  {s['company']} - {s['channel']}: {s['action']}" for s in items) or "  None."


def build(plan, today, mode):
    tasks = plan["tasks"]
    seq = plan.get("sequence", [])
    t_str = today.isoformat()
    tm_str = (today + timedelta(days=1)).isoformat()
    offers = date.fromisoformat(plan["offers_review"])
    days_left = (offers - today).days

    todays = sorted([t for t in tasks if t["date"] == t_str], key=lambda x: x["time_et"])
    tomorrows = sorted([t for t in tasks if t["date"] == tm_str], key=lambda x: x["time_et"])
    seq_today = sorted([s for s in seq if s["date"] == t_str], key=lambda x: x["time_et"])
    mine = [t for t in todays if t["owner"].startswith("Jim")]

    if days_left > 0:
        countdown = f"{days_left} days to offer review (Fri Oct 16, 5 PM ET)"
    elif days_left == 0:
        countdown = "OFFER REVIEW TODAY - 5 PM ET"
    else:
        countdown = "Offer review complete - closing phase"

    if mode == "evening":
        subject = f"TTS tomorrow: {len(tomorrows)} tasks - {countdown}"
        body = f"Tomorrow ({tm_str})\n\n{fmt_items(tomorrows)}\n"
        return subject, body

    subject = f"TTS today: {len(mine)} for you, {len(todays)} total - {countdown}"
    lines = [
        f"Good morning, Jim. {countdown}.",
        "",
        f"TODAY ({t_str})",
        fmt_items(todays),
        "",
        "OUTREACH TOUCHES TODAY",
        fmt_seq(seq_today),
        "",
        "TOMORROW",
        fmt_items(tomorrows),
    ]
    m = metrics_hook()
    if m:
        lines += ["", "LIVE NUMBERS"] + [f"  {x}" for x in m]
    lines += ["", "Rule of the week: reply to every buyer within an hour; screen-share the live app, not slides.",
              "Mark tasks done on the Plan tab of TTS_Sell_This_Software_Plan.xlsx."]
    return subject, "\n".join(lines) + "\n"


def send(subject, body):
    host = os.environ.get("BRIDGE_HOST", "127.0.0.1")
    port = int(os.environ.get("BRIDGE_SMTP_PORT", "1025"))
    user = os.environ["BRIDGE_USER"]
    pw = os.environ["BRIDGE_PASS"]
    to = os.environ.get("DIGEST_TO", "jim@temptationtoken.io")
    frm = os.environ.get("DIGEST_FROM", "jim@temptationtoken.io")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = frm
    msg["To"] = to
    msg.set_content(body)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False          # Bridge uses a self-signed local certificate
    ctx.verify_mode = ssl.CERT_NONE     # local loopback only
    with smtplib.SMTP(host, port, timeout=30) as s:
        s.starttls(context=ctx)
        s.login(user, pw)
        s.send_message(msg)


def main():
    dry = "--dry-run" in sys.argv
    mode = os.environ.get("DIGEST_MODE", "morning")
    path = os.environ.get("TTS_TASKS_JSON", os.path.join(os.path.dirname(__file__), "tasks.json"))
    today = datetime.now(ET).date()
    subject, body = build(load_plan(path), today, mode)
    if dry:
        print(subject)
        print()
        print(body)
        return
    send(subject, body)
    print(f"sent: {subject}")


if __name__ == "__main__":
    main()
