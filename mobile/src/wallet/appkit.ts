// @ts-nocheck — DEV-BUILD ONLY. The modules below (@reown/appkit-wagmi-react-native,
// @walletconnect/react-native-compat, react-native-get-random-values, wagmi) are native
// and are NOT installed for the Expo Go path, so tsc cannot resolve them here. They are
// installed only for an EAS dev/preview/production build (where WALLET_ENABLED=true), at
// which point this file is reached exclusively via the dynamic import in wallet/loader.ts.
// The pragma keeps the Expo Go typecheck green without deleting the wired wallet code.
//
// WalletConnect (Reown AppKit) — React Native init. Mirrors src/config/wallet.js on
// web (same public projectId, Base-only, dark theme), but uses the RN SDK which
// deep-links to installed wallet apps instead of a browser modal.
//
// PREREQUISITES (Phase-1 setup — see PHASE1_PLAN.md §3):
//   • Must run in an Expo Dev Client / prebuilt app — NOT Expo Go (native modules).
//   • Import order matters: '@walletconnect/react-native-compat' FIRST, then wagmi.
//   • Polyfills: react-native-get-random-values, AsyncStorage, react-native-svg.
//   • URL scheme 'temptationtoken://' (app.json) so wallets can return post-signing.
import '@walletconnect/react-native-compat'
import 'react-native-get-random-values'
import { createAppKit, defaultWagmiConfig } from '@reown/appkit-wagmi-react-native'
import { base } from 'wagmi/chains'

// Public, client-safe id (same as web VITE_WALLETCONNECT_PROJECT_ID). Not a secret.
export const projectId = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID || 'fe98d44a78efa54c5bf113f649176020'

const metadata = {
  name: 'Temptation Token',
  description: 'Vote. Win. Earn $TTS on Base.',
  url: 'https://app.temptationtoken.io',
  icons: ['https://app.temptationtoken.io/tts_logo.webp'],
  // redirect enables the wallet app to deep-link back into us after approval/signing.
  redirect: { native: 'temptationtoken://', universal: 'https://app.temptationtoken.io' },
}

export const wagmiConfig = defaultWagmiConfig({ chains: [base], projectId, metadata })

export function initWallet() {
  createAppKit({
    projectId,
    wagmiConfig,
    defaultChain: base,
    enableAnalytics: true,
    // Featured mobile wallets for the connect sheet (deep-linkable on device):
    // MetaMask, Rainbow, Coinbase Wallet, Trust. Coinbase Smart Wallet (passkey) is
    // the recommended no-app onboarding path — see PHASE1_PLAN.md §2 (approval odds).
  })
}
