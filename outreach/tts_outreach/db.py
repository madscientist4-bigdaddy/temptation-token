"""
SQLite: all state. The state machine and its legal transitions live here.

  NEW → QUEUED → CONTACTED → REPLIED | NO_REPLY → CALL_BOOKED → PILOT
                      ↘ SUPPRESSED (terminal, permanent)
                      ↘ NURTURE (day 12, no reply)

SUPPRESSED is deliberately irreversible in code: honouring "remove" permanently is a
CAN-SPAM obligation, and a resurrection path is exactly the bug that turns a compliant
system into a violation. There is no unsuppress().
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .config import DB_PATH

STATES = (
    "NEW", "QUEUED", "CONTACTED", "REPLIED", "NO_REPLY",
    "CALL_BOOKED", "PILOT", "SUPPRESSED", "NURTURE",
)

ALLOWED = {
    "NEW": {"QUEUED", "SUPPRESSED"},
    "QUEUED": {"CONTACTED", "SUPPRESSED", "NURTURE"},
    "CONTACTED": {"REPLIED", "NO_REPLY", "SUPPRESSED", "NURTURE", "CONTACTED"},
    "NO_REPLY": {"REPLIED", "NURTURE", "SUPPRESSED", "CONTACTED"},
    "REPLIED": {"CALL_BOOKED", "SUPPRESSED", "NURTURE"},
    "CALL_BOOKED": {"PILOT", "SUPPRESSED", "REPLIED"},
    "PILOT": {"SUPPRESSED"},
    "NURTURE": {"CONTACTED", "REPLIED", "SUPPRESSED"},
    "SUPPRESSED": set(),  # terminal, on purpose
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS agencies (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  domain        TEXT,
  email         TEXT,
  phone         TEXT,
  telegram      TEXT,
  instagram     TEXT,
  x_handle      TEXT,
  form_url      TEXT,
  tier          INTEGER,
  status        TEXT,             -- VERIFIED | HARVEST | FORM_ONLY | HOLD
  angle_line    TEXT,
  state         TEXT NOT NULL DEFAULT 'NEW',
  country       TEXT,
  owner_name    TEXT,
  postal_addr   TEXT,
  utm_code      TEXT,
  seq_started   TEXT,             -- ISO date of day 0
  last_step     INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY,
  agency_id  INTEGER NOT NULL REFERENCES agencies(id),
  kind       TEXT NOT NULL,       -- EMAIL_SENT | EMAIL_DRYRUN | STATE | DM_TASK | REPLY | ...
  step       INTEGER,
  channel    TEXT,
  detail     TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sends (
  id         INTEGER PRIMARY KEY,
  agency_id  INTEGER NOT NULL REFERENCES agencies(id),
  step       INTEGER NOT NULL,
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  message_id TEXT,
  dry_run    INTEGER NOT NULL,
  sent_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY,
  agency_id  INTEGER NOT NULL REFERENCES agencies(id),
  kind       TEXT NOT NULL,       -- DM | FORM | CALL | FEDEX
  channel    TEXT,
  due_date   TEXT NOT NULL,
  payload    TEXT,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppressions (
  email      TEXT PRIMARY KEY,
  reason     TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);

-- Inbound replies, queued for a human. `handled` is the single source of truth for
-- the dashboard's unread badge: the count is always derived from it rather than
-- kept in a separate counter, because a counter and a row set drift the first time
-- anything crashes between the two writes.
CREATE TABLE IF NOT EXISTS replies (
  id            INTEGER PRIMARY KEY,
  agency_id     INTEGER NOT NULL REFERENCES agencies(id),
  from_addr     TEXT NOT NULL,
  subject       TEXT,
  body          TEXT,               -- their full message
  kind          TEXT,               -- opt_out | interested | pricing | yes | unclear
  draft         TEXT,               -- pre-written response, editable in the dashboard
  draft_subject TEXT,
  handled       INTEGER NOT NULL DEFAULT 0,
  handled_at    TEXT,
  msg_uid       TEXT UNIQUE,        -- idempotency: one row per IMAP message, ever
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_events_agency ON events(agency_id);
CREATE INDEX IF NOT EXISTS ix_sends_agency  ON sends(agency_id);
CREATE INDEX IF NOT EXISTS ix_tasks_due     ON tasks(due_date, done);
CREATE INDEX IF NOT EXISTS ix_replies_open  ON replies(handled, created_at);
"""

# Columns added after the first release. SQLite has no "ADD COLUMN IF NOT EXISTS".
MIGRATIONS = [
    # Pausing is deliberately NOT a state. The state machine in ALLOWED encodes the
    # deal pipeline; "stop mailing this one for now" is orthogonal to it and would
    # otherwise need transitions into and out of every state. A flag keeps the
    # machine honest and makes un-pausing trivial — unlike SUPPRESSED, which must
    # stay terminal.
    ("agencies", "paused", "INTEGER NOT NULL DEFAULT 0"),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect(path: Path | None = None):
    conn = sqlite3.connect(path or DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init(path: Path | None = None) -> None:
    with connect(path) as c:
        c.executescript(SCHEMA)
        for table, column, decl in MIGRATIONS:
            cols = {r["name"] for r in c.execute(f"PRAGMA table_info({table})")}
            if column not in cols:
                c.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def upsert_agency(c: sqlite3.Connection, row: dict) -> int:
    """Insert, or update the contact columns without ever clobbering live state."""
    ts = now_iso()
    existing = c.execute("SELECT id FROM agencies WHERE name = ?", (row["name"],)).fetchone()
    cols = ("name", "domain", "email", "phone", "telegram", "instagram", "x_handle",
            "form_url", "tier", "status", "angle_line", "country")
    if existing:
        sets = ", ".join(f"{k} = COALESCE(NULLIF(?, ''), {k})" for k in cols[1:])
        c.execute(
            f"UPDATE agencies SET {sets}, updated_at = ? WHERE id = ?",
            [row.get(k, "") for k in cols[1:]] + [ts, existing["id"]],
        )
        return existing["id"]
    c.execute(
        f"INSERT INTO agencies ({','.join(cols)}, state, created_at, updated_at) "
        f"VALUES ({','.join('?' * len(cols))}, 'NEW', ?, ?)",
        [row.get(k, "") for k in cols] + [ts, ts],
    )
    return int(c.execute("SELECT last_insert_rowid() AS i").fetchone()["i"])


def log(c: sqlite3.Connection, agency_id: int, kind: str, *,
        step: int | None = None, channel: str = "", detail: str = "") -> None:
    c.execute(
        "INSERT INTO events (agency_id, kind, step, channel, detail, created_at) "
        "VALUES (?,?,?,?,?,?)",
        (agency_id, kind, step, channel, detail, now_iso()),
    )


def set_state(c: sqlite3.Connection, agency_id: int, new: str, reason: str = "") -> None:
    row = c.execute("SELECT state, name FROM agencies WHERE id = ?", (agency_id,)).fetchone()
    if row is None:
        raise KeyError(f"no agency {agency_id}")
    cur = row["state"]
    if new not in STATES:
        raise ValueError(f"unknown state {new!r}")
    if cur == new:
        return
    if new not in ALLOWED.get(cur, set()):
        raise ValueError(f"illegal transition {cur} -> {new} for {row['name']!r}")
    c.execute("UPDATE agencies SET state = ?, updated_at = ? WHERE id = ?",
              (new, now_iso(), agency_id))
    log(c, agency_id, "STATE", detail=f"{cur} -> {new}" + (f" ({reason})" if reason else ""))


def suppress(c: sqlite3.Connection, agency_id: int, email: str, reason: str) -> None:
    """Permanent. Recorded twice — on the agency and by address — so a re-import of the
    seed CSV can never quietly resurrect someone who asked to be left alone."""
    c.execute("UPDATE agencies SET state = 'SUPPRESSED', updated_at = ? WHERE id = ?",
              (now_iso(), agency_id))
    if email:
        c.execute(
            "INSERT OR IGNORE INTO suppressions (email, reason, created_at) VALUES (?,?,?)",
            (email.lower().strip(), reason, now_iso()),
        )
    log(c, agency_id, "SUPPRESSED", detail=reason)


def is_suppressed_email(c: sqlite3.Connection, email: str) -> bool:
    if not email:
        return False
    return c.execute(
        "SELECT 1 FROM suppressions WHERE email = ?", (email.lower().strip(),)
    ).fetchone() is not None


def sends_today(c: sqlite3.Connection, *, include_dry: bool = False) -> int:
    today = datetime.now(timezone.utc).date().isoformat()
    q = "SELECT COUNT(*) AS n FROM sends WHERE substr(sent_at,1,10) = ?"
    if not include_dry:
        q += " AND dry_run = 0"
    return int(c.execute(q, (today,)).fetchone()["n"])


def counts_by_state(c: sqlite3.Connection) -> dict[str, int]:
    rows = c.execute("SELECT state, COUNT(*) AS n FROM agencies GROUP BY state").fetchall()
    return {r["state"]: r["n"] for r in rows}


def get_meta(c: sqlite3.Connection, k: str) -> str | None:
    r = c.execute("SELECT v FROM meta WHERE k = ?", (k,)).fetchone()
    return r["v"] if r else None


def set_meta(c: sqlite3.Connection, k: str, v: str) -> None:
    c.execute("INSERT INTO meta (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v = ?", (k, v, v))


# ── Dashboard: board + reply queue ────────────────────────────────────────
# The board reuses the state machine's own vocabulary rather than inventing a
# parallel one, so what the dashboard shows and what sender.py acts on can never
# disagree. `paused` is the one overlay, because it is a flag, not a state.

BOARD_STATES = [
    "new", "queued", "contacted", "replied", "call-booked",
    "pilot", "nurture", "no-reply", "paused", "suppressed",
]


def board_state(state: str, paused: int) -> str:
    """Display state for one agency. SUPPRESSED outranks a pause: someone who asked
    to be removed is not merely 'on hold'."""
    s = (state or "NEW").upper()
    if s == "SUPPRESSED":
        return "suppressed"
    if paused:
        return "paused"
    return s.lower().replace("_", "-")


def board(c: sqlite3.Connection) -> list[dict]:
    rows = c.execute("""
        SELECT a.*,
               (SELECT COUNT(*) FROM sends s
                  WHERE s.agency_id = a.id AND s.dry_run = 0)            AS real_sends,
               (SELECT MAX(s.sent_at) FROM sends s
                  WHERE s.agency_id = a.id AND s.dry_run = 0)            AS last_send,
               (SELECT MAX(r.created_at) FROM replies r
                  WHERE r.agency_id = a.id)                              AS last_reply,
               (SELECT COUNT(*) FROM replies r
                  WHERE r.agency_id = a.id AND r.handled = 0)            AS open_replies,
               (SELECT MIN(t.due_date) FROM tasks t
                  WHERE t.agency_id = a.id AND t.done = 0)               AS next_due
        FROM agencies a ORDER BY a.tier, a.name
    """).fetchall()

    out = []
    for r in rows:
        last = max([x for x in (r["last_send"], r["last_reply"], r["updated_at"]) if x] or [""])
        out.append({
            "id": r["id"],
            "name": r["name"],
            "domain": r["domain"] or "",
            "email": r["email"] or "",
            "tier": r["tier"],
            "state": board_state(r["state"], r["paused"]),
            "raw_state": r["state"],
            "paused": bool(r["paused"]),
            "sends": r["real_sends"],
            "open_replies": r["open_replies"],
            "next_due": r["next_due"],
            "last_action": (last or None) and last[:10],
            "last_action_ts": last or None,
        })
    return out


def open_replies(c: sqlite3.Connection):
    return c.execute("""
        SELECT r.*, a.name AS agency, a.email AS agency_email, a.state AS agency_state
        FROM replies r JOIN agencies a ON a.id = r.agency_id
        WHERE r.handled = 0 ORDER BY r.created_at
    """).fetchall()


def unread_count(c: sqlite3.Connection) -> int:
    return int(c.execute("SELECT COUNT(*) AS n FROM replies WHERE handled = 0").fetchone()["n"])


def record_reply(c: sqlite3.Connection, agency_id: int, from_addr: str, subject: str,
                 body: str, kind: str, msg_uid: str, draft: str = "",
                 draft_subject: str = "") -> bool:
    """Queue an inbound reply as unhandled. True if it was new.

    The UNIQUE on msg_uid is what makes the watcher idempotent — re-polling the
    same message must not raise the badge or the banner twice.
    """
    cur = c.execute(
        """INSERT OR IGNORE INTO replies
           (agency_id, from_addr, subject, body, kind, draft, draft_subject,
            handled, msg_uid, created_at)
           VALUES (?,?,?,?,?,?,?,0,?,?)""",
        (agency_id, from_addr, subject, body, kind, draft, draft_subject, msg_uid, now_iso()))
    return cur.rowcount > 0


def mark_replies_handled(c: sqlite3.Connection, agency_id: int) -> int:
    """One answer answers everything open for that agency."""
    cur = c.execute(
        "UPDATE replies SET handled = 1, handled_at = ? WHERE agency_id = ? AND handled = 0",
        (now_iso(), agency_id))
    return cur.rowcount


def find_agency_by_name(c: sqlite3.Connection, name: str):
    row = c.execute("SELECT * FROM agencies WHERE name = ?", (name,)).fetchone()
    if row:
        return row
    return c.execute("SELECT * FROM agencies WHERE lower(name) = lower(?)", (name,)).fetchone()


def set_paused(c: sqlite3.Connection, agency_id: int, paused: bool) -> None:
    c.execute("UPDATE agencies SET paused = ?, updated_at = ? WHERE id = ?",
              (1 if paused else 0, now_iso(), agency_id))
    log(c, agency_id, "PAUSE" if paused else "UNPAUSE", detail="dashboard")


def add_task(c: sqlite3.Connection, agency_id: int, kind: str, channel: str,
             due_date: str, payload: str) -> None:
    dup = c.execute(
        "SELECT 1 FROM tasks WHERE agency_id=? AND kind=? AND due_date=? AND done=0",
        (agency_id, kind, due_date),
    ).fetchone()
    if dup:
        return
    c.execute(
        "INSERT INTO tasks (agency_id, kind, channel, due_date, payload, created_at) "
        "VALUES (?,?,?,?,?,?)",
        (agency_id, kind, channel, due_date, payload, now_iso()),
    )
