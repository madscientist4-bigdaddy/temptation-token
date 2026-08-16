// Wallet-less stand-in for src/wallet/appkit.ts.
//
// metro.config.js swaps this in whenever EXPO_PUBLIC_WALLET_ENABLED is not 'true', so the
// real appkit.ts — and the native-only modules it imports — never enter the bundle graph.
// Nothing should import this file directly; import '../wallet/appkit' and let the
// resolver decide.
//
// Why resolver substitution rather than a dynamic import: loader.ts once tried to hide
// appkit.ts behind a variable specifier on the theory Metro could not analyse it. Metro
// constant-folds that and pulls the module in anyway, so `expo export` failed on a missing
// @walletconnect/react-native-compat. The failure is at BUNDLE time, so no runtime guard
// can prevent it.
//
// EVERY EXPORT HERE MUST MIRROR appkit.ts. App.tsx and WalletSheet import these names
// unconditionally; a missing one is a red screen in the very builds this file exists to
// protect.
import React from 'react'

export const projectId = ''
export const wagmiConfig = null
export const PAYMASTER_URL = ''
export const GASLESS_ENABLED = false

/** Pass-through: there is no wallet stack to mount. */
export function WalletStack({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement
}

/** No connector exists, so connecting is a no-op; the UI keeps its address-entry path. */
export function useConnectWallet(): () => void {
  return () => {}
}

export function useConnectedAddress(): { address: string | null; isConnected: boolean } {
  return { address: null, isConnected: false }
}

export function useSponsorshipAvailable(): boolean {
  return false
}

export function isUserRejection(_e: unknown): boolean {
  return false
}

export function useSendMaybeSponsored(): (calls: unknown[]) => Promise<never> {
  return async () => {
    throw new Error('This build cannot sign transactions.')
  }
}

export function initWallet(): void {
  // No-op. See WALLET_ENABLED in src/config/features.
}
