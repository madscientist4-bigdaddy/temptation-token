# Part 3 — AI Models division + weekly rotation

**Status: data model DONE and deployed to production. Image generation BLOCKED. Display,
rotation and composer gate NOT BUILT.**

## Done — schema (applied to production Supabase, 2026-09-25)
`outputs/migrations/2026-09-25_entry_type.sql`

Added to `submissions`: `entry_type text`, `consent_record_id uuid`, `ai_provenance jsonb`,
plus a partial index. Two CHECK constraints, both `NOT VALID` so existing rows are never
retroactively rejected:
- `entry_type IN ('verified_creator','ai_model')` or NULL
- `entry_type IS DISTINCT FROM 'verified_creator' OR consent_record_id IS NOT NULL`

**Gate met** — negative and positive tested against production, every insert rolled back:

| Case | Expected | Result |
|---|---|---|
| `verified_creator` without consent | reject | **rejected** (`submissions_creator_needs_consent_chk`) |
| `verified_creator` with consent | accept | accepted |
| `ai_model` without consent | accept | accepted |
| legacy insert, no `entry_type` | accept | accepted |
| `entry_type='robot'` | reject | **rejected** (`submissions_entry_type_chk`) |

**The 21 existing profiles were deliberately left unclassified.** Labelling a real person
as AI-generated, or an AI image as a verified creator, is worse than an honest NULL. That
is a human decision and it belongs in the admin queue.

⚠️ **The "Sept 20 consent-gate design" the brief says to reuse does not exist in this
repo.** The only consent artifacts are a boolean `submissions.nft_consent` and
`contracts/consent-form-template.html`. `consent_record_id` is therefore a uuid with no
table behind it yet — the constraint is enforceable but the referent needs designing.

## Blocked — image generation
`IMAGE_API_KEY` is not in `.env` and no provider is chosen (Plan task T10, 2026-09-25
10:00). Nothing downstream — the 48 portraits, the NSFW and apparent-age safety pass, the
approval queue, the provenance manifest, Supabase storage — can start without it.

When the key lands, the generation spec is fully determined by the brief and needs no
further decisions: 48 portraits (6 weeks × 8), fictional adult women 25–35, varied
ethnicity and styling, fully clothed, 4:5, with the stated negative prompt; auto-reject on
any NSFW flag or estimated age under 25; everything surviving goes to Jim's queue.

## Not built — display, game rule, rotation
- **Badge + filter tabs + footer line** across web, mobile, Telegram Mini App and Social
  Composer. Straightforward once there is anything to label.
- **The game rule matters more than it looks.** The brief prefers AI Models living
  off-chain in their own free-vote division. I checked V3d: `batchApproveProfiles` and the
  round's `profileIds` array have **no concept of an excluded or non-paying profile**, and
  `_distributePayouts` pays whatever VRF selects. So the contract cannot exclude an AI
  profile, which forces the fallback: any prize an AI profile wins must be rolled into the
  next round by the Bank and logged publicly on `/audit`. **That is a manual, trusted step
  on a platform whose selling point is that it runs itself** — and with 21 unclassified
  profiles already on-chain in round 13, a paid prize could land on an AI entry this week
  if anyone votes. The off-chain division is the right answer; the on-chain fallback
  should be treated as a stopgap, not a design.
- **Weekly rotation job** (launchd, Mondays 07:00 ET): retire the 4 oldest, activate the
  next 4 approved, retire one extra per new verified creator, log to
  `ops/sale/rotation_log.csv`, post to admin chat. Nothing to rotate yet.

## Unblock
Jim: pick a provider, create the key, `IMAGE_API_KEY=... >> .env`. Everything else in this
part is downstream of that one line.
