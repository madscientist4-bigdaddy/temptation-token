# Google Search Console Setup — temptationtoken.io
*Step-by-step guide for Jim*

---

## Step 1: Add Property (Verify Ownership)

1. Go to **search.google.com/search-console**
2. Click **"+ Add property"** (top left dropdown)
3. Choose **"Domain"** (covers all subdomains, http/https)
4. Enter: `temptationtoken.io`
5. Google will show you a TXT record to add

**Add the TXT record in Hostinger:**
1. Log in to hpanel.hostinger.com
2. Go to **Domains → Manage → DNS / Nameservers**
3. Click **"Add Record"**
4. Type: **TXT**
5. Name/Host: `@` (or leave blank)
6. Value: paste the Google-provided TXT string (looks like: `google-site-verification=xxxxx`)
7. TTL: 3600 (or default)
8. Save

DNS propagation takes 5–30 minutes. Return to Search Console and click **"Verify"**. If it fails, wait 10 more minutes and try again.

---

## Step 2: Submit Sitemap

WordPress with Rank Math automatically generates a sitemap at:
```
https://temptationtoken.io/sitemap_index.xml
```

To submit:
1. In Search Console, click **"Sitemaps"** (left sidebar)
2. Enter: `sitemap_index.xml`
3. Click **"Submit"**

Google will start crawling within 24–72 hours.

**Verify your sitemap includes:**
- Homepage
- All 5 blog posts
- FAQ page
- Trust page (if published as WordPress page)
- Audit page (if published)

If any page is missing from the sitemap: In WordPress → Rank Math → Sitemap → check that post type is enabled.

---

## Step 3: Request Manual Indexing (Priority Pages)

For fast indexing of your most important pages, use the URL Inspection tool:

1. Click the search bar at the top of Search Console
2. Paste the URL
3. Click **"Request Indexing"**

**Do this for each URL in this order:**
1. `https://temptationtoken.io` — homepage
2. `https://temptationtoken.io/2026/05/01/what-is-temptation-token/`
3. `https://temptationtoken.io/2026/05/05/wincryptoprizes/`
4. `https://temptationtoken.io/2026/05/05/provablyfairvoting/`
5. `https://temptationtoken.io/2026/05/05/ttsstaking/`
6. `https://temptationtoken.io/2026/05/05/cryptoforcharity/`
7. `https://temptationtoken.io/faq/` (once live)
8. `https://temptationtoken.io/trust/` (once live)
9. `https://temptationtoken.io/audit/` (once live)

Google allows roughly 10–12 manual indexing requests per day.

---

## Step 4: Link Search Console to Google Analytics

1. In Search Console → **Settings** → **Associations**
2. Click **"+ Associate"**
3. Select your Google Analytics 4 property for temptationtoken.io
4. This enables organic search traffic data inside GA4 and vice versa

---

## Step 5: What to Monitor in the First 30 Days

**Week 1 — Check:**
- [ ] Are the submitted URLs indexed? (URL Inspection → type each URL)
- [ ] Any Coverage errors? (Coverage → Errors tab)
- [ ] Any Manual Actions? (Security & Manual Actions → Manual Actions — should be clean)

**Week 2–3 — Check:**
- [ ] Performance → Queries: what is Google showing $TTS for?
- [ ] Are "temptation token" and "$TTS" queries appearing?
- [ ] Which pages have the most impressions?
- [ ] Click-through rate (CTR) — should be 2–8% for brand terms

**Week 3–4 — Check:**
- [ ] Core Web Vitals (Experience tab) — fix any "Poor" scores
- [ ] Mobile Usability — any errors?
- [ ] Rich Results — if FAQ schema is working, you may see FAQ snippets in search

**30-Day Goals:**
- All 9 priority pages indexed ✓
- "Temptation token" queries ranking in top 5 (brand term, should be quick)
- "TTS staking" or "vote to earn crypto" queries appearing in impressions
- No manual actions, no security issues

---

## Step 6: Ongoing Monitoring

**Monthly tasks:**
- Check for new crawl errors (Coverage tab)
- Review top 20 queries for opportunities
- Submit any new blog posts via URL Inspection
- Check Core Web Vitals for regressions

**Alert to set up:**
- Search Console → Settings → Email Notifications → enable for: Coverage issues, Manual actions, Security issues

---

## Quick Reference: Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Page not indexed | Request indexing + check robots.txt at temptationtoken.io/robots.txt |
| "Duplicate without canonical" | Set canonical URL in Rank Math for each post |
| Low CTR | Improve meta description (be more specific about what user gets) |
| "Soft 404" error | Page returns 200 but has thin content — add more text |
| Core Web Vitals "Poor" | Compress images, check page load speed at PageSpeed Insights |
