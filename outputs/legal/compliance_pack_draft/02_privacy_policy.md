# Privacy Policy — DRAFT (FOR LEGAL REVIEW; NOT LEGAL ADVICE; DO NOT PUBLISH)

**Effective date:** `[EFFECTIVE DATE]` · **Controller:** Blockchain Entertainment LLC, `[address]` · **Contact:** `[privacy@temptationtoken.io]`

> Counsel: this policy discloses **government-ID and selfie collection, retention, and ID↔selfie comparison** — the highest-sensitivity processing on the platform. Confirm lawful basis, retention periods, the biometric analysis (§4), international transfers, and vendor DPAs (Supabase; any KYC vendor). See cover flags #3, #6.

## 1. Scope
This Policy explains how we collect, use, retain, and share personal data when you use the Service. On-chain data is public and permanent by design (see §7).

## 2. Data we collect
**a. Wallet & on-chain data.** Public wallet address; votes, submissions, payouts, mints, staking, and referrals — these are recorded **on a public blockchain** and are permanent and pseudonymous.
**b. Profile submissions.** Photo(s) you submit, display name, optional link, payout wallet.
**c. Identity-verification data (sensitive).** A **government-issued photo ID** and a **dated selfie holding the ID**, plus verification status, timestamps, and admin review notes. Used to confirm you are an **adult (18+)** and the person depicted, and that you consent.
**d. Age acknowledgment.** A record that you attested to being 18+.
**e. Support & communications.** Messages you send us (e.g., email, Telegram, in-app chatbot inputs).
**f. Technical/usage data.** IP address, device/browser data, and logs, collected via our hosting and standard web mechanisms. `[Confirm cookie/analytics use → separate cookie notice if needed.]`

We do **not** intentionally collect payment-card data; purchases occur via third-party wallets/exchanges.

## 3. How identity documents are handled (storage & security)
- ID and selfie images are uploaded **directly** from your browser to a **private storage bucket** using short-lived signed upload links; the images are **not public** and are **not** exposed in any public API response or the client app.
- They are accessible **only** to authorized administrators, and only via **short-lived signed links** generated server-side for review.
- **Retention.** ID and selfie documents are **currently retained** after a verification decision (a "legal-hold" configuration is enabled). `[Counsel: set and disclose a concrete retention period and destruction schedule — this is required under biometric statutes (see §4) and expected under GDPR/CCPA. Options to decide: delete on approval/denial vs. retain N years for compliance. State the chosen rule here.]`
- **Path/reference data** for these files is stored in access-controlled columns, never in public tables.

## 4. Identity/biometric comparison — SPECIAL DISCLOSURE
During review, an administrator **compares your selfie to the photo on your ID** to confirm they are the same adult. `[Counsel — CONFIRM which is true and finalize this section accordingly:]`
- **If comparison is purely human/visual** (no automated faceprint): we do not generate or store a mathematical faceprint; the "comparison" is a manual visual check. State this plainly.
- **If any automated face-matching is used** (e.g., a KYC vendor such as Persona, or any face-match algorithm): this may involve a **biometric identifier**. In that case, and for residents of jurisdictions with biometric laws (**Illinois BIPA, Texas CUBI, Washington HB 1493**, and similar), we will: obtain **separate written consent** before collection; **not sell or profit from** biometric identifiers; and **retain and then permanently destroy** them per a published schedule (e.g., when the purpose is satisfied or within `[X]`). BIPA provides a **private right of action** — this section and the consent checkbox must be watertight before any face-match tech is enabled.

> Recommendation: obtain the biometric-style consent (see Consent Checkbox doc) **regardless**, as a conservative posture, and disclose the exact method.

## 5. Why we use your data (purposes & lawful bases)
| Purpose | Data | Lawful basis (GDPR, if applicable) |
|---|---|---|
| Operate the game, record votes/payouts | wallet, on-chain, submission | Contract / legitimate interests |
| Age & identity verification (18+, likeness consent) | ID, selfie, age ack | Legal obligation / consent (and explicit consent for sensitive/biometric data) |
| Fraud, abuse, sanctions, AML screening | wallet, IP, verification | Legal obligation / legitimate interests |
| Charity, tax, and regulatory reporting | payout, identity | Legal obligation |
| Support & security | communications, logs | Legitimate interests |
| Marketing (optional) | contact | Consent |

`[Counsel: confirm bases; explicit consent is generally required for sensitive/biometric data.]`

## 6. Sharing
We share data with: **service providers** (hosting/database — Supabase; any KYC vendor; infrastructure) under contract; the **blockchain** (public, by design); **the Polaris Project** only aggregate/charity amounts (no personal data); and **authorities** where legally required (subpoena, sanctions, fraud). We do **not sell** personal data. `[Confirm "sale/share" position under CCPA/CPRA; confirm DPAs exist.]`

## 7. Blockchain data is permanent
Transactions and NFT metadata are recorded on public blockchains and **cannot be edited or deleted by us or anyone**. Do not submit anything on-chain you need to keep private. Your erasure rights (§9) **cannot** extend to immutable on-chain records.

## 8. Retention
We retain personal data as long as needed for the purposes above and legal requirements. ID/selfie retention is per §3–4. Off-chain profile and account data are retained while active and for `[period]` after. `[Set concrete periods.]`

## 9. Your rights
Depending on where you live (EU/UK GDPR; California CPRA; others): access, correction, deletion, portability, restriction/objection, withdraw consent, and non-discrimination for exercising rights. To exercise, contact `[privacy@temptationtoken.io]`. Note the on-chain limitation (§7). We will verify requests. `[Add EU representative / UK rep and supervisory-authority complaint rights if serving those users.]`

## 10. International transfers
Data may be processed in the `[United States]` and other countries. Where required, we use `[SCCs / appropriate safeguards]`. `[Confirm transfer mechanism for EU/UK users.]`

## 11. Children
The Service is strictly **18+**. We do not knowingly collect data from anyone under 18; if discovered, we delete it and terminate access.

## 12. Security
Private buckets, signed-URL-only access to IDs, service-key-gated server access, RLS on sensitive tables, and admin authentication. No system is perfectly secure; you use the Service at your own risk. We will notify affected users/regulators of breaches as required by law.

## 13. Changes & contact
We may update this Policy; material changes will be notified in-app or by a new effective date. Questions: `[privacy@temptationtoken.io]`.
