# Mobile build runbook — Temptation Token (Expo / React Native)

App lives in `mobile/`. Bundle id / package: `io.temptationtoken.app`. Chain is Base
mainnet (8453) only. Everything here was verified on 2026-08-09 unless noted.

---

## What runs where

| Capability | Expo Go | Dev/preview build | Notes |
|---|---|---|---|
| Browse profiles, leaderboard, round countdown | ✅ | ✅ | public API |
| TTS balance, staking pool/tiers, your stake position | ✅ | ✅ | plain `eth_call`, no wallet SDK |
| KYC: ID + selfie upload, manual review request | ✅ | ✅ | signed-URL upload; needs an address, not a signature |
| Submit: photo, name, link, club code, consent gates | ✅ | ✅ | everything up to the fee |
| Referral link, share, record-your-referrer | ✅ | ✅ | |
| **Pay the 5 TTS entry fee** | ❌ | ✅ | wallet signature |
| **Vote / stake / unstake / claim** | ❌ | ✅ | wallet signature |

The seam is `WALLET_ENABLED` (`src/config/features.ts`), flipped by
`EXPO_PUBLIC_WALLET_ENABLED` per EAS profile. `metro.config.js` swaps
`src/wallet/appkit` for `appkit.stub` whenever it is false, which is what keeps the Expo
Go bundle resolvable without the native wallet deps.

`STAKING_LIVE` (`EXPO_PUBLIC_STAKING_LIVE`) is a **separate** gate and defaults to false.
The staking contracts are live and funded, but the public announcement is held, and the
web app still shows "Coming Soon" — mobile must not launch it first. Flip both in the
same change.

### Address-as-identity
Expo Go has no wallet connector, so the user enters the address they play with. That is
identity, not a credential: it is public, authorises nothing, unlocks only public reads
and endpoints already scoped server-side to that wallet, and cannot sign. See the header
of `src/lib/wallet.tsx`.

---

## EAS build profiles (`mobile/eas.json`)

All six validate against the eas-cli 21 schema (`eas config --profile <p>`).
Note: eas-cli 21 **rejects `"//"` comment keys** in eas.json — that is why the profile
documentation lives in this file instead. Don't add them back.

| Profile | Platform | Output | Wallet | Account needed |
|---|---|---|---|---|
| `apk` | Android | side-loadable **.apk** | off | Expo only |
| `apk-wallet` | Android | side-loadable **.apk** | on | Expo only |
| `ios-simulator` | iOS | simulator **.app** | off | Expo only |
| `development` | both | dev client | on | Expo (+ Apple for iOS device) |
| `preview` | both | TestFlight / Play internal | on | Apple $99 / Play $25 |
| `production` | both | store build (.aab) | on | Apple $99 / Play $25 |

`apk` matters because EAS defaults Android to `.aab`, which a phone cannot install
directly. `buildType: "apk"` gives a file you can download and side-load.

---

## Android APK — ONE COMMAND AWAY

Blocked only on an Expo login. `npx expo whoami` → "Not logged in" as of 2026-08-09.

```bash
cd mobile
npx expo login            # or: export EXPO_TOKEN=<token from expo.dev/settings/access-tokens>
npx eas-cli build --platform android --profile apk
```

The build runs on Expo's servers (free tier queues). When it finishes the CLI prints an
artifact URL like `https://expo.dev/artifacts/eas/<id>.apk`.

**Install on a phone:**
1. Open that URL in Chrome on the Android device (or `adb install <file>.apk`).
2. Android will warn about installing from an unknown source — allow it for Chrome.
3. Open "Temptation Token" from the app drawer.

No Play Console is required for side-loading. The $25 Play Console is only needed for the
`preview`/`production` profiles that publish to the Play tracks.

---

## iOS simulator — BUILT ✅ (no Apple account required)

Artifact produced 2026-08-09, installed and launched on an iPhone 16e simulator:

```
outputs/TemptationToken-sim.app.tar.gz      14 MB (52 MB unpacked)
bundle id io.temptationtoken.app · version 0.1.0 · Release · iphonesimulator
```

Gitignored (`outputs/*.app.tar.gz`) — a 14 MB binary does not belong in git history.
Rebuild with the commands below.

```bash
tar -xzf outputs/TemptationToken-sim.app.tar.gz
xcrun simctl boot "iPhone 16e"          # any booted simulator works
xcrun simctl install booted TemptationToken.app
xcrun simctl launch booted io.temptationtoken.app
```

Verified running: all five tabs, live Round 6 countdown, 18 live profiles in the
carousel, and the Staking tab reading the 10,000,000,000 $TTS reward pool straight off
`0x7848cc…` through the hand-rolled decoder — with the Coming Soon gate correctly held
shut (`STAKING_LIVE` false).

## Building it yourself

A simulator build is never code-signed, so it needs no Apple Developer account. Two routes:

**Local (used to produce the artifact in this repo's build log):**
```bash
cd mobile
npx expo prebuild --platform ios --clean     # generates mobile/ios/ (gitignored)
xcodebuild -workspace ios/TemptationToken.xcworkspace \
           -scheme TemptationToken \
           -configuration Release \
           -sdk iphonesimulator \
           -derivedDataPath ios/build \
           -destination 'generic/platform=iOS Simulator' build
# artifact: ios/build/Build/Products/Release-iphonesimulator/Temptation Token.app
xcrun simctl install booted "<path to .app>"
xcrun simctl launch booted io.temptationtoken.app
```

**Via EAS (needs the Expo login, produces a downloadable tar.gz):**
```bash
npx eas-cli build --platform ios --profile ios-simulator
```
EAS runs on Expo's macOS images with a pinned, known-good Xcode, so it sidesteps both
local hazards below.

### Three local-toolchain hazards, all hit on this machine (2026-08-09)

**1. Xcode has no simulator destinations → `iOS 26.2 is not installed`.**
Xcode 26.3 shipped with the iOS 26.2 SDK but only the iOS 26.0.1 *runtime* was
installed, so `xcodebuild -showdestinations` listed **zero** simulators — even though
`xcrun simctl list` showed plenty. `-sdk iphonesimulator` does not help; the platform
itself is what's missing.
```bash
xcodebuild -downloadPlatform iOS      # ~8.4 GB, installs the matching simulator runtime
```

**2. `expo-modules-jsi` does not compile under Swift 6 / Xcode 26.3.**
`JavaScriptCodable+Date.swift` calls `abs(milliseconds)`. That target imports the `jsi`
C module, which drags Darwin's C `abs` overloads into scope beside Swift's generic one →
`ambiguous use of 'abs'` (surfaced first as *"type of expression is ambiguous without a
type annotation"*), failing the whole build. Patched to `milliseconds.magnitude` —
identical semantics, no overload resolution — via **patch-package**
(`mobile/patches/expo-modules-jsi+57.0.4.patch`, applied by the `postinstall` script).
Delete the patch once Expo fixes it upstream.

**3. iCloud Desktop sync breaks codesign.**
The repo lives under `~/Desktop`, which iCloud Drive syncs. The file provider stamps
`com.apple.FinderInfo` / `com.apple.fileprovider.fpfs#P` on build products, and codesign
refuses:
> `ExpoModulesJSI.framework: resource fork, Finder information, or similar detritus not allowed`

`xattr -cr` clears them but iCloud re-stamps within seconds, and the failure happens
inside Expo's **nested** xcframework build (`node_modules/expo-modules-jsi/apple/
.DerivedData`), so `CODE_SIGNING_ALLOWED=NO` on the outer `xcodebuild` never reaches it.
The reliable fix is to build from a path iCloud does not sync:
```bash
rsync -a --exclude 'ios/build' --exclude '.expo' --exclude 'dist' mobile/ /tmp/ttsbuild/
cd /tmp/ttsbuild/ios && pod install && cd ..
xattr -cr .
xcodebuild -workspace ios/TemptationToken.xcworkspace -scheme TemptationToken \
  -configuration Release -sdk iphonesimulator -derivedDataPath ios/build \
  -destination 'generic/platform=iOS Simulator' build
```
Moving the repo off `~/Desktop` (or excluding it from iCloud Drive) fixes this
permanently and is worth doing.

**Do not `rm -rf ios/build` between builds.** React Native's codegen output lives at
`ios/build/generated/ios/ReactCodegen/`, so deleting it produces
`error: Build input file cannot be found: …rnasyncstorage-generated.mm`. Re-run
`pod install` to regenerate, or delete only `ios/build/Build`.

`mobile/ios/` and `mobile/android/` are gitignored — they are regenerated by prebuild and
must never be committed (the app is managed-workflow; committing them would strip
`app.json` of its authority over native config).

---

## iOS on a real device / TestFlight — needs Apple

Requires the **Apple Developer Program, $99/year**. See "Jim's steps" in the session
report. Once enrolled:
```bash
npx eas-cli build --platform ios --profile preview     # TestFlight
npx eas-cli submit --platform ios --latest
```

---

## Guardrails

- `node scripts/verify-mobile-selectors.mjs` (from the repo root) re-derives every
  hard-coded function selector in `mobile/src/lib/chain.ts` and live-calls it on Base
  mainnet. Run it after touching that table — a wrong hard-coded selector has silently
  broken reads in this repo before.
- `cd mobile && npx tsc --noEmit` — typecheck.
- `cd mobile && npx expo export --platform ios --platform android` — proves the Expo Go
  bundle still resolves with the wallet deps absent. This is the check that catches a
  static import of `src/wallet/appkit` sneaking in.
