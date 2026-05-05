# Google Search Console — Setup & Submission Guide
## temptationtoken.io

---

## Step 1: Verify Ownership

**Recommended method: HTML file upload**

1. Go to Google Search Console: https://search.google.com/search-console
2. Click "Add Property" → enter `https://temptationtoken.io`
3. Choose "HTML file" verification method
4. Download the verification file (e.g., `googleXXXXXXX.html`)
5. Upload it to your WordPress root directory via FTP or File Manager in cPanel
6. Click "Verify" in Search Console

**Alternative: Rank Math (easiest)**
1. Go to Rank Math → General Settings → Webmaster Tools
2. Paste the Google Search Console verification code in the "Google Search Console" field
3. Save → Click Verify in GSC

---

## Step 2: Submit Sitemaps

After verification:

1. In Search Console sidebar → **Sitemaps**
2. Submit these URLs one by one:
   - `https://temptationtoken.io/sitemap_index.xml`
   - `https://temptationtoken.io/page-sitemap.xml`
   - `https://temptationtoken.io/post-sitemap.xml`

3. Wait 24-48 hours for Google to crawl

**To generate sitemaps:** Rank Math → SEO → Sitemap Settings → Enable XML Sitemap → Save

---

## Step 3: URL Inspection — Force Index Priority Pages

For each priority page, do URL inspection → Request indexing:

1. Click "URL Inspection" in left sidebar
2. Paste URL → Enter
3. Click "Request Indexing"
4. Repeat for:
   - `https://temptationtoken.io/`
   - `https://temptationtoken.io/faq/`
   - `https://temptationtoken.io/audit/`
   - `https://temptationtoken.io/trust/`
   - `https://temptationtoken.io/blog/`

Google will typically index within 1-7 days after request.

---

## Step 4: Check Coverage Report

After 7 days:
1. Sidebar → **Coverage** (or **Indexing → Pages**)
2. Look for errors in:
   - "Excluded" tab — pages Google won't index
   - "Error" tab — pages with crawl errors
3. Common issues to fix:
   - "Discovered – currently not indexed" → request indexing again
   - "Redirect error" → check your permalink settings
   - "noindex tag detected" → check Rank Math settings per page

---

## Step 5: Monitor Performance

After 2 weeks:
1. Sidebar → **Performance → Search results**
2. Check:
   - Which queries are getting impressions (even with 0 clicks means Google sees you)
   - Click-through rate (CTR) — target 3-5% from search
   - Average position — target under 20 for brand keywords

**Target keywords to track:**
- `temptation token`
- `temptation token TTS`
- `TTS crypto game`
- `vote to earn crypto`
- `temptation token audit`
- `temptation token staking`
- `TTS base blockchain`

---

## Step 6: Fix Common Issues

### Rank Math Meta Not Showing
1. Rank Math → Titles & Metas → each page → verify title/description are filled
2. Clear any caching plugins (WP Rocket, W3 Total Cache)
3. Re-save permalinks: Settings → Permalinks → Save Changes

### OG Image Broken
1. For each page: Rank Math → Social Preview → set OG image manually
2. Use: `https://temptationtoken.io/wp-content/uploads/2024/06/Copy-of-Temptation-Token-Coin-1024x1024.webp`
3. Clear social cache: https://developers.facebook.com/tools/debug/

### Duplicate Content
Check for duplicate pages:
- `temptationtoken.io/` and `temptationtoken.io/index.php` — should redirect to same
- Rank Math → Redirections — add any needed 301 redirects

---

## Bing Search Console

Also submit to Bing (same properties, same sitemaps):
1. https://www.bing.com/webmasters
2. Import from Google Search Console (one-click if GSC verified)
3. Submit sitemaps

---

## Expected Timeline

| Day | Expected |
|-----|----------|
| 1–3 | Google crawls sitemap |
| 3–7 | Priority pages indexed |
| 7–14 | Brand keywords start showing in GSC |
| 14–30 | Organic impressions growing |
| 30–60 | Ranking for long-tail queries |
| 60–90 | Competing for "temptation token" head term |
