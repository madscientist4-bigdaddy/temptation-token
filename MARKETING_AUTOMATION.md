# Marketing Engine — Automation Checklist

Source package: `~/Downloads/tts-marketing-engine` (task said `./tts-marketing-engine`;
it was actually in Downloads — same package, verified by file manifest + README).

Status legend: ✅ DONE · ⏭️ SKIPPED (reason) · ⏳ PENDING · 🚧 BLOCKED (needs decision/human)

| # | Step | Status | Notes |
|---|------|--------|-------|
| 0 | Read README + INSTALL_PROMPT | ✅ DONE | Engine is Next.js-App-Router-shaped; host repo is Vite SPA + `api/*.js` (mismatch — see decision) |
| 1 | ENVS: CRON_SECRET + non-secret vars in .env.local | ✅ DONE (local) | 32-byte hex CRON_SECRET generated (never printed); APP_URL, CANON_BONUS, DRY_RUN=true set. Vercel/Railway env push ⏳ pending framework decision |
| 2 | SCHEMA: apply 001_marketing_schema.sql | 🚧 BLOCKED | supabase CLI not installed; SUPABASE_SERVICE_KEY is a Sensitive Vercel var (unpullable) and no MIGRATION_DATABASE_URL → cannot run DDL. Needs a DB connection string or manual paste (SQL is ready to hand you) |
| 3 | PLACE CODE (routes + lib/marketing) | 🚧 BLOCKED | Framework mismatch + 12/12 function ceiling — see decision below |
| 4 | INTEGRATE 3 TODOs + /watch bot cmd + outbid worker | ⏳ PENDING | Depends on #3 shape |
| 5 | WP FIXES (wp_fixes.py) | ⏭️ likely SKIP | WP_* envs not set + tts-api-auth plugin not installed (CLAUDE.md) — will confirm/skip |
| 6 | TEST: engine.test.ts 10/10 + full build | ✅ 10/10 (engine tests) | `npx tsx --test` → 10 pass / 0 fail. "Full Next build" N/A (no Next). Host build gate ⏳ after #3 |
| 7 | SIMULATE 6 events, DRY_RUN, dedupe | ⏳ PENDING | Depends on #3/#4 |
| 8 | AUTO GO-LIVE (flip DRY_RUN=false, deploy) | 🚧 BLOCKED | Gated on #6+#7; Railway worker needs Trial→Hobby $5 upgrade (payment = human) |
| 9 | BASE PACKAGE (farcaster.json, assets, screenshots, submission) | ⏳ PENDING | Largely independent; can proceed after core |
| 10 | REPORT: GO-LIVE-REPORT.md | ⏳ IN PROGRESS | Built continuously |

## Foundational decision blocking steps 3/4/7/8
The engine ships **Next.js App Router** routes (`app/api/.../route.ts`, `@vercel/og`,
satori, TypeScript). This repo is **Vite + React 19 SPA** with plain-JS Vercel
functions in `api/*.js`, on the **Vercel Hobby plan at 12/12 functions**. Placing the
engine's 5 routes literally (a) won't run — there is no Next.js runtime here — and (b)
even rewritten as JS functions would push 12→17, over the Hobby ceiling → deploy fails.
Awaiting Jim's call on how to reconcile (see chat).
