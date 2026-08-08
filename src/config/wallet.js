import { createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { QueryClient } from '@tanstack/react-query'
import { coinbaseWallet } from 'wagmi/connectors'

// Public WalletConnect/Reown client id — env-driven (rotatable without a code change).
// Falls back to the known public id so a missing env var never breaks the build.
export const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'fe98d44a78efa54c5bf113f649176020'
export const queryClient = new QueryClient()

const metadata = {
  name: 'Temptation Token',
  description: 'Vote. Win. Earn $TTS on Base.',
  url: 'https://temptationtoken.io',
  icons: ['https://temptationtoken.io/wp-content/uploads/2024/06/Copy-of-Temptation-Token-Coin-1024x1024.webp']
}

const networks = [base]

// Coinbase Smart Wallet — passkey (Face ID / Touch ID) or email onboarding that creates
// an ERC-4337 smart account. Paired with the paymaster this is what lets a brand-new user
// sign up, submit and vote holding ZERO ETH.
//
// Always present, not gated on GASLESS_ENABLED. Two independent reasons:
//   1. Gasless voting needs a smart account to sponsor (that part IS flag-gated, in
//      src/lib/gasless.js — the connector alone sponsors nothing).
//   2. Self-serve club onboarding (/clubs) needs inline wallet creation so a club owner
//      can get a payout address from a barstool with a passkey. Club owners never
//      transact, so that path needs no paymaster and no flag.
// `smartWalletOnly` keeps us off the legacy CBW extension path, which is an EOA.
const gaslessConnectors = [
  coinbaseWallet({
    appName: 'Temptation Token',
    appLogoUrl: metadata.icons[0],
    preference: 'smartWalletOnly',
  }),
]

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  connectors: gaslessConnectors,
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: { analytics: true, email: false, socials: false },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#d4af37',
    '--w3m-background-color': '#0c0c14',
    '--w3m-border-radius-master': '8px'
  }
})
