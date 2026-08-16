# iOS TestFlight — everything done, and the exact point Apple credentials are required

Prepared 2026-08-16. The app is code-complete for TestFlight. Work stops at the first
step that cannot be done without an Apple Developer account.

---

## Done in the repo (no Apple account needed)

| Item | State |
|---|---|
| Bundle identifier | `io.temptationtoken.app` (`app.json` → `ios.bundleIdentifier`) |
| Marketing version | `0.1.0` (`expo.version`) |
| Build number | `1` (`ios.buildNumber`); `testflight` profile has `autoIncrement: true` so EAS bumps it per upload |
| Android versionCode | `1` (kept in step so the two stores do not drift) |
| App icon | `mobile/assets/icon.png`, 1024×1024, generated from the brand TT mark (`public/pwa/icon-512.png`) |
| Adaptive icon (Android) | `mobile/assets/adaptive-icon.png`, 1024×1024 from the maskable source |
| Splash | `mobile/assets/splash-icon.png` on `#0B0B0F`, `resizeMode: contain` |
| Camera permission string | `NSCameraUsageDescription` — states the 18+ ID/selfie purpose |
| Photo library permission string | `NSPhotoLibraryUsageDescription` — same, plus choosing the contest photo |
| expo-image-picker plugin | Declared in `app.json` `plugins` with matching `photosPermission` / `cameraPermission` |
| Privacy manifest | `ios.privacyManifests` → generated to `ios/TemptationToken/PrivacyInfo.xcprivacy`; declares UserDefaults (CA92.1), FileTimestamp (C617.1), DiskSpace (E174.1), SystemBootTime (35F9.1) |
| Encryption declaration | `ITSAppUsesNonExemptEncryption: false` — avoids the export-compliance prompt on every upload |
| EAS `testflight` profile | `distribution: store`, Release, wallet + gasless on, staking gate off |
| EAS `submit.testflight` | Present, with three placeholder values (below) |

All seven EAS profiles validate against eas-cli 22 (`eas config --profile <p> --platform <p>`).

**Why the permission strings matter more than usual here:** the app asks for a government
ID and a selfie. Apple rejects generic strings ("Allow app to access your photos" — which
is what Expo's default produced, verified on device) for anything collecting identity
documents. The strings now say what is collected and why.

---

## What I need from Jim — the exact blocking list

Everything above is done. **The next command cannot run without an Apple Developer
Program membership ($99/year).** Specifically:

1. **Apple Developer Program enrolment** for Blockchain Entertainment LLC (or Jim
   personally). Organisation enrolment needs a D-U-N-S number and takes longer — if
   TestFlight is wanted this week, individual enrolment is faster.

2. Once enrolled, three values to paste into `mobile/eas.json` → `submit.testflight.ios`:
   - `appleId` — the Apple ID email on the developer account
   - `appleTeamId` — 10 characters, from developer.apple.com → Membership
   - `ascAppId` — the App Store Connect app's numeric Apple ID, which only exists after
     the app record is created (step 3)

3. **Create the App Store Connect app record**: name, primary language, bundle ID
   `io.temptationtoken.app`, SKU. I can do this via API if given an App Store Connect
   API key (Issuer ID + Key ID + `.p8`), or Jim can do it in the web UI in ~2 minutes.

4. **Sign-in credentials for EAS to manage certificates**, either:
   - an App Store Connect **API key** (preferred — no 2FA prompts, revocable), or
   - Apple ID + app-specific password, with 2FA available at build time.

Then the whole remaining flow is two commands:

```bash
cd mobile
npx eas-cli build   --platform ios --profile testflight
npx eas-cli submit  --platform ios --latest --profile testflight
```

---

## Also required by Apple before the build can be *reviewed* (not before it can be built)

These do not block the upload, but TestFlight external testing and App Store review will
ask for them. Flagging now so they are not a surprise:

- **Age rating**: the app is 18+ and shows user-submitted photos of people. Expect to
  declare mature/suggestive themes. Getting this wrong is a common rejection.
- **User-generated content requirements** (Guideline 1.2): Apple requires a content
  filter, a way to report offensive content, a way to block abusive users, and a
  published contact. The app has admin pre-approval of every entry, which is stronger
  than a filter — but there is **no in-app report button**, and that is usually asked for.
- **Crypto/wallet** (Guideline 3.1.5): apps that facilitate token transactions must be
  offered by the organisation doing so, not an individual — an argument for enrolling as
  Blockchain Entertainment LLC rather than personally.
- **Privacy policy URL** and **support URL** — both exist (temptationtoken.io), just need
  entering in App Store Connect.
- **Account deletion** (Guideline 5.1.1(v)): required for any app with accounts. Wallet
  address is the identity here; there is currently no in-app deletion path.

The last two bullets are the likeliest review blockers, and both are product decisions
rather than build steps.
