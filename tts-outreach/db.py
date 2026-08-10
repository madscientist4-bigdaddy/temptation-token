"""SQLite state. All modules go through here; nothing else touches the file."""
from __future__ import annotations

import csv
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS agencies (
    id          INTEGER PRIMARY KEY,
    name        TEXT UNIQUE NOT NULL,
    domain      TEXT,
    email       TEXT,
    phone       TEXT,
    telegram    TEXT,
    instagram   TEXT,
    x_handle    TEXT,
    form_url    TEXT,
    tier        INTEGER,
    status      TEXT,
    angle_line  TEXT,
    enrolled_on TEXT,
    notes       TEXT,
    updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY,
    agency_id  INTEGER NOT NULL REFERENCES agencies(id),
    kind       TEXT NOT NULL,
    due_date   TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'PENDING',
    completed_at TEXT,
    UNIQUE(agency_id, kind)
);

CREATE TABLE IF NOT EXISTS sends (
    id         INTEGER PRIMARY KEY,
    agency_id  INTEGER REFERENCES agencies(id),
    to_email   TEXT,
    subject    TEXT,
    step       TEXT,
    dry_run    INTEGER,
    ts         TEXT,
    message_id TEXT,
    error      TEXT
);

CREATE TABLE IF NOT EXISTS contacts_found (
    id         INTEGER PRIMARY KEY,
    agency_id  INTEGER REFERENCES agencies(id),
    kind       TEXT,
    value      TEXT,
    source_url TEXT,
    score      REAL,
    mx_ok      INTEGER,
    ts         TEXT,
    UNIQUE(agency_id, kind, value)
);

CREATE TABLE IF NOT EXISTS replies (
    id         INTEGER PRIMARY KEY,
    agency_id  INTEGER REFERENCES agencies(id),
    from_addr  TEXT,
    subject    TEXT,
    snippet    TEXT,
    intent     TEXT,
    ts         TEXT,
    uid        TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS events (
    id        INTEGER PRIMARY KEY,
    agency_id INTEGER,
    kind      TEXT,
    detail    TEXT,
    ts        TEXT
);
"""

# Columns added after the first release. SQLite has no "ADD COLUMN IF NOT EXISTS",
# so each is applied through _add_column() which checks PRAGMA table_info first.
MIGRATIONS = [
    # The dashboard's reply queue. `handled` is the single source of truth for the
    # unread badge — the count is always derived from it rather than kept in a
    # separate counter, because a counter and a row set drift the first time
    # anything crashes between the two writes.
    ("replies", "handled", "INTEGER NOT NULL DEFAULT 0"),
    ("replies", "handled_at", "TEXT"),
    # The suggested reply, stored alongside the message so the dashboard does not
    # have to parse drafts/*.txt back out of the filesystem.
    ("replies", "draft", "TEXT"),
    ("replies", "draft_subject", "TEXT"),
    # `snippet` is truncated to 20 lines for the terminal digest. The dashboard
    # shows the whole message, so the untruncated body is kept separately.
    ("replies", "body", "TEXT"),
    # Pipeline stages nothing can infer from mail traffic: a booked call and a
    # running pilot are facts only Jim has. NULL means "derive from mail state".
    ("agencies", "stage", "TEXT"),
]


@contextmanager
def conn():
    c = sqlite3.connect(config.DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    try:
        yield c
        c.commit()
    finally:
        c.close()


def _add_column(c, table: str, column: str, decl: str) -> None:
    cols = {r["name"] for r in c.execute(f"PRAGMA table_info({table})")}
    if column not in cols:
        c.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def init() -> None:
    with conn() as c:
        c.executescript(SCHEMA)
        for table, column, decl in MIGRATIONS:
            _add_column(c, table, column, decl)


def log_event(agency_id, kind: str, detail: str = "") -> None:
    with conn() as c:
        c.execute(
            "INSERT INTO events(agency_id,kind,detail,ts) VALUES(?,?,?,?)",
            (agency_id, kind, detail, datetime.now().isoformat(timespec="seconds")),
        )


CSV_FIELDS = ["name", "domain", "email", "phone", "telegram", "instagram",
              "x_handle", "form_url", "tier", "status", "angle_line"]


def import_csv(path=None) -> int:
    """Load agencies.csv into SQLite. Idempotent: re-running updates in place
    and never clobbers a harvested email with a blank from the CSV."""
    path = path or config.AGENCIES_CSV
    n = 0
    with open(path, newline="", encoding="utf-8") as fh, conn() as c:
        for row in csv.DictReader(fh):
            name = (row.get("name") or "").strip()
            if not name:
                continue
            existing = c.execute("SELECT * FROM agencies WHERE name=?", (name,)).fetchone()
            vals = {k: (row.get(k) or "").strip() for k in CSV_FIELDS}
            vals["tier"] = int(vals["tier"] or 3)
            if existing:
                # Never let a blank CSV cell erase harvested data.
                for k in ("domain", "email", "phone", "telegram", "instagram", "x_handle", "form_url"):
                    if not vals[k] and existing[k]:
                        vals[k] = existing[k]
                # Preserve terminal states set by the reply watcher.
                if existing["status"] in ("REPLIED", "SUPPRESSED", "BLOCKED"):
                    vals["status"] = existing["status"]
                c.execute(
                    """UPDATE agencies SET domain=?,email=?,phone=?,telegram=?,instagram=?,
                       x_handle=?,form_url=?,tier=?,status=?,angle_line=?,updated_at=? WHERE name=?""",
                    (vals["domain"], vals["email"], vals["phone"], vals["telegram"],
                     vals["instagram"], vals["x_handle"], vals["form_url"], vals["tier"],
                     vals["status"], vals["angle_line"], datetime.now().isoformat(timespec="seconds"), name),
                )
            else:
                c.execute(
                    """INSERT INTO agencies(name,domain,email,phone,telegram,instagram,x_handle,
                       form_url,tier,status,angle_line,updated_at)
                       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (name, vals["domain"], vals["email"], vals["phone"], vals["telegram"],
                     vals["instagram"], vals["x_handle"], vals["form_url"], vals["tier"],
                     vals["status"], vals["angle_line"], datetime.now().isoformat(timespec="seconds")),
                )
            n += 1
    return n


def export_csv(path=None) -> None:
    """Write SQLite back out to agencies.csv so the file stays the source of truth."""
    path = path or config.AGENCIES_CSV
    with conn() as c:
        rows = c.execute("SELECT * FROM agencies ORDER BY tier, name").fetchall()
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: (r[k] if r[k] is not None else "") for k in CSV_FIELDS})


def all_agencies():
    with conn() as c:
        return c.execute("SELECT * FROM agencies ORDER BY tier, name").fetchall()


def get_agency(agency_id):
    with conn() as c:
        return c.execute("SELECT * FROM agencies WHERE id=?", (agency_id,)).fetchone()


def set_status(agency_id, status: str) -> None:
    with conn() as c:
        c.execute("UPDATE agencies SET status=?, updated_at=? WHERE id=?",
                  (status, datetime.now().isoformat(timespec="seconds"), agency_id))


def halt_sequence(agency_id, reason: str) -> None:
    """Cancel every pending step for a target (reply / opt-out / blocklist)."""
    with conn() as c:
        c.execute("UPDATE tasks SET status='SKIPPED' WHERE agency_id=? AND status='PENDING'",
                  (agency_id,))
    log_event(agency_id, "HALT", reason)


def enroll(agency_id, start: date | None = None) -> int:
    """Create the full task ladder for one agency. Idempotent."""
    start = start or date.today()
    created = 0
    with conn() as c:
        c.execute("UPDATE agencies SET enrolled_on=? WHERE id=? AND (enrolled_on IS NULL OR enrolled_on='')",
                  (start.isoformat(), agency_id))
        for kind, offset in config.CADENCE.items():
            due = start + timedelta(days=offset)
            try:
                c.execute("INSERT INTO tasks(agency_id,kind,due_date) VALUES(?,?,?)",
                          (agency_id, kind, due.isoformat()))
                created += 1
            except sqlite3.IntegrityError:
                pass  # already enrolled
    return created


def due_tasks(kind_filter=None, on: date | None = None):
    """Pending tasks due on or before `on`, excluding halted targets."""
    on = on or date.today()
    q = """SELECT t.*, a.name, a.email, a.domain, a.phone, a.telegram, a.instagram,
                  a.x_handle, a.form_url, a.tier, a.status, a.angle_line
           FROM tasks t JOIN agencies a ON a.id=t.agency_id
           WHERE t.status='PENDING' AND t.due_date<=?
             AND a.status NOT IN ('REPLIED','SUPPRESSED','HOLD','BLOCKED','NEEDS_REVIEW')"""
    args = [on.isoformat()]
    if kind_filter:
        q += " AND t.kind IN (%s)" % ",".join("?" * len(kind_filter))
        args += list(kind_filter)
    q += " ORDER BY a.tier, t.due_date, a.name"
    with conn() as c:
        return c.execute(q, args).fetchall()


EMAIL_ORDER = ["EMAIL_1", "EMAIL_2", "EMAIL_3"]


def due_email_steps(on: date | None = None, include_dry: bool = False):
    """One email step per agency, in order, never two in a day.

    Without this, a slipped D0 and an on-time D1 both come due together and the
    same agency gets two emails hours apart — which reads as broken automation
    and is the fastest way to get marked as spam. Guards:
      * only the lowest-order pending step per agency
      * a step is ineligible until the previous step is DONE
      * nothing if that agency already received mail today
    """
    on = on or date.today()
    out = []
    for t in due_tasks(kind_filter=tuple(EMAIL_ORDER), on=on):
        idx = EMAIL_ORDER.index(t["kind"])
        with conn() as c:
            if idx > 0:
                prev = c.execute(
                    "SELECT status FROM tasks WHERE agency_id=? AND kind=?",
                    (t["agency_id"], EMAIL_ORDER[idx - 1])).fetchone()
                if prev and prev["status"] == "PENDING":
                    continue  # earlier step hasn't gone yet
            q = ("SELECT COUNT(*) FROM sends WHERE agency_id=? AND substr(ts,1,10)=? "
                 "AND error IS NULL")
            if not include_dry:
                q += " AND dry_run=0"
            if c.execute(q, (t["agency_id"], on.isoformat())).fetchone()[0]:
                continue  # already mailed today
        out.append(t)

    seen, deduped = set(), []
    for t in sorted(out, key=lambda r: (r["tier"], EMAIL_ORDER.index(r["kind"]), r["name"])):
        if t["agency_id"] in seen:
            continue
        seen.add(t["agency_id"])
        deduped.append(t)
    return deduped


def complete_task(task_id, status="DONE") -> None:
    with conn() as c:
        c.execute("UPDATE tasks SET status=?, completed_at=? WHERE id=?",
                  (status, datetime.now().isoformat(timespec="seconds"), task_id))


def sends_today(include_dry=False) -> int:
    today = date.today().isoformat()
    q = "SELECT COUNT(*) FROM sends WHERE substr(ts,1,10)=? AND error IS NULL"
    if not include_dry:
        q += " AND dry_run=0"
    with conn() as c:
        return c.execute(q, (today,)).fetchone()[0]


def first_send_date():
    with conn() as c:
        r = c.execute("SELECT MIN(substr(ts,1,10)) FROM sends WHERE dry_run=0 AND error IS NULL").fetchone()
    return date.fromisoformat(r[0]) if r and r[0] else None


def record_send(agency_id, to_email, subject, step, dry_run, message_id=None, error=None) -> None:
    with conn() as c:
        c.execute(
            """INSERT INTO sends(agency_id,to_email,subject,step,dry_run,ts,message_id,error)
               VALUES(?,?,?,?,?,?,?,?)""",
            (agency_id, to_email, subject, step, 1 if dry_run else 0,
             datetime.now().isoformat(timespec="seconds"), message_id, error),
        )


def add_contact(agency_id, kind, value, source_url, score, mx_ok) -> None:
    with conn() as c:
        c.execute(
            """INSERT OR IGNORE INTO contacts_found(agency_id,kind,value,source_url,score,mx_ok,ts)
               VALUES(?,?,?,?,?,?,?)""",
            (agency_id, kind, value, source_url, score, 1 if mx_ok else 0,
             datetime.now().isoformat(timespec="seconds")),
        )


def export_contacts(path=None) -> None:
    path = path or config.CONTACTS_CSV
    with conn() as c:
        rows = c.execute(
            """SELECT a.name AS agency, cf.kind, cf.value, cf.score, cf.mx_ok, cf.source_url, cf.ts
               FROM contacts_found cf JOIN agencies a ON a.id=cf.agency_id
               ORDER BY a.name, cf.kind, cf.score DESC"""
        ).fetchall()
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["agency", "kind", "value", "score", "mx_ok", "source_url", "found_at"])
        for r in rows:
            w.writerow([r["agency"], r["kind"], r["value"], f'{r["score"]:.2f}',
                        r["mx_ok"], r["source_url"], r["ts"]])


# ── Dashboard board / reply queue ─────────────────────────────────────────
# The board vocabulary is deliberately NOT the raw `status` column. `status`
# mixes two unrelated things — how contactable a target is (VERIFIED,
# FORM_ONLY, HARVEST, NEEDS_DOMAIN) and where it sits in the pipeline
# (REPLIED, SUPPRESSED). The board only cares about the second, so it is
# derived here rather than shown raw.

BOARD_STATES = ["queued", "contacted", "replied", "call-booked", "pilot", "paused", "suppressed"]


def board_state(status: str, stage: str, real_sends: int) -> str:
    """Pipeline state for one agency, most-advanced-wins with two exceptions.

    Suppression outranks everything: someone who opted out is not a 'pilot' just
    because they once were. Pause outranks the mail-derived states for the same
    reason — it is an explicit instruction to stop, and it must be visible as
    such rather than silently reading as 'contacted'.
    """
    status = (status or "").upper()
    stage = (stage or "").upper()
    if status in ("SUPPRESSED", "BLOCKED"):
        return "suppressed"
    if status == "HOLD":
        return "paused"
    if stage == "PILOT":
        return "pilot"
    if stage == "CALL_BOOKED":
        return "call-booked"
    if status == "REPLIED":
        return "replied"
    if real_sends > 0:
        return "contacted"
    return "queued"


def board():
    """Every agency with its pipeline state and the date of its last real action.

    'Real' excludes dry-run sends on purpose. While DRY_RUN is on, nothing has
    actually reached a recipient, so the board must not claim anyone was
    contacted — it reports `queued` and the API reports the dry-run mode
    alongside, rather than showing activity that never left the machine.
    """
    with conn() as c:
        rows = c.execute("""
            SELECT a.*,
                   (SELECT COUNT(*) FROM sends s
                      WHERE s.agency_id=a.id AND s.dry_run=0 AND s.error IS NULL) AS real_sends,
                   (SELECT MAX(s.ts) FROM sends s
                      WHERE s.agency_id=a.id AND s.dry_run=0 AND s.error IS NULL) AS last_send,
                   (SELECT MAX(r.ts) FROM replies r WHERE r.agency_id=a.id)       AS last_reply,
                   (SELECT COUNT(*) FROM replies r
                      WHERE r.agency_id=a.id AND r.handled=0)                     AS open_replies,
                   (SELECT MIN(t.due_date) FROM tasks t
                      WHERE t.agency_id=a.id AND t.status='PENDING')              AS next_due
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
            "state": board_state(r["status"], r["stage"], r["real_sends"]),
            "raw_status": r["status"],
            "sends": r["real_sends"],
            "open_replies": r["open_replies"],
            "next_due": r["next_due"],
            "last_action": (last or None) and last[:10],
            "last_action_ts": last or None,
        })
    return out


def open_replies():
    """Inbound replies still waiting on a human, oldest first."""
    with conn() as c:
        return c.execute("""
            SELECT r.*, a.name AS agency, a.email AS agency_email, a.status AS agency_status
            FROM replies r JOIN agencies a ON a.id=r.agency_id
            WHERE r.handled=0 ORDER BY r.ts
        """).fetchall()


def unread_count() -> int:
    with conn() as c:
        return c.execute("SELECT COUNT(*) FROM replies WHERE handled=0").fetchone()[0]


def record_reply(agency_id, from_addr, subject, snippet, intent, uid, body: str = "",
                 draft: str = "", draft_subject: str = "") -> bool:
    """Store an inbound reply as unhandled. Returns True if it was new.

    The UNIQUE constraint on uid is what makes the watcher idempotent: polling
    the same message twice must not raise the badge twice.
    """
    with conn() as c:
        cur = c.execute(
            """INSERT OR IGNORE INTO replies
               (agency_id,from_addr,subject,snippet,body,intent,ts,uid,handled,draft,draft_subject)
               VALUES(?,?,?,?,?,?,?,?,0,?,?)""",
            (agency_id, from_addr, subject, snippet, body, intent,
             datetime.now().isoformat(timespec="seconds"), uid, draft, draft_subject))
        return cur.rowcount > 0


def mark_replies_handled(agency_id) -> int:
    """Clear every open reply for one agency — sending one answer answers them all."""
    with conn() as c:
        cur = c.execute(
            "UPDATE replies SET handled=1, handled_at=? WHERE agency_id=? AND handled=0",
            (datetime.now().isoformat(timespec="seconds"), agency_id))
        return cur.rowcount


def find_agency_by_name(name: str):
    """Exact match first, then case-insensitive — the dashboard sends display names."""
    with conn() as c:
        row = c.execute("SELECT * FROM agencies WHERE name=?", (name,)).fetchone()
        if row:
            return row
        return c.execute("SELECT * FROM agencies WHERE lower(name)=lower(?)", (name,)).fetchone()


def set_stage(agency_id, stage: str | None) -> None:
    with conn() as c:
        c.execute("UPDATE agencies SET stage=?, updated_at=? WHERE id=?",
                  (stage, datetime.now().isoformat(timespec="seconds"), agency_id))


if __name__ == "__main__":
    init()
    print(f"schema ready at {config.DB_PATH}")
    print(f"imported {import_csv()} agencies")
