# Mobile status — 2026-08-08

## Headline
The Expo Go build **was broken and is now fixed**. Before today `npx expo export` failed
outright, so the app did not run in Expo Go at all — see the F commit. It now exports
cleanly for **both iOS and Android** (1.5 MB Hermes bundle), `tsc --noEmit` is clean.

## What runs in Expo Go RIGHT NOW
Scan the QR from `npx expo start` and you get:
- **Play screen** — browse all approved profiles, live round countdown, profile detail.
- **Leaderboard screen**.
- **Live data** from production: `/api/public-profiles` and `/api/community-stats`.
- **Wallet sheet** — on-brand, but explains that on-chain actions need the full build and
  offers to open `app.temptationtoken.io`.

## What is stubbed (needs an EAS dev build)
- **Wallet connect** (Reown AppKit / WalletConnect) and therefore **balance reads** and
  **casting votes**. These are native modules Expo Go cannot load — this is a hard Expo Go
  limitation, not an unfinished feature.

To light them up:
```bash
cd mobile
npx expo install @reown/appkit-wagmi-react-native @walletconnect/react-native-compat \
  wagmi viem @tanstack/react-query react-native-get-random-values \
  @react-native-async-storage/async-storage react-native-svg
eas build --profile development     # sets EXPO_PUBLIC_WALLET_ENABLED=true via eas.json
```
`metro.config.js` bundles the real wallet module only when that env var is `true`;
otherwise it resolves to `src/wallet/appkit.stub.ts`. That resolver swap is what keeps the
Expo Go bundle working — a runtime flag alone cannot, because the failure was at bundle time.

## Parity with the web app — honest scorecard

| Web feature | Mobile |
|---|---|
| Browse profiles / Play | ✅ done |
| Round countdown | ✅ done |
| Leaderboard | ✅ done |
| Community stats | ✅ done |
| Wallet connect | 🟡 dev-build only |
| Cast vote on-chain | 🟡 dev-build only |
| **Submit a profile** | ❌ not built |
| **Staking** | ❌ not built |
| **KYC / 18+ verification** | ❌ not built |
| **Buy / transfer TTS** | ❌ not built |
| **Support chatbot** | ❌ not built |
| **Referrals / club codes** | ❌ not built |

So mobile is roughly a **read-only companion** today: about a third of the web surface,
covering browse and discovery. Submit and staking are the two that would make it a real
product, and both need the wallet path working first — i.e. the dev build is the next
gate, not more screens.

## Suggested next step
Do the EAS dev build. Until wallet works on device, every remaining feature is blocked
behind the same dependency, and building more stub screens just grows the gap between what
the app looks like it does and what it does.
