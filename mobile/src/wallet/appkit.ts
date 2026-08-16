// @ts-nocheck — DEV/PREVIEW-BUILD ONLY. The modules below are native and are not in the
// Expo Go dependency set, so tsc cannot resolve them here. metro.config.js redirects every
// request for this module to appkit.stub.ts unless EXPO_PUBLIC_WALLET_ENABLED=true, so in
// any wallet-less build this file is never bundled and never typechecked against.
//
// WHAT CHANGED (2026-08-16): this module used to only call createAppKit() and stop. The
// AppKit component was never mounted, there was no WagmiProvider, and the "Choose Wallet"
// button in WalletSheet called Linking.openURL(app.temptationtoken.io) — so even in a
// wallet-enabled build, connecting a wallet on mobile did nothing but open the website.
// The whole point of the 100-creator flow is that a phone user never has to leave.
//
// The stack, in the order it must nest:
//   WagmiProvider -> QueryClientProvider -> children + <AppKit />
//
// GASLESS: mirrors src/lib/gasless.js on web. Sponsorship is attempted only when the
// connected wallet advertises EIP-5792 paymasterService on Base (i.e. it is a smart
// account) AND our paymaster proxy grants it. Everything degrades to a normal user-paid
// transaction otherwise — an EOA user, a capped-out user and a downed paymaster must all
// still be able to transact.
import '@walletconnect/react-native-compat'
import 'react-native-get-random-values'
import React, { useCallback } from 'react'
import { createAppKit, defaultWagmiConfig, AppKit, useAppKit } from '@reown/appkit-wagmi-react-native'
import { WagmiProvider, useAccount, useCapabilities, useSendCalls, useWriteContract, usePublicClient } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { base } from 'wagmi/chains'

// Public, client-safe id (same as web VITE_WALLETCONNECT_PROJECT_ID). Not a secret.
export const projectId =
  process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID || 'fe98d44a78efa54c5bf113f649176020'

/** Absolute — a phone has no window.location for a relative path to resolve against. */
export const PAYMASTER_URL =
  process.env.EXPO_PUBLIC_GASLESS_PAYMASTER || 'https://app.temptationtoken.io/api/paymaster'

export const GASLESS_ENABLED = process.env.EXPO_PUBLIC_GASLESS_ENABLED === 'true'

const metadata = {
  name: 'Temptation Token',
  description: 'Vote. Win. Earn $TTS on Base.',
  url: 'https://app.temptationtoken.io',
  icons: ['https://app.temptationtoken.io/tts_logo.webp'],
  // Lets the wallet app deep-link back into us after approval/signing.
  redirect: { native: 'temptationtoken://', universal: 'https://app.temptationtoken.io' },
}

export const wagmiConfig = defaultWagmiConfig({
  chains: [base],
  projectId,
  metadata,
  // Coinbase Smart Wallet is the no-app onboarding path: a passkey (Face ID) creates the
  // account, so a creator with no wallet and no ETH can sign up on the phone. It is also
  // the only connector here that can be gas-sponsored, because sponsorship needs a smart
  // account — an EOA cannot accept a paymaster.
  coinbaseConfig: {
    appName: 'Temptation Token',
    preference: 'smartWalletOnly',
  },
})

const queryClient = new QueryClient()

createAppKit({
  projectId,
  wagmiConfig,
  defaultChain: base,
  enableAnalytics: true,
})

/** Mounts the wallet stack. Rendered by App.tsx above everything that reads an address. */
export function WalletStack({ children }) {
  return React.createElement(
    WagmiProvider,
    { config: wagmiConfig },
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
      React.createElement(AppKit, null)
    )
  )
}

/** Opens the real connect sheet (was: opened the marketing website). */
export function useConnectWallet() {
  const { open } = useAppKit()
  return useCallback(() => open({ view: 'Connect' }), [open])
}

/** The connected account, for bridging into the app's own wallet context. */
export function useConnectedAddress() {
  const { address, isConnected } = useAccount()
  return { address: address ?? null, isConnected }
}

/**
 * True when the connected wallet can accept a paymaster on Base.
 * EIP-5792 capability shape: { [chainId]: { paymasterService: { supported } } }.
 * Keys may be decimal or hex depending on the wallet build, so both are checked.
 */
export function useSponsorshipAvailable() {
  const { address, isConnected } = useAccount()
  const { data: caps } = useCapabilities({
    account: address,
    query: { enabled: Boolean(GASLESS_ENABLED && isConnected && address) },
  })
  if (!GASLESS_ENABLED || !caps) return false
  const entry = caps[base.id] || caps[`0x${base.id.toString(16)}`]
  return Boolean(entry?.paymasterService?.supported)
}

export function isUserRejection(e) {
  const m = `${e?.shortMessage || e?.message || e || ''}`.toLowerCase()
  return e?.code === 4001 || m.includes('user rejected') || m.includes('user denied') ||
         m.includes('rejected the request') || m.includes('cancelled') || m.includes('canceled')
}

/**
 * send(calls) -> { id|hash, sponsored }.
 * Callers do not branch on sponsorship; they just send and await.
 */
export function useSendMaybeSponsored() {
  const sponsorable = useSponsorshipAvailable()
  const { sendCallsAsync } = useSendCalls()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  return useCallback(async (calls) => {
    if (sponsorable) {
      try {
        const result = await sendCallsAsync({
          calls,
          capabilities: { paymasterService: { url: PAYMASTER_URL } },
        })
        return { id: result?.id ?? result, sponsored: true }
      } catch (e) {
        // A user rejection must NOT silently re-prompt as an unsponsored transaction —
        // that would charge gas to someone who explicitly cancelled.
        if (isUserRejection(e)) throw e
        // Paymaster declined (cap hit, not allowlisted, upstream down) → fall through.
      }
    }
    let last
    for (const c of calls) {
      if (!c.abi) throw new Error('raw-data calls require a sponsored batch')
      last = await writeContractAsync({
        address: c.to, abi: c.abi, functionName: c.functionName, args: c.args, value: c.value,
      })
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: last })
    }
    return { hash: last, sponsored: false }
  }, [sponsorable, sendCallsAsync, writeContractAsync, publicClient])
}

/** Kept for the existing loader.ts contract. */
export function initWallet() { /* createAppKit already ran at module scope */ }
