// ── Gasless onboarding config ─────────────────────────────────────────────────
// Embedded smart-wallet login (Coinbase Smart Wallet: passkey / Face ID / email) plus
// ERC-4337 gas sponsorship through a Base paymaster, so a brand-new user can sign up,
// submit and vote holding ZERO ETH.
//
// Production stays OFF until VITE_GASLESS_ENABLED=true. Everything degrades to the
// existing wallet + user-paid-gas path when the flag is off, when the connected wallet
// is a plain EOA, or when the paymaster declines — see src/lib/gasless.js.
//
// Env (Vercel):
//   VITE_GASLESS_ENABLED    "true" to offer the smart-wallet + sponsored path
//   VITE_GASLESS_PAYMASTER  ERC-7677 paymaster proxy URL (default: our /api/paymaster)
//
// The paymaster URL is OUR proxy, never the raw CDP endpoint — the CDP key must not
// reach the browser, and the proxy is where per-wallet/day caps are enforced.

const env = import.meta.env || {}

export const GASLESS_ENABLED = env.VITE_GASLESS_ENABLED === 'true'

// Same-origin by default so the proxy inherits our CORS + rate limits.
export const PAYMASTER_URL = env.VITE_GASLESS_PAYMASTER || '/api/paymaster'

// Absolute URL — the wallet fetches this from its own context, so a relative path
// would resolve against the wallet's origin (popup / iframe), not ours.
export function paymasterUrl() {
  if (/^https?:\/\//i.test(PAYMASTER_URL)) return PAYMASTER_URL
  if (typeof window === 'undefined') return PAYMASTER_URL
  return `${window.location.origin}${PAYMASTER_URL}`
}

// Shown in the UI so the sponsorship promise is never vaguer than the actual cap.
// Mirrors GASLESS_MAX_OPS_PER_WALLET_PER_DAY in api/rpc.js — keep them in sync.
export const SPONSORED_OPS_PER_DAY = Number(env.VITE_GASLESS_OPS_PER_DAY || 10)
