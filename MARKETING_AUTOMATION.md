# Marketing Engine — Automation Checklist (final)

Source: `~/Downloads/tts-marketing-engine`. Full detail in `marketing-reports/GO-LIVE-REPORT.md`.
Architecture decision: **adapt to this repo** (JS ESM libs + `?action=` routes on existing
functions; stay on Vercel Hobby, 12/12). DRY_RUN=true throughout — nothing posted live.

| # | Step | Status |
|---|------|--------|
| 0 | Read README + INSTALL_PROMPT | ✅ DONE |
| 1 | ENVS (CRON_SECRET + vars) | ✅ .env.local DONE · ⏸️ Vercel/Railway deferred to go-live |
| 2 | SCHEMA apply | ⛔ SKIPPED — no DDL creds (SQL ready to paste) |
| 3 | PLACE CODE (libs + routes) | ✅ DONE (adapted) — CRM board UI + kit route are follow-ups |
| 4 | INTEGRATE (3 TODOs + /watch + outbid) | ✅ DONE |
| 5 | WP FIXES | ⛔ SKIPPED — no WP_* envs + plugin not installed |
| 6 | TEST (engine 10/10 + build) | ✅ DONE (10/10, build green, guard PASS) |
| 7 | SIMULATE (6 events + dedupe) | ✅ 6/6 |
| 8 | AUTO GO-LIVE | ⛔ BLOCKED — schema + Railway upgrade prerequisites unmet; DRY_RUN left true, not deployed |
| 9 | BASE PACKAGE | ✅ DONE — farcaster.json + assets + screenshots + submission draft (accountAssociation needs signing) |
| 10 | REPORT | ✅ DONE — marketing-reports/GO-LIVE-REPORT.md |

**Verified green:** engine tests 10/10 · host build · prize-split guard · DRY_RUN simulation 6/6.
**Needs a human:** apply schema · Railway $5 upgrade · set Vercel/Railway envs · flip DRY_RUN=false + deploy ·
WP plugin+creds · sign farcaster.json · price oracle for TTS_USD. (Instagram never automated.)
**Not pushed / not deployed** — held for go-ahead per standing policy.
