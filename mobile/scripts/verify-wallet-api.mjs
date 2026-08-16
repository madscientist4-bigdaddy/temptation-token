#!/usr/bin/env node
// Guard: does the installed Reown AppKit actually export the names src/wallet/appkit.ts
// imports?
//
// WHY THIS EXISTS. On 2026-08-16 the wallet-enabled Android APK crashed at launch:
//
//   ReactNativeJS: [runtime not ready]: TypeError: undefined is not a function
//   A module failed to load and `AppRegistry.registerComponent` wasn't called
//
// The cause was that appkit.ts was written against the AppKit **v1** API
// (`createAppKit`/`defaultWagmiConfig`/`AppKit` from @reown/appkit-wagmi-react-native)
// while v2.0.6 was installed, where that package exports only `WagmiAdapter`. Importing a
// name a module does not export is not a bundle error and not a type error — it is
// `undefined` at runtime, which only bites when the app actually starts. tsc could not
// catch it either, because appkit.ts is @ts-nocheck by necessity (native-only modules).
//
// So the check is a static scan of the installed packages' entry points. It is crude, but
// it is the layer that was missing: it fails in CI in a second instead of on a device
// after a 9-minute EAS build.
//
// Run: node scripts/verify-wallet-api.mjs   (from mobile/)
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** What appkit.ts imports, by package. Keep in step with that file's import block. */
const REQUIRED = {
  '@reown/appkit-react-native': ['createAppKit', 'AppKit', 'AppKitProvider', 'useAppKit'],
  '@reown/appkit-wagmi-react-native': ['WagmiAdapter'],
  '@wagmi/connectors': ['coinbaseWallet'],
  wagmi: ['WagmiProvider', 'useAccount', 'useCapabilities', 'useSendCalls', 'useWriteContract', 'usePublicClient'],
  '@tanstack/react-query': ['QueryClient', 'QueryClientProvider'],
}

function entrySource(pkg) {
  for (const rel of [
    'lib/module/index.js',
    'lib/commonjs/index.js',
    'dist/esm/index.js',
    'dist/esm/exports/index.js',
    'dist/index.js',
    'build/modern/index.js',
  ]) {
    const p = resolve(ROOT, 'node_modules', pkg, rel)
    if (existsSync(p)) return { path: p, src: readFileSync(p, 'utf8') }
  }
  return null
}

/**
 * Static scan, used only when node cannot import the package (the React-Native-only ones).
 * Newlines are collapsed first because real entry points wrap long `export { … }` lists,
 * and `export * from "x"` is followed one level — that is how @tanstack/react-query
 * re-exports QueryClient, and a scan that ignored it produced a false failure.
 */
function staticHas(pkg, name, seen = new Set()) {
  if (seen.has(pkg)) return false
  seen.add(pkg)
  const entry = entrySource(pkg)
  if (!entry) return false
  const flat = entry.src.replace(/\s+/g, ' ')
  const re = new RegExp(`export (\\{[^}]*\\b${name}\\b[^}]*\\}|(const|function|class) ${name}\\b)`)
  if (re.test(flat)) return true
  for (const m of flat.matchAll(/export \* from ["']([^"']+)["']/g)) {
    if (!m[1].startsWith('.') && staticHas(m[1], name, seen)) return true
  }
  return false
}

let failed = 0
for (const [pkg, names] of Object.entries(REQUIRED)) {
  // Runtime import is authoritative — it is exactly what the app does. Many of these are
  // React-Native-only and will throw here, hence the static fallback.
  let runtime = null
  try {
    runtime = await import(pkg)
  } catch { /* fall back to the scan */ }

  const missing = names.filter((n) =>
    runtime ? typeof runtime[n] === 'undefined' : !staticHas(pkg, n)
  )
  const how = runtime ? 'imported' : 'scanned'
  if (missing.length) {
    console.error(`FAIL  ${pkg} does not export: ${missing.join(', ')}   (${how})`)
    failed++
  } else {
    console.log(`ok    ${pkg} — ${names.length} name(s) (${how})`)
  }
}

if (failed) {
  console.error(
    `\n${failed} package(s) do not export what src/wallet/appkit.ts imports.\n` +
    `That is a CRASH AT LAUNCH in any wallet-enabled build, not a warning.`
  )
  process.exit(1)
}
console.log('\nPASS  every name src/wallet/appkit.ts imports exists in the installed packages.')
