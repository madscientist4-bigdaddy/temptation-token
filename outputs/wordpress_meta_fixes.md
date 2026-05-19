# WordPress Meta / Content Fixes — Required Before Investor/Listing Presentation

**Generated:** 2026-05-19  
**Status:** PENDING — requires WP admin access (tts-api-auth plugin not yet installed)  
**Priority:** 🚨 CRITICAL — "adult entertainment" strings and "40%" are in live OG/meta tags indexed by Google and social crawlers

---

## How to Apply

Once the tts-api-auth plugin is installed and API key registered, use these curl commands. Replace `YOUR_KEY` with the key set during setup.

Alternatively, apply each fix manually in WP Admin → Rank Math → Edit each page's meta fields.

---

## Fix 1 — Homepage OG Title (CRITICAL: "Adult Entertainment & NFTs")

**Current (WRONG):**
```
og:title = "Temptation Token: Revolutionizing Adult Entertainment & NFTs"
twitter:title = "Temptation Token: Revolutionizing Adult Entertainment & NFTs"
page <title> = "Temptation Token: Revolutionizing Adult Entertainment & NFTs"
```

**Correct:**
```
Temptation Token ($TTS) — Vote to Win Crypto Every Week on Base Blockchain
```

**WP Admin path:** Rank Math → Edit Page (ID 52) → Title → set above value

---

## Fix 2 — Homepage OG Description (CRITICAL: "40%")

**Current (WRONG):**
```
og:description = "Experience the first crypto Hot-or-Not on Base blockchain with Temptation Token. Vote $TTS weekly and win 40% of the prize pool!"
meta description = same
twitter:description = same
```

**Correct:**
```
The crypto-powered Hot-or-Not voting game on Base. Vote $TTS weekly. Top voter wins 35% of the prize pool. Losers' votes burn. Powered by Chainlink VRF.
```

**WP Admin path:** Rank Math → Edit Page (ID 52) → Description → set above value

---

## Fix 3 — Homepage OG Site Name (CRITICAL: "Adult Crypto Game on Base")

**Current (WRONG):**
```
og:site_name = "Temptation Token ($TTS) — Vote. Win. Earn Crypto Weekly | Adult Crypto Game on Base"
```

**Correct:**
```
Temptation Token ($TTS) — Vote. Win. Earn Crypto Weekly on Base
```

**WP Admin path:** WP Admin → Settings → General → Tagline, OR Rank Math → Titles & Meta → Global → Separator/Site Name

---

## Fix 4 — Homepage OG Image Alt (CRITICAL: "Payment Processor for Adult Content")

**Current (WRONG):**
```
og:image:alt = "Secure and Anonymous Payment Processor for Adult Content with Temptation Token"
```

**Correct:**
```
Temptation Token ($TTS) — Weekly Crypto Voting Game on Base Blockchain
```

**WP Admin path:** Media Library → find the OG image → edit Alt Text field

---

## Fix 5 — FAQ Page Meta (CRITICAL: "adult entertainment", "Polygon")

**Current (WRONG):**
```
og:title = "FAQ | Everything About Temptation Token (TTS): Adult Games, NFTs & Crypto Payments"
og:description = "Find Faqs about Temptation Token (TTS), the revolutionary cryptocurrency for adult entertainment, NFTs, and gaming."
og:image:alt = "Temptation Token FAQ - Answers about adult games and NFTs on Polygon blockchain"
twitter:title = same as og:title
twitter:description = same as og:description
```

**Correct:**
```
og:title = "FAQ | Temptation Token ($TTS): How Voting, Prizes & Staking Work"
og:description = "Everything you need to know about Temptation Token. Voting rules, prize splits (35/35/10/20), staking tiers, Chainlink VRF fairness, and how to buy $TTS on Base."
og:image:alt = "Temptation Token ($TTS) FAQ — Vote-to-Earn Game on Base Blockchain"
```

Note: og:image:alt also references "Polygon" which is the wrong chain — TTS is on **Base**, not Polygon.

**WP Admin path:** Rank Math → Edit FAQ page → all meta fields

---

## Fix 6 — FAQ Body Text (CRITICAL: "adult entertainment and NFT markets")

**Current (WRONG):** The FAQ page intro paragraph reads:
> "...with the goal of transforming the adult entertainment and NFT markets. By utilizing advanced blockchain technology, TT offers a secure, anonymous, and efficient payment system tailored specifically for the unique needs of the adult entertainment sector. It provides a platform that supports performers and content creators by enabling them to monetize their work fairly..."

**Correct replacement:**
> "Temptation Token ($TTS) is a vote-to-earn crypto game built on Base blockchain, launched June 2024. Players vote real TTS tokens on submitted profiles each week. The winning profile and top voter split 35% each of the prize pool, with 10% going to the Polaris Project (anti-trafficking nonprofit) and 20% to Blockchain Entertainment LLC. Losing votes burn to the dead address — making TTS deflationary with each round."

**WP Admin path:** Edit FAQ page → find and replace the intro paragraph

---

## Fix 7 — Homepage Image Alt Texts (adult entertainment references in img alt attributes)

**Current (WRONG):**
```html
alt="Temptation Token Blogs about cryptocurrency revolutionizing adult entertainment and NFT markets"
```

**Correct:**
```html
alt="Temptation Token ($TTS) — Crypto voting game on Base blockchain"
```

**WP Admin path:** Media Library → find image → edit Alt Text

---

## Fix 8 — Remove Google Play / Apple Store Images

**Current:** `googleplay.webp` and `applestore.webp` images still render on the homepage as `<img>` elements even though adjacent text says "No download. No app store. Works on any device."

**Fix:** Remove those two image elements from the homepage via WP Admin → Edit Homepage → Elementor → find and delete the two app store image widgets.

---

## Fix 9 — Copyright Footer Year

**Current (WRONG):** Two copyright strings found on homepage:
- `Copyright© 2026 Temptation Token | All Rights Reserved` (correct ✅)
- `Copyright© 2024 Temptation Token I All Rights Reserved` (stale ❌)

**Fix:** Find and update the 2024 instance to 2026 in WP Admin → Appearance → Theme Editor or the Elementor footer widget.

---

## Fix 10 — Telegram Footer Links

**Current:** Footer/nav links to `t.me/temptationtoken` and `t.me/TemptationToken`.

**Issue:** `t.me/temptationtoken` is the main broadcast channel (locked, no interaction). Users clicking this from the marketing site should land on the community chat.

**Fix:** Update Telegram links to:
- Community: `https://t.me/TTSCommunityChat` (for general users)
- Keep the broadcast channel link labelled as "Announcements" (not the primary CTA)

**WP Admin path:** Elementor → Header/Footer sections → find Telegram link → update href

---

## Fix 11 — Dynamic OG Image → Static

**Current:** `og:image = https://temptationtoken.io/wp-admin/admin-ajax.php?action=rank_math_overlay_thumb&id=98&type=gif&hash=...`

**Issue:** Dynamic admin-ajax image URLs can break, vary between deploys, and are not cacheable by social crawlers reliably.

**Fix:** Upload a static 1200×630px `og-image.png` to Media Library and set it as the OG image for the homepage in Rank Math.

---

## Rank Math Before/After Summary

| Field | Before | After |
|-------|--------|-------|
| Homepage title | "Revolutionizing Adult Entertainment & NFTs" | "Vote to Win Crypto Every Week on Base Blockchain" |
| Homepage meta desc | "win 40% of the prize pool" | "Top voter wins 35% of the prize pool" |
| og:site_name | "Adult Crypto Game on Base" | "Vote. Win. Earn Crypto Weekly on Base" |
| og:image:alt | "Payment Processor for Adult Content" | "Weekly Crypto Voting Game on Base Blockchain" |
| FAQ title | "Adult Games, NFTs & Crypto Payments" | "How Voting, Prizes & Staking Work" |
| FAQ description | "adult entertainment, NFTs, and gaming" | correct factual description |
| FAQ image:alt | "Polygon blockchain" | "Base Blockchain" |
| Copyright | 2024 (one instance) | 2026 |

---

## Price-Target / Promissory Language Flag

The following strings were NOT found in the scraped pages. No promissory price-target language requiring human review was detected:
- "will reach", "guaranteed", "target price", "moon", "100x"

If such language exists in older blog posts not scraped in this pass, those should be reviewed manually.

---

## Apply Order

1. Fix 1 + 2 + 3 + 4 first (homepage OG) — these are what social crawlers and MetaMask/Blockaid see
2. Fix 5 + 6 (FAQ page) — next priority for SEO
3. Fix 7 + 8 (image alts + app store images) — lower urgency
4. Fix 9 (copyright) — housekeeping
5. Fix 10 (Telegram links) — user experience
6. Fix 11 (static OG image) — nice to have
