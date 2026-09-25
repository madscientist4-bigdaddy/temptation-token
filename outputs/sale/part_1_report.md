# Part 1 — Crawlability + instant findability

**Status: app side DONE and deployed. WordPress side diagnosed; four items need Jim
because no API path exists.**

Full evidence: `outputs/site/crawl_before_after.md`.

## Headline
**The premise was wrong.** Both hosts already returned **HTTP 200 to all 11 named
crawlers** before any change (22/22), `blog_public` was on, meta robots read
`index, follow`, the sitemap was live, and blog posts already carried BlogPosting +
FAQPage schema. There is also **no Polygon-era copy** — all six "Polygon" hits are
`particles.js` shape config, and "MATIC" appears zero times.

Chasing the stated problem would have wasted the part. The real problems were elsewhere.

## Fixed and deployed
1. **`app.temptationtoken.io` served no `robots.txt`.** The SPA fallback returned
   `index.html` with a 200, so every crawler was parsing HTML as robots directives. Now a
   real file, every agent named explicitly, `/api/` and admin surfaces disallowed.
2. **`sitemap.xml`** for the app — was missing entirely.
3. **`llms.txt` + `llms-full.txt`** — were 404. `llms-full.txt` regenerates from live
   chain/database reads (`ops/sale/gen_llms_full.py`) so its figures date themselves.
4. **`SoftwareApplication` JSON-LD**, canonical link, meta robots on the app.
5. **False and promotional claims removed from the app head, the in-app banner and
   `/audit`** — this turned into the most consequential finding of the whole sprint.
   See `outputs/site/false_claims_2026-09-25.md` and Part 5.

## Gate
| Check | Result |
|---|---|
| user-agent matrix, both hosts | **22/22 → 200** (`scripts/sale/ua_matrix.sh`) |
| robots.txt valid + correct content type | **PASS** — `text/plain` |
| sitemap.xml valid XML, 200 | **PASS** |
| llms.txt / llms-full.txt 200 | **PASS** |
| JSON-LD parses, correct types | **PASS** — SoftwareApplication on app; Organization/WebSite/FAQPage on WP; BlogPosting on posts |
| app renders (not just builds) | **PASS** — loaded in Chrome, 21 profiles, no console errors |
| IndexNow 200/202 | **NOT DONE** — see below |

## Needs Jim — no API path from here
Hostinger blocks WP Application Passwords (`wp/v2/users/me` → 401), and the `tts-api-auth`
plugin exposes only `/elementor/{id}`, `/meta/{id}`, `/css`, `/fix-logo`.

1. **IndexNow** (2 minutes) — Rank Math → Instant Indexing → enable IndexNow, tick
   auto-submit on publish/update. Every AnswerPress post then pings on creation.
2. **Search Console + Bing Webmaster** — both need a DNS TXT record at the registrar.
   Then submit `sitemap_index.xml` in both and request indexing for the top 10 URLs.
3. **`llms.txt` at the WordPress root** — SFTP `public/llms.txt`, or ship plugin 1.1.1.
4. **The false-claim copy fixes on the marketing site** — the urgent ones. A buyer reads
   temptationtoken.io before the app, and it currently promises "Earn Up to 45% APR" for
   a feature that is switched off in every client.

## One thing to raise with SolidProof
Their public TrustNet listing still describes the prize split as **40%**. It has been
35/35/10/20 for months, and "40% near prize words" is a CI-guarded prohibition here.
Included in the draft request at `outputs/sale/solidproof_request.md`.
