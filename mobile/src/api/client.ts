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

// ── Types for the submit / KYC / referral flows ─────────────────────────────
// Verified against prod 2026-08-09: a wallet with no record returns
// {"status":"not_started"}, which is why that member is in the union — omitting it made
// the type quietly wrong even though the runtime checks (=== 'approved' / 'pending')
// still behaved.
export type KycStatus = {
  verified?: boolean
  status?: 'approved' | 'pending' | 'needs_review' | 'declined' | 'not_started' | null
  ageAcknowledged?: boolean
}

export type UploadInit = {
  alreadyVerified?: boolean
  bucketBase?: string
  id?: { path: string; url: string }
  selfie?: { path: string; url: string }
  error?: string
}

export type SubmitPayload = {
  walletAddress: string
  displayName: string
  linkTitle?: string
  linkUrl?: string
  imageUrl: string // data: URI
  referralCode?: string
  roundId?: number
  nftConsent: boolean
  idDocPath?: string
  selfiePath?: string
}

const post = <T,>(path: string, body: unknown) =>
  j<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  // Play/Leaderboard — all approved profiles (round-agnostic, safe fields).
  listProfiles: () => j<{ profiles: Profile[] }>('/api/public-profiles'),
  // Community + round stats (members, voters this round, current round id).
  communityStats: () => j<CommunityStats>('/api/community-stats'),

  // ── Identity ──────────────────────────────────────────────────────────────
  kycStatus: (wallet: string) => j<KycStatus>(`/api/kyc-status?wallet=${wallet}`),
  /** Ask for MANUAL admin review — the live launch KYC path (Persona stays sandbox). */
  kycRequest: (walletAddress: string) =>
    post<{ ok: boolean; status?: string; alreadyVerified?: boolean }>('/api/kyc?action=request', { walletAddress }),
  /** Mint short-lived signed PUT urls for the government ID + selfie. */
  idUploadInit: (walletAddress: string) =>
    post<UploadInit>('/api/kyc?action=id-upload-init', { walletAddress }),

  // ── Submit ────────────────────────────────────────────────────────────────
  submitQuota: (wallet: string) => j<{ usedThisWeek: number; remaining: number }>(`/api/profiles?action=submit&wallet=${wallet}`),
  submitProfile: (payload: SubmitPayload) => post<{ ok: boolean }>('/api/submit-profile', payload),

  // ── Referral ──────────────────────────────────────────────────────────────
  referCapture: (referrerWallet: string, refereeWallet: string) =>
    post<{ ok: boolean }>('/api/bonus?action=refer-capture', { referrerWallet, refereeWallet, source: 'mobile' }),
  signupBonus: (walletAddress: string) =>
    post<{ success: boolean; amount?: number; txHash?: string; alreadyClaimed?: boolean; reason?: string }>(
      '/api/signup-bonus',
      { walletAddress }
    ),
}
