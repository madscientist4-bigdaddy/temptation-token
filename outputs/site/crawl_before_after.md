# Crawlability — before and after, 2026-09-25

## The brief's premise did not hold
Part 1 opened with "an external fetch of temptationtoken.io on Sept 24 was refused by the
site's robots rules, and search results still show the old Polygon-era homepage copy."
Both halves are wrong, and it matters, because acting on them would have meant loosening
rules that were never tight and rewriting copy that does not exist.

**Measured, not assumed:**
- `robots.txt` on the WordPress site is permissive: `User-agent: * / Disallow: /wp-admin/`
  plus a `Sitemap:` line. Nothing is disallowed that matters.
- `blog_public` is on — the homepage serves `<meta name="robots" content="follow, index,
  max-snippet:-1, max-image-preview:large">`. A discouraged site would serve `noindex`.
- No `X-Robots-Tag` header on either host.
- `sitemap_index.xml` returns 200 with five child sitemaps (Rank Math).
- Blog posts already carry `BlogPosting`, `FAQPage`, `BreadcrumbList`, `Organization`,
  `Person` and `WebSite` JSON-LD. AnswerPress and Rank Math are not duplicating.
- **No Polygon copy exists.** All six "Polygon" matches on the homepage are
  `particles.js` shape config (`"polygon":{"nb_sides":5}`). Zero matches for "MATIC".

### User-agent matrix — before
Eleven crawlers, both hosts, HTTP status of `GET /`:

| Agent | temptationtoken.io | app.temptationtoken.io |
|---|---|---|
| Googlebot, Bingbot, DuckDuckBot, Applebot | 200 | 200 |
| GPTBot, OAI-SearchBot, ChatGPT-User | 200 | 200 |
| ClaudeBot, Claude-User | 200 | 200 |
| PerplexityBot, CCBot | 200 | 200 |

**22 of 22 returned 200 before any change.** Whatever refused a fetch on Sept 24, it was
not this site's robots rules, and not Hostinger or LiteSpeed blocking these agents.

## What was actually broken, and is now fixed

| Problem | Before | After |
|---|---|---|
| `app.temptationtoken.io/robots.txt` | **No file.** The SPA fallback returned `index.html` with HTTP 200, so crawlers parsed HTML as robots directives. | Real `robots.txt`, `text/plain`, every named agent allowed explicitly plus a wildcard; `/api/`, `/admin`, `protect.html`, `delete-account.html` disallowed. |
| App sitemap | none | `sitemap.xml`, 200, valid XML |
| `llms.txt` | 404 on both hosts | `llms.txt` + `llms-full.txt` live on the app, 200, `text/plain` |
| App schema | `WebApplication`, no canonical | `SoftwareApplication` (`GameApplication`, `Web, Android`), canonical, meta robots |
| App meta copy | earnings promises and a false audit claim | rewritten — see `false_claims_2026-09-25.md` |

`llms-full.txt` is regenerated from live chain and database reads by
`ops/sale/gen_llms_full.py`, so the published figures carry their own timestamp and
cannot quietly rot.

## Still outstanding — needs Jim, no API path exists
The WordPress plugin (`tts-api-auth` 1.1.0) exposes only `/elementor/{id}`, `/meta/{id}`,
`/css`, `/fix-logo`, `/status`, `/setup`. Application Passwords are blocked by Hostinger
(verified: `wp/v2/users/me` → 401 `rest_not_logged_in`). So none of the following can be
done from here:

1. **IndexNow** — not configured (`/indexnow.txt` 404). Rank Math has it built in:
   WP Admin → Rank Math → Instant Indexing → enable IndexNow, tick "auto-submit on
   publish/update". Two minutes, and every AnswerPress post pings on creation.
2. **Search Console + Bing Webmaster** — both need a DNS TXT record at the registrar,
   which only Jim can add. Then submit `sitemap_index.xml` in both.
3. **`llms.txt` on the WordPress host** — no route can write a file at the domain root.
   Either upload `public/llms.txt` by SFTP, or ship plugin 1.1.1 with a route for it.
   The app's copy is live and is the canonical one meanwhile.
4. **The false-claim copy fixes** listed in `false_claims_2026-09-25.md`. These are the
   urgent ones — a buyer reads the marketing site before the app.

## Re-run the matrix
`bash scripts/sale/ua_matrix.sh` reprints the table above against both hosts.
