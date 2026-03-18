import { createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { QueryClient } from '@tanstack/react-query'

export const projectId = 'fe98d44a78efa54c5bf113f649176020'
export const queryClient = new QueryClient()

const metadata = {
  name: 'Temptation Token',
  description: 'Vote. Win. Earn $TTS on Base.',
  url: 'https://temptationtoken.io',
  icons: ['https://temptationtoken.io/wp-content/uploads/2024/06/Copy-of-Temptation-Token-Coin-1024x1024.webp']
}

const networks = [base]

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false
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
