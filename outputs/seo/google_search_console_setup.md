# Google Search Console Setup — temptationtoken.io

*Step-by-step guide for Jim*

---

## Step 1: Verify Ownership via Hostinger DNS

1. Go to **search.google.com/search-console**
2. Click **"+ Add property"** → choose **"Domain"** (not URL prefix — Domain covers all subdomains and both http/https)
3. Enter: `temptationtoken.io` → click **Continue**
4. Google displays a TXT record to add — it looks like:
   ```
   google-site-verification=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   Copy the entire value.

5. Open a new tab → log in to **hpanel.hostinger.com**
6. Go to **Domains → temptationtoken.io → DNS / Nameservers → DNS Zone Editor**
7. Click **"Add Record"** and fill in:

   | Field | Value |
   |-------|-------|
   | Type | TXT |
   | Name | `@` |
   | Value | `google-site-verification=xxxxx` ← paste the full string Google gave you |
   | TTL | `3600` |

8. Click **Save**
9. Return to Search Console → click **Verify**

> **Propagation:** DNS changes take anywhere from a few minutes up to 48 hours to fully propagate worldwide. If Verify fails immediately, wait 15–30 minutes and try again. Google Search Console will keep retrying in the background.

---

## Step 2: Submit Sitemap

After ownership is verified:

1. In Search Console left sidebar → click **"Sitemaps"**
2. In the "Add a new sitemap" box, paste:
   ```
   temptationtoken.io/sitemap_index.xml
   ```
3. Click **Submit**

Google will begin crawling within 24–72 hours. The Rank Math plugin generates this sitemap automatically. If the sitemap URL returns a 404, go to WordPress → Rank Math → General Settings → Sitemap → toggle XML Sitemap on → Save.

---

## Step 3: Request Indexing — URL by URL

Use the URL Inspection tool to fast-track priority pages. Google processes manual requests within 1–7 days.

**How to use URL Inspection:**
1. Click the search bar at the very top of Search Console
2. Paste a URL → press Enter
3. Click **"Request Indexing"**
4. Wait for confirmation message → repeat for next URL

**Submit in this exact order:**

| # | URL |
|---|-----|
| 1 | `https://temptationtoken.io/` |
| 2 | `https://temptationtoken.io/faq/` |
| 3 | `https://temptationtoken.io/blog/` |
| 4 | `https://temptationtoken.io/2026/05/01/what-is-temptation-token/` |
| 5 | `https://temptationtoken.io/2026/05/05/wincryptoprizes/` |
| 6 | `https://temptationtoken.io/2026/05/05/provablyfairvoting/` |
| 7 | `https://temptationtoken.io/2026/05/05/ttsstaking/` |
| 8 | `https://temptationtoken.io/2026/05/05/cryptoforcharity/` |
| 9 | `https://temptationtoken.io/trust/` |
| 10 | `https://temptationtoken.io/audit/` |

> Google allows ~10–12 manual indexing requests per day. Submit all 10 in one session — they are all high priority. /faq/, /trust/, and /audit/ must be published in WordPress before requesting indexing.

---

## Step 4: What to Check at 7, 14, and 30 Days

**Day 7**
- URL Inspection on each URL above → should show "URL is on Google" for homepage and blog posts
- Coverage tab → Errors column → fix any red items

**Day 14**
- Performance → Queries → look for "temptation token", "$TTS", "vote to earn crypto" appearing
- If brand queries aren't showing yet, the domain is too new — this is normal, keep building links

**Day 30**
- Brand keywords ranking in top 5 (homepage should own "temptation token")
- Blog posts ranking for long-tail queries like "TTS staking rewards", "provably fair crypto voting"
- Core Web Vitals (Experience tab) — target all green

---

## Quick Fixes

| Problem | Fix |
|---------|-----|
| Verify fails after 48 hours | Double-check TXT record in Hostinger — Name must be `@`, not `temptationtoken.io` |
| Page shows "Discovered — not indexed" | Wait 7 days, then re-request indexing |
| Sitemap returns 404 | WordPress → Rank Math → Sitemap → enable and Save |
| noindex warning on a page | Rank Math → Edit page → Advanced → uncheck "No Index" |
| "Soft 404" error | Page returning 200 but nearly empty — add content |
