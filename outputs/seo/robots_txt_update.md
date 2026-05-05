# Robots.txt Update Recommendations
## temptationtoken.io

---

## Current Robots.txt Check

Run this to see current robots.txt:
```
curl https://temptationtoken.io/robots.txt
```

---

## Recommended robots.txt Content

Replace or update your robots.txt (WordPress → Yoast/Rank Math → Tools → Edit robots.txt) with:

```
User-agent: *
Allow: /

# Block admin areas
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

# Block low-value pages
Disallow: /wp-login.php
Disallow: /?s=
Disallow: /search/
Disallow: /page/
Disallow: /tag/
Disallow: /author/

# Block media attachment pages
Disallow: /?attachment_id=

# Sitemap
Sitemap: https://temptationtoken.io/sitemap_index.xml
Sitemap: https://temptationtoken.io/sitemap.xml
```

---

## Key Changes Needed

1. **Add Sitemap reference** — Critical for Google/Bing to find all pages
   ```
   Sitemap: https://temptationtoken.io/sitemap_index.xml
   ```

2. **Ensure /faq, /audit, /trust are NOT blocked** — These are key SEO pages

3. **Verify sitemap exists** at https://temptationtoken.io/sitemap_index.xml
   - If 404: Install Rank Math or Yoast → enable sitemaps
   - Rank Math: SEO → Sitemap Settings → enable XML Sitemap

---

## Sitemap Submission (Google Search Console)

After verifying robots.txt:

1. Go to Google Search Console → sitemap_index.xml page
2. Submit: `https://temptationtoken.io/sitemap_index.xml`
3. Also submit: `https://temptationtoken.io/page-sitemap.xml` (pages only)
4. Check for errors after 24-48 hours

---

## Priority Pages to Index

Ensure these are in the sitemap and not noindex'd:
- https://temptationtoken.io/ (homepage)
- https://temptationtoken.io/faq/
- https://temptationtoken.io/audit/
- https://temptationtoken.io/trust/
- https://temptationtoken.io/blog/ (and all posts)
- https://temptationtoken.io/forwomen/
