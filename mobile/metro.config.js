// Metro config — keeps the native-only wallet stack out of the Expo Go bundle.
//
// src/wallet/appkit.ts imports @walletconnect/react-native-compat, @reown/appkit-wagmi-
// react-native and wagmi. Those are native modules, are not in the Expo Go dependency
// set, and cannot load in Expo Go at all.
//
// The previous approach hid appkit.ts behind `const s = './appkit'; await import(s)` on
// the theory that Metro could not statically analyse a variable specifier. It can — Metro
// constant-folds it and adds the module to the graph, so `expo export` failed with
// "Unable to resolve module @walletconnect/react-native-compat". A runtime guard cannot
// help, because the failure is at BUNDLE time, before any guard runs.
//
// So the swap happens at resolution time instead: unless EXPO_PUBLIC_WALLET_ENABLED is
// 'true', any request that resolves to wallet/appkit is redirected to wallet/appkit.stub.
// Deterministic, build-time, and immune to bundler analysis.
//
// EAS dev/preview builds set EXPO_PUBLIC_WALLET_ENABLED=true (see eas.json), which turns
// this off and bundles the real thing.

const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

const walletEnabled = process.env.EXPO_PUBLIC_WALLET_ENABLED === 'true'

if (!walletEnabled) {
  const stubPath = path.resolve(__dirname, 'src/wallet/appkit.stub.ts')
  const defaultResolve = config.resolver.resolveRequest

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Match './appkit', '../wallet/appkit', absolute variants — but never the stub itself.
    const isAppkit = /(^|\/)appkit$/.test(moduleName) ||
                     /(^|\/)wallet\/appkit$/.test(moduleName)
    if (isAppkit) {
      return { type: 'sourceFile', filePath: stubPath }
    }
    return (defaultResolve || context.resolveRequest)(context, moduleName, platform)
  }
}

module.exports = config
