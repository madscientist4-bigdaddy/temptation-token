// Entry stub (Phase-1 skeleton). Wires the wallet provider + a tab shell; screens
// are stubs to be filled in M1–M2 (see PHASE1_PLAN.md). Not runnable until deps are
// installed via `npx create-expo-app`-style setup + `npx expo install`.
import 'react-native-get-random-values'
import '@walletconnect/react-native-compat'
import React from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig, initWallet } from './src/wallet/appkit'

initWallet()
const queryClient = new QueryClient()

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* TODO M1: <NavigationContainer> with bottom tabs:
            Play · Leaderboard · Submit · Wallet. See src/screens/. */}
        {null}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
