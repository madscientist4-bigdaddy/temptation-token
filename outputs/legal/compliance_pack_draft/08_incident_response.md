# Incident Response Plan — DRAFT (one page; for counsel review, do NOT publish)

**Scope:** any suspected or confirmed breach of personal data we control (esp. the private
`id-verifications` bucket holding government IDs + selfies), unauthorized access to admin
systems, or exposure of the Supabase service key / admin credentials.

**Owner:** [NAME — incident lead]. **Backup:** [NAME]. **Counsel:** [FIRM/CONTACT].

## The 6 steps

1. **CONTAIN (immediately).**
   - Rotate the exposed secret(s): `SUPABASE_SERVICE_KEY`, `ADMIN_PASSWORD`,
     `ADMIN_SESSION_SECRET`, any leaked wallet key. Revoke admin sessions.
   - If the ID bucket is implicated: confirm it is still `public=false` with no anon policy;
     invalidate outstanding signed URLs by rotating keys; consider temporarily disabling the
     `storage-url` admin endpoint.
   - Preserve evidence — do not wipe logs.

2. **ASSESS.**
   - What data, whose, how many records? Pull the **`admin_audit_log` where
     `config_key='id_view'`** access log to see exactly which IDs were viewed and by which
     admin session (session fingerprint in `changed_by`; wallet/kind/path in `new_value`).
   - Determine cause (leaked key, RLS gap, phishing, etc.) and whether it is ongoing.
   - Classify severity + whether personal/biometric data was actually exposed.

3. **NOTIFY COUNSEL.** Brief legal counsel with the assessment; counsel determines statutory
   notification duties + deadlines (breach-notification laws are jurisdiction- and
   timeline-specific — do not self-determine).

4. **NOTIFY AFFECTED (as counsel directs).** Notify affected individuals and any required
   regulators within the legally required window, with: what happened, what data, what we've
   done, what they should do, and the contact **support@temptationtoken.io**.

5. **REMEDIATE.** Close the root cause (patch RLS, tighten access, enforce key rotation,
   re-verify no public bucket URL, add monitoring). Verify the fix. Re-enable any disabled
   endpoints only after confirmation.

6. **LOG / POST-MORTEM.** Record the full timeline, decisions, and evidence. Write a
   post-mortem with concrete preventive actions and owners. Retain the incident record per
   the retention policy.

## Quick reference
- Private ID bucket: `id-verifications` (Supabase `gmlikdxykgviyprqtqwz`), service-role only.
- Access log: `admin_audit_log` where `config_key='id_view'`.
- Takedown / data contact: **support@temptationtoken.io**.
- On-chain data is public + immutable — not subject to deletion.

## Open items for counsel
- Fill incident-lead + counsel contacts; confirm the applicable breach-notification
  deadlines and regulator list for target jurisdictions.
