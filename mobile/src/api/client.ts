// Thin client for the existing serverless API (app.temptationtoken.io/api/*).
// Mobile reuses the SAME endpoints as web — no new backend for Phase 1. All PII/writes
// stay server-side behind the service key; the app only calls public/safe routes and
// ships no keys of its own.
import { API_BASE } from '../config/contracts'

// ── Types (safe public fields only) ─────────────────────────────────────────
export type Profile = {
  profileId: string
  display_name: string
  image_url: string
  link_title: string
  link_url: string
  round_id?: number
}

export type CommunityStats = {
  ok: boolean
  members: number
  x_followers: number
  x_tweet_count: number
  votes_this_round: number
  unique_voters: number
  round_id: number
  last_x_post?: { content: string; scheduled_at: string; post_type: string }
  fetched_at: string
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      ...init,
    })
    if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`)
    return (await r.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  // Play/Leaderboard — all approved profiles (round-agnostic, safe fields).
  listProfiles: () => j<{ profiles: Profile[] }>('/api/public-profiles'),
  // Community + round stats (members, voters this round, current round id).
  communityStats: () => j<CommunityStats>('/api/community-stats'),
}
