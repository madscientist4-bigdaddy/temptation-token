// @ts-nocheck — DEV/PREVIEW-BUILD ONLY. The modules below are native and are not in the
// wallet-less dependency set, so tsc cannot resolve them here. metro.config.js redirects
// every request for this module to appkit.stub.ts unless EXPO_PUBLIC_WALLET_ENABLED=true,
// so in any wallet-less build this file is never bundled and never typechecked against.
//
// ── WHY THIS FILE WAS REWRITTEN TWICE (2026-08-16) ───────────────────────────
//
// 1. It only ever called createAppKit() and stopped. The modal component was never
//    mounted, there was no WagmiProvider, and WalletSheet's "Choose Wallet" button called
//    Linking.openURL(the website) — so on mobile, "connect wallet" opened a web page.
//
// 2. The bigger problem, found by actually running the wallet APK on an emulator: it was
//    written against the AppKit **v1** API while v2.0.6 is installed. v1's
//    `createAppKit` / `defaultWagmiConfig` / `AppKit` / `useAppKit` do not exist in
//    @reown/appkit-wagmi-react-native v2 — that package now exports ONLY `WagmiAdapter`.
//    Importing the missing names crashed the app at module load:
//      ReactNativeJS: [runtime not ready]: TypeError: undefined is not a function
//      A module failed to load and AppRegistry.registerComponent wasn't called
//    i.e. the wallet build did not merely fail to connect, it did not start. That never
//    surfaced because this path had never been run on a device.
//
// The v2 shape, verified against the installed package source:
//   @reown/appkit-react-native        → createAppKit, AppKit, AppKitProvider, useAppKit
//   @reown/appkit-wagmi-react-native  → WagmiAdapter (exposes .wagmiConfig for wagmi)
//
// Nesting is load-bearing: useAppKit() throws outside AppKitProvider, and every wagmi
// hook throws outside WagmiProvider.
import '@walletconnect/react-native-compat'
import 'react-native-get-random-values'
import React, { useCallback } from 'react'
import { createAppKit, AppKit, AppKitProvider, useAppKit } from '@reown/appkit-react-native'
import { WagmiAdapter } from '@reown/appkit-wagmi-react-native'
import { WagmiProvider, useAccount, useCapabilities, useSendCalls, useWriteContract, usePublicClient, useSignMessage } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// AppKit's modal measures insets and throws 'No safe area value available' without
// this above it — the third launch crash this stack produced on a real emulator.
import { SafeAreaProvider } from 'react-native-safe-area-context'
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

// NO explicit wagmi connector is passed. Two dead ends got us here, both found by
// bundling rather than by reading docs:
//   • `@wagmi/connectors` as a direct dependency resolved AHEAD of the tree's
//     @wagmi/core and the bundle died on a missing '@wagmi/core/tempo';
//   • `wagmi/connectors` is a barrel that drags in @metamask/sdk, which imports
//     `node:crypto` — absent in React Native, so the bundle died again.
// AppKit v2 ships its own connector set (WalletConnect + the wallet list, Coinbase
// Smart Wallet among them), so the adapter needs none from us. Sponsorship still keys
// off the wallet advertising EIP-5792 paymasterService, which is a property of the
// connected account being a smart account — not of which connector object created it.
const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [base],
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

const appKit = createAppKit({
  projectId,
  metadata,
  networks: [base],
  defaultNetwork: base,
  adapters: [wagmiAdapter],
})

const queryClient = new QueryClient()

/** Mounts the wallet stack. Rendered by App.tsx above everything that reads an address. */
export function WalletStack({ children }) {
  return React.createElement(
    SafeAreaProvider,
    null,
    React.createElement(
      WagmiProvider,
      { config: wagmiConfig },
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(
          AppKitProvider,
          { instance: appKit },
          children,
          React.createElement(AppKit, null)
        )
      )
    )
  )
}

/** Opens the real connect sheet (was: opened the marketing website). */
export function useConnectWallet() {
  const { open } = useAppKit()
  return useCallback(() => open(), [open])
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

/**
 * Sign a plain message. Used by account deletion, which must prove wallet ownership —
 * a wallet address is public, so it authenticates nothing on its own.
 */
export function useSignPlainMessage() {
  const { signMessageAsync } = useSignMessage()
  return useCallback((message) => signMessageAsync({ message }), [signMessageAsync])
}

/** Kept for the existing loader.ts contract. */
export function initWallet() { /* createAppKit already ran at module scope */ }
