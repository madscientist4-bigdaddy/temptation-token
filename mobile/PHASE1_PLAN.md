# Temptation Token — Mobile App, Phase 1 Plan

**Track:** background-priority (web launch + Round 4 recovery come first).
**Scope:** approach recommendation · store-review risk · skeleton + WalletConnect plan · timeline to internal testing.
**Status:** skeleton scaffolded under `mobile/` (not installed/built); this doc is the deliverable.

---

## 1. Approach — **Expo (React Native) with a shared TS core.** Not fully native, not bare RN.

**Recommendation:** Expo + React Native, with the web app's chain/business logic extracted into a
shared TypeScript package consumed by both apps.

**Why, specifically for a crypto + age-gated app:**
- **The whole web stack ports.** The web app is React 19 + **wagmi/viem + Reown AppKit** (Base-only).
  viem is platform-agnostic; wagmi and **Reown AppKit ship a first-class React Native SDK**; the
  same public WalletConnect `projectId` works on mobile. So contract reads/writes, ABIs, addresses,
  the `/api/*` client, and validation are reused almost verbatim — one language, one team.
- **Native (Swift + Kotlin) would ~2× the work** with zero logic reuse and no wallet-SDK advantage —
  unjustified for a small team shipping fast.
- **Expo over bare RN:** EAS Build handles the native modules WalletConnect needs (via a Dev Client /
  prebuild), and **EAS Update (OTA)** lets us hotfix content/compliance copy without a full review
  cycle. *Caveat:* OTA must never change the app's core purpose or bypass review (Apple 3.1/2.5.2,
  Google) — use it for copy/config, not to sneak in gated features.
- **Coinbase Smart Wallet (passkey)** via AppKit gives no-download onboarding — important because
  requiring users to install a wallet app is the biggest mobile crypto funnel-killer.

**Architecture (incremental, non-disruptive to the shipping web app):**
```
(now)     mobile/ imports its own copy of addresses/ABIs (config/contracts.ts)
(soon)    extract packages/@tts-core  ← ABIs, addresses, viem clients, API SDK, types
          apps/web (existing Vite) and mobile/ both import @tts-core  (one source of truth)
```
Do **not** big-bang a monorepo migration mid-launch. Phase 1 mobile talks to the **same backend**
and mirrors constants; promote to a shared package once web launch is stable.

---

## 2. Store-review risk — honest assessment

Three compounding red flags: **crypto payouts, a paid-entry random-winner mechanic, and
adult-adjacent content.** Ranked by how likely each is to cause rejection:

### 🔴 #1 risk — gambling/lottery classification (most likely rejection)
The core loop — *spend TTS to vote → Chainlink VRF picks a winner (weighted-random) → winner takes
the pool* — reads to reviewers as a **paid raffle/lottery**, regardless of the "voting/skill" framing.
- **Apple 5.3** (gambling/lotteries): needs licensing, geo-restriction, often can't use IAP.
- **Google Play Real-Money Gambling**: allowed only in specific countries via a separate approval
  program; otherwise prohibited.
- **Design to survive it:**
  - **No in-app wagering on iOS at launch.** Ship iOS as a **companion**: browse profiles, live
    standings, winners, wallet connect, balance, KYC status, push alerts — but route the actual
    *pay-to-vote* and *buy-TTS* to mobile Safari / an external on-chain action (WalletConnect to an
    external wallet), **never Apple IAP**. Many crypto apps ship exactly this way.
  - **Never sell TTS or entries through IAP** (Apple would both demand IAP *and* reject the mechanic —
    an unwinnable conflict). Keep buy/sell as external DEX links opened in the browser.
  - **Geo-gate** jurisdictions where paid-random-prize contests are illegal.
  - Emphasize the **skill/voting + charity (10% anti-trafficking)** framing in metadata.

### 🟠 #2 risk — adult-adjacent content + UGC moderation
"Temptation," adult creators, "Hot or Not" → **17+** and UGC scrutiny.
- **Apple 1.1.4 / 1.2** and **Google Sexual-Content / UGC** policies reject nudity and under-moderated
  UGC. We already require SFW + admin pre-approval — good, but the app must *also* ship, visibly:
  content **reporting**, **block user**, a published **contact**, and an EULA with a zero-tolerance
  clause for objectionable content (Apple 1.2 checklist). Rating: **17+**; soften listing copy
  (position as a "social voting game," not adult).

### 🟡 #3 risk — crypto capability + ID/privacy
- **Apple 3.1.5(b) / Google crypto**: crypto features generally require a **company** developer
  account (not individual); no on-device mining. Wallet-connect + on-chain actions are permitted.
- **Age/ID**: our gov-ID + selfie flow is for **creators/submitters only** (creator KYC — defensible,
  OnlyFans-style), not all voters; general voters get an **18+ acknowledgment**. Privacy labels must be
  accurate and ID handling minimized/disclosed (the private-bucket + delete-on-decision design already
  supports this — Apple 5.1.1 data-minimization).
- **Apple 4.3 ("spam"/thin app)**: a bare wallet-viewer can be rejected for insufficient functionality —
  ensure the companion has real content (browse/standings/notifications), not just a connect button.

### Net stance (honest)
- **Android internal testing first** — faster iteration, and Play's internal track needs no public
  review. Full experience (incl. voting via external wallet) is more feasible on Android, but still
  design around the RMG policy (no in-app real-money wagering UI).
- **iOS: companion app to TestFlight** (internal testing needs no App Review). A **public** iOS launch
  with in-app voting may never pass 5.3 — plan for the companion design, and treat full-featured iOS as
  a later, uncertain phase. Being upfront: **do not assume iOS public approval on the first try.**

---

## 3. Skeleton + WalletConnect integration plan

**Skeleton (scaffolded now under `mobile/`):**
```
mobile/
  app.json            Expo config: scheme "temptationtoken://", 17+ perms, wallet query schemes
  eas.json            build profiles: development · preview(internal TestFlight/Play) · production
  package.json        Expo + RN + Reown AppKit + wagmi/viem (target versions; pin at install)
  App.tsx             WagmiProvider + QueryClient + initWallet() shell
  src/config/contracts.ts   Base(8453) + canonical addresses + read/vote ABIs + API_BASE
  src/wallet/appkit.ts      Reown AppKit RN init (deep-link redirect, same projectId as web)
  src/api/client.ts         calls the EXISTING /api/* endpoints (no new backend)
  src/screens/ src/lib/ assets/   (filled M1–M2)
```

**WalletConnect / Reown AppKit (React Native) plan:**
1. **SDK:** `@reown/appkit-wagmi-react-native` (successor to Web3Modal) — same public `projectId` as
   web (`EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID`, client-safe, not a secret).
2. **Native modules → Expo Dev Client / prebuild** (NOT Expo Go). Polyfills required:
   `@walletconnect/react-native-compat` (imported first), `react-native-get-random-values`,
   `@react-native-async-storage/async-storage`, `react-native-svg`.
3. **Deep-linking:** register `temptationtoken://` (done in `app.json`) so wallet apps return to us
   after session-approval/signing; set `metadata.redirect`. Optionally add Universal Links /
   Associated Domains for `app.temptationtoken.io` to enable web→app handoff later.
4. **Chain:** Base mainnet (8453) only. RPC via public Base RPC or the existing `/api/rpc` proxy.
5. **Flow:** Connect → AppKit sheet → pick wallet (MetaMask/Rainbow/Coinbase/Trust) → deep-link to
   wallet → approve session → return → `useAccount()` ready. Votes use
   `walletClient.writeContract(...)` (identical to web) → wallet signs → deep-link back.
6. **Onboarding fallback:** if no wallet app installed, offer **Coinbase Smart Wallet (passkey)** and
   a QR fallback. This materially improves conversion and store-approval "real functionality."
7. **Secrets:** only the *public* projectId ships in the app. Service keys, private keys, admin
   secrets **never** enter the mobile bundle (they stay in the serverless backend).

---

## 4. Timeline to TestFlight / Play internal testing (realistic, background-priority)

Assumes ~1 competent RN dev working behind web launch (part-time). Calendar weeks, not full-time weeks.

| Milestone | Weeks | Deliverable |
|---|---|---|
| **M0 — Setup** | 0–1 | `create-expo-app` over this skeleton, Dev Client building on a device, **WalletConnect connect + read Base balance working** |
| **M1 — Read-only core** | 2–3 | Play (browse profiles) + Leaderboard against live `/api/*`; wallet connect + balance; nav + dark theme |
| **M2 — Actions** | 4–5 | Voting via WalletConnect `writeContract` (Android) / companion-safe on iOS; Submit + KYC-status view; **push notifications** (Expo) for outbid alerts (ties into the marketing engine) |
| **M3 — Compliance hardening** | 6 | UGC report/block, 18+ gate, EULA, privacy labels, listing metadata, geo-gating, EAS profiles |
| **M4 — Internal builds** | 7 | **Android Play internal track + iOS TestFlight (internal)** — the Phase-1 finish line |

**≈ 6–7 calendar weeks to internal-testing builds.** Honest caveats:
- **TestFlight/Play internal need no public review** — reachable on this timeline regardless of the
  gambling-classification risk.
- **Public** App Store review is a *separate, later* phase with real rejection risk on 5.3; budget for
  1–3 resubmission cycles and the iOS companion redesign if needed.
- A **company** Apple/Google developer account (crypto requirement) should be set up during M0 — it
  can take days for verification and is a common blocker.

## Immediate next actions (when this track moves to foreground)
1. Create Apple Developer **(company)** + Google Play developer accounts.
2. `npx create-expo-app` over this skeleton; `npx expo install` to pin versions; add the Dev Client.
3. Stand up `packages/@tts-core` and move ABIs/addresses/API SDK into it; point web + mobile at it.
4. Wire AppKit connect on a real device; verify a Base read + a testnet-style dry vote path.
