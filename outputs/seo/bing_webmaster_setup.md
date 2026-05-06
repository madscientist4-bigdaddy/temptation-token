# Bing Webmaster Tools Setup — temptationtoken.io

*Bing feeds Yahoo search as well — one setup covers both engines.*

---

## Why Bother with Bing

- Bing + Yahoo combined: ~8–12% of search market share
- Bing indexes faster than Google for new domains
- Powers Microsoft Copilot search results
- Free — takes 10 minutes

---

## Step 1: Add Your Site

1. Go to **bing.com/webmasters** → sign in with any Microsoft account
2. Click **"Add a site"**
3. Enter: `https://temptationtoken.io` → click **Add**

---

## Step 2: Verify Ownership

Bing offers three methods. **Fastest: import from Google Search Console** (if GSC is already verified).

### Option A — Import from Google Search Console (recommended)

1. On the verification screen, click **"Import from Google Search Console"**
2. Sign in to your Google account
3. Select the `temptationtoken.io` property
4. Click **Import** → instant verification, no DNS changes needed
5. Bing also imports your Google sitemap automatically

> Use this if Google Search Console is already verified. Skip to Step 3.

---

### Option B — DNS TXT Record via Hostinger

If GSC isn't verified yet:

1. Bing shows you a TXT record like:
   ```
   MSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   Copy the full value.

2. Log in to **hpanel.hostinger.com**
3. Go to **Domains → temptationtoken.io → DNS / Nameservers → DNS Zone Editor**
4. Click **"Add Record"**:

   | Field | Value |
   |-------|-------|
   | Type | TXT |
   | Name | `@` |
   | Value | `MSxxxxxxxxx...` ← paste Bing's verification string |
   | TTL | `3600` |

5. Click **Save**
6. Return to Bing Webmaster → click **Verify**

> Propagation: same as Google — up to 48 hours, but usually within 30 minutes on Hostinger.

---

### Option C — Meta Tag

If you have access to WordPress:

1. Bing provides a meta tag like:
   ```html
   <meta name="msvalidate.01" content="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" />
   ```
2. In WordPress → Rank Math → General Settings → Webmaster Tools → paste the Bing verification code in the **Bing Webmaster Tools** field → Save
3. Return to Bing Webmaster → Verify

---

## Step 3: Submit Sitemap

1. In Bing Webmaster left sidebar → **Sitemaps**
2. Click **"Submit sitemap"**
3. Enter:
   ```
   https://temptationtoken.io/sitemap_index.xml
   ```
4. Click **Submit**

If you used Option A (import from GSC), the sitemap is already imported — confirm it shows status "Success".

---

## Step 4: Request Indexing — URL Submission

Bing has a URL submission tool that works faster than waiting for crawl.

1. Left sidebar → **URL Submission**
2. Submit each URL (paste and press Enter):

   ```
   https://temptationtoken.io/
   https://temptationtoken.io/faq/
   https://temptationtoken.io/blog/
   https://temptationtoken.io/2026/05/01/what-is-temptation-token/
   https://temptationtoken.io/2026/05/05/wincryptoprizes/
   https://temptationtoken.io/2026/05/05/provablyfairvoting/
   https://temptationtoken.io/2026/05/05/ttsstaking/
   https://temptationtoken.io/2026/05/05/cryptoforcharity/
   https://temptationtoken.io/trust/
   https://temptationtoken.io/audit/
   ```

> Bing allows 10 free URL submissions per day on a new site. Submit all 10 at once.

---

## Step 5: Configure Crawl Settings (Optional but Recommended)

1. Left sidebar → **Crawl Control**
2. Set crawl rate: **Normal** (don't throttle Bing — you want fast indexing)
3. Left sidebar → **Crawl Settings** → verify crawl time preference: **Any time**

---

## Step 6: Monitor Performance

**Day 7**
- Left sidebar → **Reports & Data → Index Explorer** → check which pages are indexed
- URL Submission → check submission status

**Day 14**
- Left sidebar → **Reports & Data → Search Performance** → look for brand queries
- "temptation token", "TTS token", "vote to earn" should start appearing

**Day 30**
- Performance data comparable to early Google data
- Check: Pages Indexed, Crawl Errors, Search Keywords

---

## Rank Math Integration (WordPress — do once)

Rank Math connects directly to Bing Webmaster, auto-submitting new/updated URLs:

1. WordPress → **Rank Math → General Settings → Webmaster Tools**
2. Paste the Bing verification code in **"Bing Webmaster Tools"** field → Save
3. WordPress → **Rank Math → General Settings → Others** → enable **"Bing Search Console"** if shown
4. This auto-pings Bing whenever you publish or update a post

---

## Quick Fixes

| Problem | Fix |
|---------|-----|
| Verify fails | Check TXT record in Hostinger — Name must be `@`, TTL 3600 |
| Pages not indexed after 14 days | Re-submit via URL Submission tool |
| "Blocked by robots.txt" | Check temptationtoken.io/robots.txt — Bingbot must not be blocked |
| Low impressions | Add more internal links between pages; Bing weights link structure heavily |
| Import from GSC fails | GSC property must be verified first; use DNS method instead |

---

## Coverage Summary

| Engine | Tool | Share |
|--------|------|-------|
| Google | Google Search Console | ~90% |
| Bing | Bing Webmaster Tools | ~7% |
| Yahoo | Powered by Bing — covered automatically | ~3% |
| DuckDuckGo | Powered by Bing — covered automatically | ~2% |

**Submitting to Bing Webmaster once covers Bing, Yahoo, and DuckDuckGo.**
