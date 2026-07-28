// Thin client for the existing serverless API (app.temptationtoken.io/api/*).
// Mobile reuses the SAME endpoints as web — no new backend for Phase 1. All PII/writes
// stay server-side behind the service key; the app only calls public/safe routes.
import { API_BASE } from '../config/contracts'

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`)
  return r.json() as Promise<T>
}

export const api = {
  // Play screen — all approved profiles (round-agnostic, safe fields).
  listProfiles: () => j<{ profiles: any[] }>('/api/public-profiles'),
  // Signup bonus status/claim (surfaces sent / already-credited / why-not).
  signupBonus: (walletAddress: string) =>
    j('/api/signup-bonus', { method: 'POST', body: JSON.stringify({ walletAddress }) }),
  // KYC status for the connected wallet (drives the submit/verify gate).
  kycStatus: (wallet: string) => j<{ status: string }>(`/api/kyc-status?wallet=${wallet}`),
  // 18+ acknowledgment (recorded once per wallet).
  ageAck: (walletAddress: string) =>
    j('/api/age-acknowledge', { method: 'POST', body: JSON.stringify({ walletAddress }) }),
}
