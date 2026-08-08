// Feature flags — the single switch between the Expo-Go-safe stub path and the full
// dev-build wallet path.
//
// WALLET_ENABLED gates every real on-chain capability (WalletConnect / Reown AppKit,
// balance reads, casting votes). It is FALSE in Expo Go because the wallet SDK pulls in
// native modules Expo Go cannot load. When true (only in an EAS dev/preview build), the
// app may import src/wallet/appkit.ts and enable live voting.
//
// It resolves from the public env var EXPO_PUBLIC_WALLET_ENABLED so an EAS build profile
// can flip it without a code change (see eas.json → build.*.env). Defaults to false.
//
// CRITICAL: never statically `import` src/wallet/* from an Expo-Go code path. Wallet code
// must be reached only behind `if (WALLET_ENABLED)` + a dynamic import, so Expo Go's
// bundler never resolves the native modules. See src/wallet/loader.ts.
export const WALLET_ENABLED = process.env.EXPO_PUBLIC_WALLET_ENABLED === 'true'

// Convenience label for the stub UI so copy stays consistent.
export const FULL_APP_URL = 'https://app.temptationtoken.io'
