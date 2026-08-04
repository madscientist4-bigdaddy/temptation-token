# Temptation Token — Compliance Paper Pack (DRAFT FOR LEGAL REVIEW)

> **STATUS: DRAFT. NOT LEGAL ADVICE. DO NOT PUBLISH.**
> Prepared 2026-08-04 as a starting point for qualified counsel. Nothing here has
> been reviewed or approved by a licensed attorney. Every `[BRACKETED]` item must be
> confirmed or supplied. These drafts describe the platform's *actual* mechanics so
> counsel can assess risk and finalize language before anything is shown to users.

## Contents
1. `01_terms_of_service.md`
2. `02_privacy_policy.md` — incl. ID document collection, retention, and ID↔selfie comparison
3. `03_age_and_consent_compliance_statement.md` — 18+
4. `04_community_guidelines.md`
5. `05_dmca_takedown_policy.md`
6. `06_required_consent_checkbox_copy.md`

## What the platform actually does (basis for these drafts)
- **Paid voting game.** Users buy/hold **$TTS** (ERC-20 on **Base** mainnet) and spend it to **vote** on photos of **verified adults**. Each weekly round: the **winning profile's** votes form a pool split **Top Voter 35% / Winning Profile 35% / Polaris Project charity 10% / House (Blockchain Entertainment LLC) 20%** (with a club referral: 35/35/10/10/10). **Votes cast on losing profiles are burned** (sent to a dead address) — i.e., **users can lose the TTS they vote**.
- **Crypto payouts** are on-chain, **irreversible**, to self-custodied wallets.
- **Photo submission** requires a **one-time identity check**: upload of a **government photo ID** + a **dated selfie holding the ID**, stored in a **private bucket**, reviewed by an admin who **visually compares** the selfie to the ID. `RETAIN_IDS` is currently **ON → ID documents and selfies are retained**.
- **NFTs** (`TTSRoundNFT`): up to 3 minted per settlement (winner / top voter / house archive). Likeness use in NFTs is now a **separate explicit opt-in** (`nftConsent`).
- **Staking** (feature staged; publicly "coming soon"): tiered stake of $TTS for **APR rewards** and **vote multipliers**; principal withdrawable anytime, multiplier active after 7 days.
- Token mechanics: **1% transfer tax**, **5 TTS** submission fee, **5 TTS** min vote, per-round vote cap, signup bonus, vote-match, referrals.
- Company: **Blockchain Entertainment LLC** ("Company"); stated governing law to date: **Florida, USA**. Charity: **Polaris Project** (501(c)(3), anti-trafficking).

## 🚩 HIGH-PRIORITY FLAGS FOR COUNSEL (do not gloss over)
1. **Gambling / contest / sweepstakes law.** Paying TTS to vote, where the pool is redistributed and losing votes are *burned*, has **consideration + prize + chance/skill** characteristics. Assess federal + state gambling, lottery, contest, and sweepstakes law, and whether the model must be restructured (e.g., no-purchase entry, skill framing, geofencing) or licensed. **This is the single biggest risk.**
2. **Money transmission / MSB / AML.** Handling user crypto, pooling, and paying out may implicate FinCEN MSB registration, state money-transmitter licensing, and KYC/AML/OFAC screening. Note: an ID check already occurs — decide whether it must become a formal KYC program.
3. **Biometric privacy.** Comparing a selfie to an ID photo may constitute processing of a **biometric identifier** under **BIPA (IL), CUBI (TX), Washington HB 1493**, and others — even if done by a human. If **any automated face-match** (e.g., Persona or similar) is used, BIPA-style **written consent, published retention/destruction schedule, and no-profit** rules very likely apply, with a **private right of action (statutory damages)** in Illinois. Confirm whether comparison is purely human-visual or automated, and whether IDs/selfies of Illinois/Texas/Washington residents are collected. See Privacy Policy §on biometrics.
4. **Securities.** Staking that pays **APR** and the token itself may raise **Howey**/securities questions (SEC, state blue-sky). Review before staking launches.
5. **Adult-content / 2257 / platform rules.** Content is nominally SFW, but "hot or not" voting on adults' photos invites adult-adjacent risk: assess 18 U.S.C. §2257 recordkeeping applicability, state adult-content/age-verification statutes, and app-store/payment-processor content rules.
6. **Global data law.** GDPR/UK-GDPR (if EU/UK users), CCPA/CPRA (California), and other state privacy laws — lawful basis, DPA with Supabase (processor), international transfer mechanism, and data-subject rights.
7. **Tax / 1099 / reporting** for payouts to U.S. persons.
8. **DMCA agent designation.** To claim the safe harbor, the Company must **register a designated agent** with the U.S. Copyright Office (electronic DMCA agent directory) — a real name/address/email, not just an inbox. See DMCA draft.
9. **The existing "IRREVOCABLE RIGHTS GRANT"** shown at submission (perpetual, irrevocable likeness license, moral-rights waiver, governed by Florida "and EU law where required") is aggressive and may be **unenforceable or unfair** in some jurisdictions (esp. EU consumer/GDPR, moral rights). Counsel should reconcile it with these documents and with GDPR withdrawal-of-consent rights.

## Placeholders to resolve
`[Company legal address]`, `[Registered DMCA agent name/address]`, `[legal@ / privacy@ / dmca@ temptationtoken.io — confirm/create]`, `[data retention periods]`, `[governing law + venue — confirm Florida vs. other]`, `[geographies served / excluded]`, `[DPA status with Supabase and any KYC vendor]`, `[effective date]`.
