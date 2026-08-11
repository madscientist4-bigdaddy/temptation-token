// ── Fiat on-ramp (Transak) feature seam ──────────────────────────────────────
//
// OFF by default and OFF in production until Jim completes Transak's business
// onboarding. Nothing here talks to Transak yet — this is the gate the integration will
// sit behind, added first so the UI can never accidentally ship a half-wired on-ramp.
//
// Why a seam before an integration: an on-ramp moves real money from a stranger's card.
// A partially-configured widget that renders but fails mid-purchase is worse than no
// widget, so the render path is gated on BOTH a flag and a present API key.
//
// Env (Vercel):
//   VITE_BUY_ENABLED     "true" to show the fiat on-ramp (default: off)
//   VITE_TRANSAK_API_KEY Transak PRODUCTION api key (staging key => staging widget)
//   VITE_TRANSAK_ENV     "STAGING" | "PRODUCTION" (default STAGING — fail safe)
//
// IMPORTANT: Transak cannot deliver $TTS directly — TTS is not a listed asset. The only
// honest flow is: user buys ETH/USDC on Base via Transak, then swaps to $TTS on Uniswap.
// Any copy implying "buy $TTS with a card" would be false. See outputs/transak_setup.md.

const env = import.meta.env || {}

export const TRANSAK_API_KEY = env.VITE_TRANSAK_API_KEY || ''
export const TRANSAK_ENV = (env.VITE_TRANSAK_ENV || 'STAGING').toUpperCase()

// The single gate. Requires the flag AND a key — a flag alone renders a broken widget.
export const BUY_ENABLED = env.VITE_BUY_ENABLED === 'true' && !!TRANSAK_API_KEY

// Base mainnet only, matching the rest of the app.
export const BUY_NETWORK = 'base'

// What the on-ramp can actually deliver to the user's wallet.
export const BUY_ASSETS = ['ETH', 'USDC']

// Shown wherever the Buy tab explains itself. Deliberately states the two-step reality.
export const BUY_DISCLOSURE =
  'Card purchases deliver ETH or USDC to your wallet on Base. You then swap to $TTS on ' +
  'Uniswap — no service sells $TTS directly. Rates and fees are set by the payment ' +
  'provider, not by us.'

/** Guard for the render path, so a misconfiguration fails loudly in dev. */
export function assertBuyConfigured() {
  if (!BUY_ENABLED) return false
  if (TRANSAK_ENV === 'STAGING' && import.meta.env?.PROD) {
    console.error('[buy] STAGING Transak key in a production build — refusing to render')
    return false
  }
  return true
}
