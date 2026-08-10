#!/usr/bin/env python3
"""Local read/write API behind the admin dashboard's Outreach tab.

Binds to loopback only. There is no login: the security boundary is the bind
address plus an explicit CORS origin allow-list.

Why that is sufficient, and why allow_origins=["*"] would NOT be: a POST of
application/json is not a CORS "simple request", so the browser sends a preflight
OPTIONS first and refuses the real request when the origin is not on the list.
With "*", any page open in the same browser could suppress an agency or send mail
from your address. That list is the whole authorisation model, so it stays exact.

    make api          foreground
    make install      as a launchd job — starts at login, restarts on crash
"""

from __future__ import annotations

import argparse
import os
import smtplib
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mailer  # noqa: E402
from reply_watcher import reply_subject  # noqa: E402  (one Re:-normaliser, shared)
from tts_outreach import config, db, guardrails  # noqa: E402

HOST = os.environ.get("OUTREACH_API_HOST", "127.0.0.1")
PORT = int(os.environ.get("OUTREACH_API_PORT", "8787"))

ALLOWED_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:4173", "http://127.0.0.1:4173",
    "http://localhost:3000", "http://127.0.0.1:3000",
    "https://app.temptationtoken.io",
]
if os.environ.get("OUTREACH_API_ORIGINS"):
    ALLOWED_ORIGINS += [o.strip() for o in os.environ["OUTREACH_API_ORIGINS"].split(",") if o.strip()]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init()          # applies pending column migrations on every boot
    yield


app = FastAPI(title="TTS Outreach", docs_url="/docs", redoc_url=None, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


# ── helpers ───────────────────────────────────────────────────────────────

def _agency_or_404(c, name: str):
    row = db.find_agency_by_name(c, (name or "").strip())
    if not row:
        raise HTTPException(404, f"No agency named {name!r}")
    return row


def _reply_dict(r) -> dict:
    return {
        "id": r["id"],
        "agency": r["agency"],
        "agency_email": r["agency_email"] or "",
        "from_addr": r["from_addr"],
        "subject": r["subject"] or "",
        "message": (r["body"] or "").rstrip(),
        "intent": r["kind"] or "unclear",
        "received": r["created_at"],
        "draft": (r["draft"] or "").rstrip(),
        "draft_subject": r["draft_subject"] or reply_subject(r["subject"] or ""),
        "suppressed": (r["agency_state"] or "").upper() == "SUPPRESSED",
    }


def _split_subject(bodytext: str, fallback: str) -> tuple[str, str]:
    """Pull a leading `Subject:` line off an edited draft, if it still has one.

    Drafts are written with the subject inline so they read as a whole email in a
    text file. The dashboard edits them in a textarea, so whatever comes back may
    or may not still carry that line; both have to work.
    """
    lines = (bodytext or "").splitlines()
    if lines and lines[0].lower().startswith("subject:"):
        return lines[0].split(":", 1)[1].strip() or fallback, "\n".join(lines[1:]).lstrip("\n")
    return fallback, bodytext


# ── models ────────────────────────────────────────────────────────────────

class ReplyIn(BaseModel):
    agency: str = Field(min_length=1)
    body: str = Field(min_length=1)
    subject: str | None = None


class AgencyIn(BaseModel):
    agency: str = Field(min_length=1)


class StageIn(BaseModel):
    agency: str = Field(min_length=1)
    stage: str = Field(min_length=1)   # call-booked | pilot | resume


# ── read ──────────────────────────────────────────────────────────────────

@app.get("/outreach/board")
def get_board() -> dict:
    cfg = config.load()
    with db.connect() as c:
        rows = db.board(c)
        unread = db.unread_count(c)
        sent_today = db.sends_today(c)
    tally: dict[str, int] = {}
    for r in rows:
        tally[r["state"]] = tally.get(r["state"], 0) + 1
    window_ok, window_why = guardrails.in_send_window()
    transport_ok, _ = mailer.check()
    return {
        "agencies": rows,
        "tally": tally,
        "states": db.BOARD_STATES,
        "unread": unread,
        "dry_run": cfg.dry_run,
        "transport": mailer.transport(),
        "from_addr": mailer.from_address(cfg),
        "bridge_up": transport_ok,
        "send_window_open": window_ok,
        "send_window_why": window_why,
        "sent_today": sent_today,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


@app.get("/outreach/replies")
def get_replies() -> dict:
    with db.connect() as c:
        rows = [_reply_dict(r) for r in db.open_replies(c)]
    return {"replies": rows, "unread": len(rows)}


@app.get("/outreach/unread")
def get_unread() -> dict:
    with db.connect() as c:
        return {"unread": db.unread_count(c)}


@app.get("/outreach/status")
def get_status() -> dict:
    cfg = config.load()
    ok, lines = mailer.check()
    with db.connect() as c:
        agencies = c.execute("SELECT COUNT(*) AS n FROM agencies").fetchone()["n"]
        unread = db.unread_count(c)
        sent_today = db.sends_today(c)
    return {
        "ok": True,
        "dry_run": cfg.dry_run,
        "transport": mailer.transport(),
        "from_addr": mailer.from_address(cfg),
        "bridge_up": ok,
        "bridge_detail": lines,
        "agencies": agencies,
        "unread": unread,
        "sent_today": sent_today,
    }


# ── write ─────────────────────────────────────────────────────────────────

@app.post("/outreach/reply")
def post_reply(payload: ReplyIn) -> dict:
    cfg = config.load()
    with db.connect() as c:
        row = _agency_or_404(c, payload.agency)
        to_addr = row["email"]
        if not to_addr:
            raise HTTPException(409, f"{row['name']} has no email address on file")
        was_suppressed = (row["state"] or "").upper() == "SUPPRESSED"
        agency_id, agency_name = row["id"], row["name"]

    fallback = reply_subject(payload.subject or "")
    subject, body = _split_subject(payload.body, payload.subject or fallback)
    if not body.strip():
        raise HTTPException(422, "Reply body is empty")

    # DRY_RUN is this tree's promise that nothing leaves the machine. A manual reply
    # is still mail, so it honours the flag: the .eml is written to outbox/ and the
    # reply stays queued, because it genuinely has not been answered.
    if cfg.dry_run:
        out = config.OUTBOX_DIR / f"{datetime.now():%Y%m%d}_{agency_name.replace('/', '-')}_REPLY.eml"
        out.write_text(f"To: {to_addr}\nSubject: {subject}\n\n{body}", encoding="utf-8")
        with db.connect() as c:
            return {
                "sent": False, "dry_run": True, "agency": agency_name,
                "saved_to": str(out.relative_to(config.ROOT)),
                "unread": db.unread_count(c),
                "message": "DRY_RUN is on — draft saved to outbox, nothing sent. "
                           "Set DRY_RUN=false in outreach/.env to send for real.",
            }

    try:
        mid = mailer.deliver(cfg, to_addr, subject, body)
    except ConnectionError as e:
        raise HTTPException(503, str(e)) from e
    except PermissionError as e:
        raise HTTPException(409, str(e)) from e
    except (smtplib.SMTPException, OSError) as e:
        raise HTTPException(502, f"Send failed: {e}") from e

    with db.connect() as c:
        c.execute(
            """INSERT INTO sends (agency_id, step, to_email, subject, body, message_id,
                                  dry_run, sent_at) VALUES (?,?,?,?,?,?,0,?)""",
            (agency_id, 0, to_addr, subject, body, mid, db.now_iso()))
        cleared = db.mark_replies_handled(c, agency_id)
        db.log(c, agency_id, "REPLY_SENT", channel="email", detail=subject)
        # An opt-out that receives a courtesy confirmation stays SUPPRESSED — that
        # state is terminal by design, and resurrecting it is the CAN-SPAM bug the
        # state machine exists to prevent.
        if not was_suppressed:
            try:
                db.set_state(c, agency_id, "REPLIED", "answered from dashboard")
            except ValueError:
                pass   # already past REPLIED (CALL_BOOKED/PILOT) — leave it ahead
        fresh = next((a for a in db.board(c) if a["id"] == agency_id), None)
        unread = db.unread_count(c)

    return {"sent": True, "dry_run": False, "agency": agency_name, "to": to_addr,
            "subject": subject, "message_id": mid, "cleared": cleared,
            "unread": unread, "state": fresh["state"] if fresh else None,
            "transport": mailer.transport()}


@app.post("/outreach/suppress")
def post_suppress(payload: AgencyIn) -> dict:
    with db.connect() as c:
        row = _agency_or_404(c, payload.agency)
        db.suppress(c, row["id"], row["email"] or "", "suppressed from dashboard")
        # The conversation is over, so anything open for them is answered by definition.
        cleared = db.mark_replies_handled(c, row["id"])
        return {"agency": row["name"], "state": "suppressed", "cleared": cleared,
                "unread": db.unread_count(c)}


@app.post("/outreach/pause")
def post_pause(payload: AgencyIn) -> dict:
    """Stop the sequence without ending the relationship.

    Deliberately does NOT clear open replies: pausing automation is not the same as
    answering someone, and a reply that quietly vanished from the queue is a reply
    that never gets answered.
    """
    with db.connect() as c:
        row = _agency_or_404(c, payload.agency)
        if (row["state"] or "").upper() == "SUPPRESSED":
            raise HTTPException(409, f"{row['name']} is suppressed — that state is permanent")
        db.set_paused(c, row["id"], True)
        return {"agency": row["name"], "state": "paused", "unread": db.unread_count(c)}


@app.post("/outreach/stage")
def post_stage(payload: StageIn) -> dict:
    """Advance the two pipeline states no inbox can reveal — a booked call and a
    running pilot — plus `resume` to lift a pause."""
    wanted = payload.stage.strip().lower().replace("_", "-")
    mapping = {"call-booked": "CALL_BOOKED", "pilot": "PILOT", "resume": None}
    if wanted not in mapping:
        raise HTTPException(422, "stage must be one of: call-booked, pilot, resume")

    with db.connect() as c:
        row = _agency_or_404(c, payload.agency)
        if wanted == "resume":
            db.set_paused(c, row["id"], False)
        else:
            db.set_paused(c, row["id"], False)
            try:
                db.set_state(c, row["id"], mapping[wanted], "set from dashboard")
            except ValueError as e:
                # The state machine refuses illegal jumps; surface its own reason
                # rather than silently doing nothing.
                raise HTTPException(409, str(e)) from e
        fresh = next((a for a in db.board(c) if a["id"] == row["id"]), None)
        return {"agency": row["name"], "state": fresh["state"] if fresh else wanted}


def main() -> int:
    ap = argparse.ArgumentParser(description="Local outreach API for the admin dashboard.")
    ap.add_argument("--host", default=HOST)
    ap.add_argument("--port", type=int, default=PORT)
    ap.add_argument("--self-test", action="store_true", help="exercise the read paths, no server")
    args = ap.parse_args()

    if args.self_test:
        db.init()
        b = get_board()
        print(f"  board       {len(b['agencies'])} agencies  " +
              "  ".join(f"{k}={v}" for k, v in sorted(b["tally"].items())))
        print(f"  dry_run     {b['dry_run']}")
        print(f"  transport   {b['transport']}  (reachable: {b['bridge_up']})")
        print(f"  replies     {len(get_replies()['replies'])} open")
        print(f"  unread      {get_unread()['unread']}")
        return 0

    if not mailer.is_loopback(args.host):
        # This process has no authentication. Off loopback it is an unauthenticated
        # mail-sending endpoint on the network.
        print(f"  REFUSED: --host {args.host} is not loopback. This API has no auth and "
              f"must not listen on a routable address.")
        return 2

    import uvicorn
    print(f"\n  Outreach API -> http://{args.host}:{args.port}   (docs at /docs)")
    print(f"  Dashboard tab: Operations -> Outreach\n")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
