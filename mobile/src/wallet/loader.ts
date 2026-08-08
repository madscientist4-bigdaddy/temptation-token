// Wallet isolation boundary. src/wallet/appkit.ts statically imports native-only modules
// (@reown/appkit-wagmi-react-native, @walletconnect/react-native-compat, wagmi) that Expo
// Go cannot load and that are NOT installed in the Expo Go dependency set. To guarantee
// Expo Go's Metro bundler never resolves them, nothing may import appkit.ts with a static
// or template-literal specifier — Metro would then pull it (and its missing native deps)
// into the bundle graph and the build would fail.
//
// This loader is the ONLY entry point.
//
// CORRECTION (2026-08-08): the variable-specifier trick below does NOT hide appkit.ts from
// Metro. Metro constant-folds `const specifier = './appkit'` and pulls the module into the
// graph, so `expo export` failed with "Unable to resolve module
// @walletconnect/react-native-compat". The earlier claim that this "bundles cleanly" was
// wrong — the failure is at BUNDLE time, so no runtime guard can prevent it.
//
// What actually keeps Expo Go working is metro.config.js, which resolves any request for
// wallet/appkit to wallet/appkit.stub.ts unless EXPO_PUBLIC_WALLET_ENABLED=true. The
// dynamic import and the WALLET_ENABLED guard below are still useful (they stop the module
// from executing), but the resolver swap is what makes the bundle succeed.
// Verified 2026-08-08: `expo export` exits 0 for both ios and android with wallet deps absent.
//
// ── Enabling the wallet (EAS dev build) ──────────────────────────────────────
//   1. Install the wallet deps (one command):
//        npx expo install @reown/appkit-wagmi-react-native @walletconnect/react-native-compat \
//          wagmi viem @tanstack/react-query react-native-get-random-values \
//          @react-native-async-storage/async-storage react-native-svg
//   2. Build the dev client (enables WALLET_ENABLED via eas.json env):
//        eas build --profile development
//   The variable-specifier import below resolves at runtime once the deps exist in the
//   dev build; if for any reason it cannot resolve, we fail soft (return null → stub UI).
import { WALLET_ENABLED } from '../config/features'

export async function loadWallet(): Promise<{ initWallet: () => void } | null> {
  if (!WALLET_ENABLED) return null
  try {
    const specifier = './appkit' // plain variable → opaque to Metro's static analysis
    const mod = await import(specifier)
    return mod as { initWallet: () => void }
  } catch (e) {
    console.warn('[wallet] AppKit unavailable in this build — falling back to stub.', e)
    return null
  }
}
