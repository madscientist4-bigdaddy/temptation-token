// Expo Go stand-in for src/wallet/appkit.ts.
//
// metro.config.js swaps this in whenever EXPO_PUBLIC_WALLET_ENABLED is not 'true', so the
// real appkit.ts — and the native-only modules it imports — never enter the bundle graph.
// Nothing should import this file directly; go through src/wallet/loader.ts.
//
// Why this exists: loader.ts previously tried to hide appkit.ts behind a dynamic import
// with a variable specifier, on the assumption Metro could not analyse it. Metro folds
// that constant and pulls the module in anyway, so `expo export` failed on a missing
// @walletconnect/react-native-compat. Resolver-level substitution is the reliable fix —
// it is decided at build time and cannot be defeated by bundler analysis.

export const projectId = ''
export const wagmiConfig = null

export function initWallet(): void {
  // No-op. The UI keeps its stub wallet path; see WALLET_ENABLED in src/config/features.
}
