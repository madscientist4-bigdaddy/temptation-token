// Round schedule + live countdown. Rounds are calendar-pinned on-chain: a round ends
// Sunday 11:59 PM ET, whose fixed UTC-5 anchor is Monday 04:59:00 UTC (see CLAUDE.md /
// TTSVotingV3d). We compute the NEXT such boundary dynamically so the countdown never
// goes stale, rather than hardcoding one timestamp.
import { useEffect, useState } from 'react'

// Returns the next round-end instant (ms) at or after `from`.
export function nextRoundEnd(from = Date.now()): number {
  const d = new Date(from)
  // Walk forward to the next Monday 04:59:00 UTC.
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 4, 59, 0, 0))
  // getUTCDay: 0=Sun..1=Mon..6=Sat. Advance to Monday.
  while (t.getUTCDay() !== 1 || t.getTime() <= from) {
    t.setUTCDate(t.getUTCDate() + 1)
    t.setUTCHours(4, 59, 0, 0)
  }
  return t.getTime()
}

function fmt(msLeft: number): string {
  const s = Math.max(0, Math.floor(msLeft / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const p = (n: number) => (n < 10 ? '0' : '') + n
  return `${d}d ${p(h)}:${p(m)}:${p(sec)}`
}

// Ticking countdown string; flips to null when the round is settling.
export function useCountdown(): { label: string; settling: boolean } {
  const [end, setEnd] = useState(() => nextRoundEnd())
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  // Roll to the next boundary once we pass this one.
  useEffect(() => {
    if (now >= end) setEnd(nextRoundEnd(now + 1000))
  }, [now, end])
  const left = end - now
  return { label: fmt(left), settling: left <= 0 }
}
