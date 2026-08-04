# Data Retention Policy — DRAFT (for counsel review; do NOT publish)

**Status:** internal draft. Retention periods marked **[COUNSEL TO SET]** must be fixed by
legal counsel against the applicable jurisdictions before this is adopted or published.

## Scope
Covers personal data collected by Temptation Token / Blockchain Entertainment LLC through
the app at app.temptationtoken.io. On-chain data (wallet addresses, votes, transactions) is
public and immutable and cannot be deleted; this policy governs OFF-CHAIN data we control.

## Categories and retention

| Data | Where stored | Retention | Basis |
|---|---|---|---|
| **Government ID image** (submitter verification) | Private, access-logged Supabase bucket (`id-verifications`); service-role only, no public URL | **[COUNSEL TO SET — e.g. N years]** after verification decision, then deleted | Age/identity verification & compliance recordkeeping |
| **Verification selfie** (dated, holding ID) | Same private bucket | **[COUNSEL TO SET]** | Same |
| **NFT-likeness consent record** (`submissions.nft_consent`) | Supabase DB | Retained for the life of the account + **[COUNSEL TO SET]** | Proof of consent |
| **18+ acknowledgment** (`age_acknowledgments`) | Supabase DB | **[COUNSEL TO SET]** | Age-gate compliance |
| **Verification status / decisions** (`verified_submitters`) | Supabase DB | **[COUNSEL TO SET]** | Recordkeeping / audit |
| **ID-view access log** (`admin_audit_log`, `action=id_view`) | Supabase DB | **[COUNSEL TO SET — recommend ≥ the ID retention period]** | Security audit trail |
| Profile photo + submission | Supabase DB / on-chain reference | Retained while profile is live; removable on takedown | Service operation |
| Support correspondence | Email (support@temptationtoken.io) | **[COUNSEL TO SET]** | Support / dispute records |

## Handling rules
- **Minimization:** government IDs are collected only from *submitters* (creators), never
  from all voters; voters provide an 18+ acknowledgment only.
- **Access:** ID/selfie images are viewable only by an authenticated admin, via short-lived
  (≤5 min) signed URLs; **every view is access-logged** (who/what wallet/when).
- **Deletion:** at the end of the retention period, ID + selfie objects are deleted from the
  bucket and the storage-path references nulled. A code flag (`RETAIN_IDS`) currently allows
  delete-on-decision; final retention behavior is **[COUNSEL TO SET]**.
- **Takedown / erasure requests:** routed to support@temptationtoken.io; honored for
  off-chain data to the extent legally required. On-chain data cannot be erased.

## Open items for counsel
1. Set each **[COUNSEL TO SET]** period (jurisdiction-specific — e.g. age-verification
   recordkeeping minimums, biometric-data limits, data-subject erasure rights).
2. Confirm whether the dated selfie is treated as biometric data in any target jurisdiction
   (affects retention + consent).
3. Confirm lawful basis + any DPA/registration obligations.
