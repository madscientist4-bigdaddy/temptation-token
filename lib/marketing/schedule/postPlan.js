// DST-safe Eastern-Time scheduler (ported from postPlan.ts). A 10-min worker tick
// calls dueEvents(); posted_events (unique event_key) guarantees exactly-once.
export const PLAN = [
  { id: 'round_open',    dow: 1, hour: 9,  minute: 0,  windowMin: 30 }, // Mon 9:00a ET
  { id: 'midpoint',      dow: 3, hour: 20, minute: 0,  windowMin: 30 }, // Wed 8:00p ET
  { id: 'friday_push',   dow: 5, hour: 12, minute: 0,  windowMin: 30 }, // Fri 12:00p ET
  { id: 'final_hours',   dow: 0, hour: 18, minute: 0,  windowMin: 30 }, // Sun 6:00p ET
  { id: 'winner',        dow: 0, hour: 0,  minute: 10, windowMin: 45 }, // Sun 12:10a ET (post-settlement)
  { id: 'weekly_report', dow: 0, hour: 0,  minute: 30, windowMin: 45 }, // Sun 12:30a ET
]

export function etParts(d) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', year: 'numeric',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).reduce((a, x) => ((a[x.type] = x.value), a), {})
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { dow: dowMap[p.weekday], hour: +p.hour % 24, minute: +p.minute, dateKey: `${p.year}-${p.month}-${p.day}` }
}

// Events due at `now`, each with a unique event_key for the dedupe table.
export function dueEvents(now = new Date()) {
  const t = etParts(now)
  const mins = t.hour * 60 + t.minute
  return PLAN
    .filter((e) => e.dow === t.dow && mins >= e.hour * 60 + e.minute && mins < e.hour * 60 + e.minute + e.windowMin)
    .map((event) => ({ event, eventKey: `${event.id}:${t.dateKey}` }))
}
