"""MODULE F — local read/write API behind the admin dashboard's Outreach tab.

Binds to loopback only. There is no login: the security boundary is the bind
address plus an explicit CORS origin allow-list.

Why that is sufficient, and why `allow_origins=["*"]` would NOT be:
a POST of `application/json` is not a CORS "simple request", so the browser
sends a preflight OPTIONS first and refuses the real request when the origin is
not on the list. With `*` any page Jim happened to have open could suppress an
agency or send mail from his address. The list below is the whole of the
authorisation model, so it stays short and exact.

Run:  make api          (foreground, reloads nothing, logs to stdout)
      make install      (as a launchd job, starts at login, restarts on crash)
"""
from __future__ import annotations

import argparse
import smtplib
import sys
from contextlib import asynccontextmanager
from datetime import date, datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import blocklist
import bridge
import config
import db
import sender
# One implementation of "Re:" normalisation, shared with the watcher, so a reply
# sent from the dashboard cannot end up with a different subject line than the
# draft the watcher wrote.
from reply_watcher import reply_subject as _re_subject

HOST = config.env("OUTREACH_API_HOST", "127.0.0.1")
PORT = int(config.env("OUTREACH_API_PORT", "8787"))

# The admin dashboard, in every form it is served from. Vite's dev server, and
# the deployed Vercel origin so the same tab works against the live build.
ALLOWED_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:4173", "http://127.0.0.1:4173",
    "http://localhost:3000", "http://127.0.0.1:3000",
    "https://app.temptationtoken.io",
]
_extra = config.env("OUTREACH_API_ORIGINS")
if _extra:
    ALLOWED_ORIGINS += [o.strip() for o in _extra.split(",") if o.strip()]

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

def _agency_or_404(name: str):
    row = db.find_agency_by_name((name or "").strip())
    if not row:
        raise HTTPException(404, f"No agency named {name!r}")
    return row


def _reply_dict(r) -> dict:
    keys = r.keys()
    body = (("body" in keys and r["body"]) or r["snippet"] or "").rstrip()
    return {
        "id": r["id"],
        "agency": r["agency"],
        "agency_email": r["agency_email"] or "",
        "from_addr": r["from_addr"],
        "subject": r["subject"] or "",
        "message": body,
        "intent": r["intent"] or "UNKNOWN",
        "received": r["ts"],
        "draft": (("draft" in keys and r["draft"]) or "").rstrip(),
        "draft_subject": ("draft_subject" in keys and r["draft_subject"]) or _re_subject(r["subject"]),
        "suppressed": (r["agency_status"] or "").upper() in ("SUPPRESSED", "BLOCKED"),
    }


def _split_subject(bodytext: str, fallback: str) -> tuple[str, str]:
    """Pull a leading `Subject:` line off an edited draft, if the box still has one.

    The drafts are written with the subject inline so they read as a whole email
    in a text file. Jim edits them in a textarea, so whatever comes back may or
    may not still carry that line; both have to work.
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
    stage: str = Field(min_length=1)  # call-booked | pilot | clear


# ── read ──────────────────────────────────────────────────────────────────

@app.get("/outreach/board")
def get_board() -> dict:
    rows = db.board()
    tally: dict[str, int] = {}
    for r in rows:
        tally[r["state"]] = tally.get(r["state"], 0) + 1
    window_ok, window_why = sender.in_window()
    bridge_ok, _ = bridge.check()
    return {
        "agencies": rows,
        "tally": tally,
        "states": db.BOARD_STATES,
        "unread": db.unread_count(),
        # Surfaced so the board can never imply outreach is happening when it is not.
        # In dry-run every agency reads `queued`, which is the truth.
        "dry_run": config.DRY_RUN,
        "bridge_up": bridge_ok,
        "send_window_open": window_ok,
        "send_window_why": window_why,
        "sent_today": db.sends_today(),
        "daily_cap": sender.daily_cap(),
        "generated_at": datetime.now().isoformat(timespec="seconds"),
    }


@app.get("/outreach/replies")
def get_replies() -> dict:
    rows = [_reply_dict(r) for r in db.open_replies()]
    return {"replies": rows, "unread": len(rows)}


@app.get("/outreach/unread")
def get_unread() -> dict:
    return {"unread": db.unread_count()}


@app.get("/outreach/status")
def get_status() -> dict:
    """Health for `make status` and the dashboard's connection pill."""
    bridge_ok, lines = bridge.check()
    return {
        "ok": True,
        "dry_run": config.DRY_RUN,
        "from_addr": config.FROM_ADDR,
        "bridge_up": bridge_ok,
        "bridge_detail": lines,
        "agencies": len(db.all_agencies()),
        "unread": db.unread_count(),
        "sent_today": db.sends_today(),
        "daily_cap": sender.daily_cap(),
    }


# ── write ─────────────────────────────────────────────────────────────────

@app.post("/outreach/reply")
def post_reply(payload: ReplyIn) -> dict:
    row = _agency_or_404(payload.agency)
    to_addr = row["email"]
    if not to_addr:
        raise HTTPException(409, f"{row['name']} has no email address on file")

    blocked, why = blocklist.check_agency(row)
    if blocked:
        raise HTTPException(409, f"Blocked recipient: {why}")

    suppressed = (row["status"] or "").upper() in ("SUPPRESSED", "BLOCKED")
    fallback = _re_subject(payload.subject or "")
    subject, body = _split_subject(payload.body, payload.subject or fallback)
    if not body.strip():
        raise HTTPException(422, "Reply body is empty")

    # DRY_RUN is the system's promise that nothing leaves the machine. A manual
    # reply is still mail, so it honours the flag: the .eml is written to outbox/
    # and the reply stays in the queue, because it genuinely has not been answered.
    if config.DRY_RUN:
        out = config.OUTBOX / f"{date.today():%Y%m%d}_{row['name'].replace(' ', '_')}_REPLY.eml"
        out.write_text(f"To: {to_addr}\nSubject: {subject}\n\n{body}", encoding="utf-8")
        db.record_send(row["id"], to_addr, subject, "REPLY", True)
        return {
            "sent": False, "dry_run": True, "agency": row["name"],
            "saved_to": str(out.relative_to(config.ROOT)),
            "unread": db.unread_count(),
            "message": "DRY_RUN is on — draft saved to outbox, nothing sent. "
                       "Set DRY_RUN=false in tts-outreach/.env to send for real.",
        }

    if not bridge.preflight(verbose=False):
        raise HTTPException(503, bridge.BRIDGE_DOWN_MESSAGE)

    msg = sender.build_message(row, subject, body)
    try:
        mid = sender.deliver(msg)
    except (smtplib.SMTPException, OSError) as e:
        db.record_send(row["id"], to_addr, subject, "REPLY", False, None, str(e))
        raise HTTPException(502, f"Send failed: {e}") from e

    db.record_send(row["id"], to_addr, subject, "REPLY", False, mid)
    cleared = db.mark_replies_handled(row["id"])
    # An opt-out that gets a courtesy confirmation stays SUPPRESSED. Flipping it
    # to REPLIED would put it back in the contactable pool, which is precisely
    # what they asked us not to do.
    if not suppressed:
        db.set_status(row["id"], "REPLIED")
    db.halt_sequence(row["id"], "replied from dashboard")
    db.log_event(row["id"], "REPLY_SENT", subject)

    return {
        "sent": True, "dry_run": False, "agency": row["name"], "to": to_addr,
        "subject": subject, "message_id": mid, "cleared": cleared,
        "unread": db.unread_count(),
        "state": db.board_state("SUPPRESSED" if suppressed else "REPLIED", row["stage"], 1),
    }


@app.post("/outreach/suppress")
def post_suppress(payload: AgencyIn) -> dict:
    row = _agency_or_404(payload.agency)
    db.set_status(row["id"], "SUPPRESSED")
    db.halt_sequence(row["id"], "suppressed from dashboard")
    # The conversation is over, so anything open for them is answered by definition.
    cleared = db.mark_replies_handled(row["id"])
    db.log_event(row["id"], "SUPPRESS", "dashboard")
    return {"agency": row["name"], "state": "suppressed", "cleared": cleared,
            "unread": db.unread_count()}


@app.post("/outreach/pause")
def post_pause(payload: AgencyIn) -> dict:
    """Stop the sequence without ending the relationship.

    Deliberately does NOT clear open replies: pausing automation is not the same
    as answering someone, and a reply that quietly vanished from the queue is a
    reply that never gets answered.
    """
    row = _agency_or_404(payload.agency)
    db.set_status(row["id"], "HOLD")
    db.halt_sequence(row["id"], "paused from dashboard")
    db.log_event(row["id"], "PAUSE", "dashboard")
    return {"agency": row["name"], "state": "paused", "unread": db.unread_count()}


@app.post("/outreach/stage")
def post_stage(payload: StageIn) -> dict:
    """Set the two pipeline states no mail traffic can reveal: call-booked, pilot.

    Without this the board could never display them, since nothing in an inbox
    says a call was booked.
    """
    row = _agency_or_404(payload.agency)
    wanted = payload.stage.strip().lower().replace("_", "-")
    mapping = {"call-booked": "CALL_BOOKED", "pilot": "PILOT", "clear": None, "": None}
    if wanted not in mapping:
        raise HTTPException(422, f"stage must be one of: call-booked, pilot, clear")
    db.set_stage(row["id"], mapping[wanted])
    db.log_event(row["id"], "STAGE", wanted)
    fresh = next((a for a in db.board() if a["id"] == row["id"]), None)
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
        print(f"  board      {len(b['agencies'])} agencies  " +
              "  ".join(f"{k}={v}" for k, v in sorted(b["tally"].items())))
        print(f"  dry_run    {b['dry_run']}")
        print(f"  bridge     {'UP' if b['bridge_up'] else 'DOWN'}")
        print(f"  replies    {len(get_replies()['replies'])} open")
        print(f"  unread     {get_unread()['unread']}")
        return 0

    if not bridge.is_loopback(args.host):
        # This process has no authentication. Off loopback it would be an
        # unauthenticated mail-sending endpoint on the network.
        print(f"  REFUSED: --host {args.host} is not loopback. This API has no auth "
              f"and must not listen on a routable address.")
        return 2

    import uvicorn
    print(f"\n  Outreach API -> http://{args.host}:{args.port}   (docs at /docs)")
    print(f"  Dashboard tab: Operations -> Outreach\n")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
