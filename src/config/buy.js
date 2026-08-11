// ── "Get $TTS": fiat on-ramp (Transak) + in-app swap ─────────────────────────
//
// OFF by default. The render path requires BOTH a flag and a key, so a half-configured
// on-ramp cannot appear — it moves real money from a stranger's card, and a widget that
// renders then fails mid-purchase is worse than no widget.
//
// ARCHITECTURE, and why it is two legs rather than one:
// Transak cannot deliver $TTS — an unlisted token can never be an on-ramp asset. So the
// card leg buys ETH or USDC on Base into the user's own wallet, and the swap leg turns
// that into $TTS on Uniswap. Any copy reading "buy $TTS with a card" would be false.
//
// THE CONSTRAINT THAT SHAPES THE WHOLE FEATURE: the TTS/WETH pool is ~$1.9k, so
// src/lib/swap.js refuses any purchase whose price impact exceeds 5% — about $47 at
// current depth. Transak's own minimum is ~$30. The viable card window is therefore
// roughly $30–$47 and closes entirely if the pool thins further. buyWindowUsd() computes
// it live, and the UI must show the card option ONLY when that window is open. Selling
// someone $100 of USDC they then cannot swap is the specific harm being designed out.
//
// Env (Vercel):
//   VITE_BUY_ENABLED      "true" to show the Get $TTS card path (default: off)
//   VITE_TRANSAK_API_KEY  Transak api key (staging key => staging widget)
//   VITE_TRANSAK_ENV      "STAGING" | "PRODUCTION" (default STAGING — fail safe)

const env = import.meta.env || {}

export const TRANSAK_API_KEY = env.VITE_TRANSAK_API_KEY || ''
export const TRANSAK_ENV = (env.VITE_TRANSAK_ENV || 'STAGING').toUpperCase()

// The gate. Flag AND key — a flag alone renders a broken widget.
export const BUY_ENABLED = env.VITE_BUY_ENABLED === 'true' && !!TRANSAK_API_KEY

// The swap half needs no Transak account and no key, so it can be offered whenever a
// wallet is connected. Only the CARD half is gated.
export const SWAP_ENABLED = env.VITE_SWAP_ENABLED !== 'false'

export const TRANSAK_HOST =
  TRANSAK_ENV === 'PRODUCTION' ? 'https://global.transak.com' : 'https://global-stg.transak.com'

export const BUY_NETWORK = 'base'
export const BUY_ASSETS = ['ETH', 'USDC']
export const TRANSAK_MIN_USD = 30 // Transak's practical floor for card purchases

export const BUY_DISCLOSURE =
  'Card purchases deliver ETH or USDC to your wallet on Base. You then swap to $TTS — ' +
  'no service sells $TTS directly. Rates and fees are set by the payment provider, not by us.'

/**
 * Build the Transak widget URL.
 * `walletAddress` is pinned so funds can only land in the connected wallet, and
 * `disableWalletAddressForm` stops a user retyping it into someone else's address.
 */
export function transakUrl({ walletAddress, fiatAmount, cryptoCurrency = 'USDC', email = '' }) {
  if (!BUY_ENABLED) throw new Error('BUY_ENABLED is false')
  if (!walletAddress) throw new Error('walletAddress required')
  const p = new URLSearchParams({
    apiKey: TRANSAK_API_KEY,
    productsAvailed: 'BUY',
    network: BUY_NETWORK,
    cryptoCurrencyCode: cryptoCurrency,
    walletAddress,
    disableWalletAddressForm: 'true',
    themeColor: 'd4af37',
    hideMenu: 'true',
    redirectURL: `${window.location.origin}/?buy=complete`,
  })
  if (fiatAmount) p.set('fiatAmount', String(fiatAmount))
  if (email) p.set('email', email)
  return `${TRANSAK_HOST}?${p.toString()}`
}

/**
 * The usable card window in USD, given live pool depth.
 * Returns { open, minUsd, maxUsd, reason } — `open:false` means the card path must be
 * hidden, because anything a user could buy would be unswappable.
 */
export function buyWindowUsd({ maxSpendWethUsd }) {
  const maxUsd = Math.floor(maxSpendWethUsd || 0)
  if (maxUsd < TRANSAK_MIN_USD) {
    return {
      open: false, minUsd: TRANSAK_MIN_USD, maxUsd,
      reason:
        `Card purchases are paused. The smallest card payment we can accept is ` +
        `$${TRANSAK_MIN_USD}, but right now only about $${maxUsd} of $TTS can be bought ` +
        `without moving the price more than 5%. Buying more would cost you money we ` +
        `aren't willing to charge you.`,
    }
  }
  return { open: true, minUsd: TRANSAK_MIN_USD, maxUsd, reason: '' }
}

/** Guard for the render path — fails loudly rather than shipping a staging widget. */
export function assertBuyConfigured() {
  if (!BUY_ENABLED) return false
  if (TRANSAK_ENV === 'STAGING' && env.PROD) {
    console.error('[buy] STAGING Transak key in a production build — refusing to render')
    return false
  }
  return true
}
