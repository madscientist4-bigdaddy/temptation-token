# TTS Marketing Engine — GO-LIVE REPORT

**Run date:** 2026-07-27 · **Mode:** autonomous integration · **Live status:** DRY_RUN (not flipped)
**Source package:** `~/Downloads/tts-marketing-engine` (task path `./tts-marketing-engine` was
empty; package was in Downloads — verified by manifest + README).

## Headline
The engine is **integrated, ported to this repo's architecture, and proven in DRY_RUN
(6/6 simulation, 10/10 engine tests, host build green)**. **GO-LIVE is BLOCKED** on two
external prerequisites — the Supabase schema can't be applied without DB credentials, and
the Railway worker needs a paid upgrade. `DRY_RUN=true` everywhere; nothing posts publicly.

Foundational adaptation: the engine ships **Next.js App Router** routes; this repo is a
**Vite SPA + plain-JS Vercel functions at the 12/12 Hobby ceiling**. Per your decision, I
**adapted into the existing pattern** — ported the libs to JS ESM under `lib/marketing/`
and folded all routes into existing functions via `?action=` (no new functions, still 12/12).

## Step-by-step

| # | Step | Status | Detail |
|---|------|--------|--------|
| 1 | ENVS | ✅/⏸️ PARTIAL | CRON_SECRET (32-byte hex) + APP_URL + CANON_BONUS + DRY_RUN=true written to `.env.local` (secret never printed/committed). **Vercel/Railway env push deferred** with go-live (see BLOCKED) — exact commands below. |
| 2 | SCHEMA | ⛔ SKIPPED | No `supabase` CLI; `SUPABASE_SERVICE_KEY` is a Sensitive Vercel var (unpullable) and no `MIGRATION_DATABASE_URL` → cannot run DDL. **SQL ready to paste** (see "needs human"). All 7 tables + RLS defined in `sql/001_marketing_schema.sql`. |
| 3 | PLACE CODE | ✅ DONE (adapted) | Libs → `lib/marketing/*` (JS ESM). Routes consolidated: `scheduler.js?action=dispatch` (CRON_SECRET bearer), `admin.js?action=crm-import` + 7 marketing tables allow-listed in the data proxy, `social-post.js?action=og-card` (satori PNG). Rewrites: `/api/cron/dispatch`, `/api/og/card`, `/api/crm/import`. **CRM board UI** (crm-page.tsx) not ported into the React admin SPA — data layer is live via the admin proxy; the board is a follow-up. **Kit route** not built (see notes). |
| 4 | INTEGRATE | ✅ DONE | `fetchRoundState` / `getStandings` / `claimEvent` implemented against real TTSVotingV3d (viem) + Supabase. Bot `/watch <wallet>` upserts `outbid_watchers`. `worker/outbid.js` wired to real deps. |
| 5 | WP FIXES | ⛔ SKIPPED | No `WP_*` envs + tts-api-auth plugin not installed (CLAUDE.md). Site reachable (200) but unauthenticated. `wp-diff.txt` documents. |
| 6 | TEST | ✅ DONE | Engine `engine.test.ts` **10/10**. Host `npm run build` green. Prize-split guard PASS. ("Full Next build" N/A — no Next.) |
| 7 | SIMULATE | ✅ 6/6 | `scripts/marketing_simulate.mjs` → all six events fire once, round=4 (>0), pool string non-empty, every rendered card 40–42KB (>10KB), second pass dedupes to 0. Log: `simulation.txt`. |
| 8 | AUTO GO-LIVE | ⛔ BLOCKED | Step 6 green + step 7 all-passed, BUT prerequisites unmet: schema not applied (`posted_events` missing → `claimEvent` would error in prod) and Railway worker not upgraded ($5, human). **DRY_RUN left true; not deployed.** Flipping now would ship a dispatcher whose exactly-once guard can't function. |
| 9 | BASE PACKAGE | ✅ DONE (1 human bit) | `/.well-known/farcaster.json` served; `marketing/base-dev/`: app-icon-1024, cover-1200x630 (no Base logo), three 1284×2778 live screenshots (vote/standings/winners), 56-char tagline; `base-submission.txt` draft. farcaster `accountAssociation` needs signing (human). |
| 10 | REPORT | ✅ DONE | This file. |

## Simulation results (step 7)
```
exactly six events fire (pass 1)      ✅ [round_open, midpoint, friday_push, final_hours, winner, weekly_report]
all six distinct event ids covered    ✅
round number > 0                      ✅ round=4 (real on-chain)
pool string non-empty                 ✅ "$0.00" (round 4 holds 10 test-TTS; TTS_USD is a placeholder)
every rendered card buffer > 10KB     ✅ roundOpen:40714b midpoint:42265b winner:41032b
second invocation fires zero (dedupe) ✅ 0 fired
RESULT: 6/6
```

## Everything that needs a human
1. **Apply the DB schema** (unblocks go-live). Paste `~/Downloads/tts-marketing-engine/sql/001_marketing_schema.sql`
   into the Supabase SQL editor (or `supabase db push` once linked). Creates the 7 tables with RLS enabled.
   Without `posted_events`, the dispatcher's exactly-once `claimEvent` cannot run.
2. **Railway Trial→Hobby $5/mo upgrade** + deploy `worker/` so the 10-min tick hits `/api/cron/dispatch`.
3. **Set envs in Vercel + Railway** (I generated CRON_SECRET locally, never printed). Must be the SAME value in both:
   `vercel env add CRON_SECRET production` · also APP_URL, CANON_BONUS, DRY_RUN=true, DISCORD_WEBHOOK_URL, RESEND_API_KEY.
4. **Flip go-live** once 1–3 done: set `DRY_RUN=false` on Vercel + Railway, `vercel --prod`, confirm one worker tick → 200,
   send "engine live" to ADMIN_CHAT_ID only.
5. **WP fixes**: install tts-api-auth plugin, set WP_* envs, re-run wp_fixes.py.
6. **Base**: sign `farcaster.json` accountAssociation; submit at buildonbase.deform.cc with the drafted text + assets.
7. **Price oracle**: `TTS_USD` is a placeholder (pool/prize USD). Wire a real price for accurate marketing copy.
8. **Instagram**: never automated (per instruction) — all IG outreach stays manual via the CRM.

## Deliberate non-actions (safety)
- **Not pushed / not deployed.** All work committed locally in logical chunks; per standing policy I hold
  `git push` + `vercel --prod` for your go-ahead. Nothing outward-facing changed.
- **DRY_RUN not flipped** — see step 8.
- **No secrets printed, logged, or committed.** `.env.local` is gitignored.

## Follow-ups (not blockers)
- Port `crm-page.tsx` into the React admin dashboard (data layer already live via `/api/admin-data` on `prospects`).
- Build the Contestant Kit route (`/api/kit/[handle]` → 3 stories + QR + captions ZIP) — deferred; `generate_kit.py`
  remains usable locally.
