# WordPress Admin Checklist — Jim To-Do
**Generated:** 2026-05-26
**Status:** ALL items require WP Admin login (plugin not yet installed)
**Priority order:** Items marked 🚨 are RELEASE-BLOCKING — do not share investor/press links until fixed

---

## HOW TO LOG IN
1. Go to: `https://temptationtoken.io/wp-admin`
2. Log in with Hostinger credentials (email: jgoetz@functionised.com)
3. Use the navigation paths below for each fix

---

## 🚨 ITEM 1 — Remove Price-Target / Promissory Language (RELEASE BLOCKER)

**WHY:** Regulatory risk — "price target" and "guaranteed" language can constitute an unregistered securities offer.

### Fix 1a: Remove "$0.10 price target" and "$1.00 price target"
- **Navigate to:** WP Admin → Pages → find Homepage (ID 52) → Edit with Elementor
- **Find:** Any text block containing `$0.10`, `$1.00`, `price target`, or `Price target`
- **Change to:** Remove the price targets entirely — replace with vague forward-looking language such as: *"TTS has ambitious long-term growth goals driven by community growth and token burn mechanics."*

### Fix 1b: Remove "Price rises" language
- **Navigate to:** Same Elementor page edit
- **Find:** Any text containing `Price rises` or `price rises`
- **Change to:** Remove or replace with: *"Token supply decreases with each round as losing votes burn to the dead address."*

### Fix 1c: Remove "guaranteed" baseline rewards claim
- **Navigate to:** Same Elementor page + any other pages it appears
- **Find:** Any text containing `guaranteed`
- **Change to:** Remove the word "guaranteed" — replace with *"designed to reward"* or *"participants can earn"*

---

## 🚨 ITEM 2 — Fix Homepage OG Title (CRITICAL: "Adult Entertainment & NFTs")

**WHY:** This string is indexed by Google and seen by MetaMask/Blockaid security scanners as adult content.

- **Navigate to:** WP Admin → Rank Math → Edit Snippet for Homepage (or: Edit Page → scroll to Rank Math meta box at bottom)
- **Find field:** SEO Title / OG Title
- **Current value:** `Temptation Token: Revolutionizing Adult Entertainment & NFTs`
- **Change to:** `Temptation Token ($TTS) — Vote to Win Crypto Every Week on Base Blockchain`
- **Also update:** Twitter Title (same field, different tab in Rank Math)

---

## 🚨 ITEM 3 — Fix Homepage OG Description (CRITICAL: "40% of the prize pool")

- **Navigate to:** Same Rank Math meta box on Homepage
- **Find field:** Meta Description / OG Description
- **Current value:** `...vote $TTS weekly and win 40% of the prize pool!`
- **Change to:** `The crypto-powered Hot-or-Not voting game on Base. Vote $TTS weekly. Top voter wins 35% of the prize pool. Losers' votes burn. Powered by Chainlink VRF.`

---

## 🚨 ITEM 4 — Fix OG Site Name (CRITICAL: "Adult Crypto Game on Base")

- **Navigate to:** WP Admin → Rank Math → Titles & Meta → Global Settings → Separator & Site Name
- **Current value:** `Adult Crypto Game on Base`
- **Change to:** `Temptation Token ($TTS) — Vote. Win. Earn Crypto Weekly on Base`

---

## 🚨 ITEM 5 — Fix Homepage OG Image Alt Text (CRITICAL: "Payment Processor for Adult Content")

- **Navigate to:** WP Admin → Media → find the homepage OG image (uploaded near launch 2024) → click Edit
- **Find field:** Alt Text
- **Current value:** `Secure and Anonymous Payment Processor for Adult Content with Temptation Token`
- **Change to:** `Temptation Token ($TTS) — Weekly Crypto Voting Game on Base Blockchain`

---

## 🚨 ITEM 6 — Fix FAQ Page Meta (CRITICAL: "adult entertainment", "Polygon blockchain")

- **Navigate to:** WP Admin → Pages → FAQ page → Edit → scroll to Rank Math meta box
- **OG Title current:** `FAQ | Everything About Temptation Token (TTS): Adult Games, NFTs & Crypto Payments`
- **OG Title change to:** `FAQ | Temptation Token ($TTS): How Voting, Prizes & Staking Work`
- **OG Description current:** `Find Faqs about Temptation Token (TTS), the revolutionary cryptocurrency for adult entertainment, NFTs, and gaming.`
- **OG Description change to:** `Everything you need to know about Temptation Token. Voting rules, prize splits (35/35/10/20), staking tiers, Chainlink VRF fairness, and how to buy $TTS on Base.`
- **OG Image Alt current:** `Temptation Token FAQ - Answers about adult games and NFTs on Polygon blockchain`
- **OG Image Alt change to:** `Temptation Token ($TTS) FAQ — Vote-to-Earn Game on Base Blockchain`

---

## 🚨 ITEM 7 — Fix FAQ Body Text (CRITICAL: "adult entertainment and NFT markets")

- **Navigate to:** WP Admin → Pages → FAQ page → Edit → open Elementor editor
- **Find:** The intro paragraph that begins `"...with the goal of transforming the adult entertainment and NFT markets..."`
- **Replace entire paragraph with:**
  > *Temptation Token ($TTS) is a vote-to-earn crypto game built on Base blockchain, launched June 2024. Players vote real TTS tokens on submitted profiles each week. The winning profile and top voter split 35% each of the prize pool, with 10% going to the Polaris Project (anti-trafficking nonprofit) and 20% to Blockchain Entertainment LLC. Losing votes burn to the dead address — making TTS deflationary with each round.*

---

## HIGH — ITEM 8 — Fix Homepage Image Alt Text ("adult entertainment" in img alt)

- **Navigate to:** WP Admin → Media → find blog-preview image on homepage
- **Find:** Alt text = `Temptation Token Blogs about cryptocurrency revolutionizing adult entertainment and NFT markets`
- **Change to:** `Temptation Token ($TTS) — Crypto voting game on Base blockchain`

---

## MEDIUM — ITEM 9 — Remove App Store Badge Images

- **WHY:** Google Play and Apple Store badge images imply a mobile app exists. No app exists. Text says "No download needed" but images contradict it.
- **Navigate to:** WP Admin → Pages → Homepage → Edit with Elementor
- **Find:** Two image widgets showing Google Play badge and Apple App Store badge
- **Action:** Delete both image widgets

---

## MEDIUM — ITEM 10 — Update Telegram Links in Footer

- **Navigate to:** WP Admin → Pages → any page with footer → Elementor → find footer section → find Telegram link(s)
- **Current href:** `t.me/temptationtoken` (broadcast-only channel, users can't post)
- **Change to:** `https://t.me/TTSCommunityChat` (community chat where users interact)
- **Note:** If there are two Telegram links, label the channel one "Announcements" and the community one "Join Community"

---

## LOW — ITEM 11 — Fix Stale Copyright Year

- **Navigate to:** WP Admin → Appearance → Theme Editor, OR find copyright widget in Elementor footer
- **Find:** `Copyright© 2024 Temptation Token I All Rights Reserved`
- **Change to:** `Copyright© 2026 Temptation Token | All Rights Reserved`

---

## LOW — ITEM 12 — Replace Dynamic OG Image with Static PNG

- **Navigate to:** WP Admin → Media → Add New → upload a 1200×630px PNG named `og-image.png`
- **Then:** Rank Math → Edit Snippet for Homepage → OG Image → select the newly uploaded PNG
- **Why:** Current `og:image` URL is a dynamic admin-ajax URL that can break or not render correctly in social previews

---

## AFTER ALL FIXES — Publish Trust and Audit Pages

Two pages return 404 but are needed for exchange listings (CoinGecko, GoPlus, etc.):
- `/trust` — currently 404
- `/audit` — currently 404

- **Navigate to:** WP Admin → Pages → New Page
- **Slug:** `trust` (for /trust), `audit` (for /audit)
- **Status:** Publish
- **Note:** If Hostinger .htaccess is blocking custom slugs, open a Hostinger support ticket requesting that `mod_rewrite` is enabled for the WordPress root directory

---

## Priority Summary

| # | Item | Priority | Blocker? |
|---|------|----------|----------|
| 1 | Remove price-target / "guaranteed" language | 🚨 CRITICAL | YES — legal risk |
| 2 | OG Title "Adult Entertainment & NFTs" | 🚨 CRITICAL | YES — Blockaid/Google indexed |
| 3 | OG Description "40%" | 🚨 CRITICAL | YES — wrong split shown |
| 4 | Site Name "Adult Crypto Game on Base" | 🚨 CRITICAL | YES — SEO + scanner |
| 5 | OG Image Alt "Payment Processor for Adult Content" | 🚨 CRITICAL | YES — security scanners |
| 6 | FAQ Meta "adult entertainment" + "Polygon" | 🚨 CRITICAL | YES — SEO + wrong chain |
| 7 | FAQ Body "adult entertainment and NFT markets" | 🚨 CRITICAL | YES — body content |
| 8 | Homepage img alt "adult entertainment" | HIGH | Recommended before press |
| 9 | Remove app store badges | MEDIUM | No |
| 10 | Telegram footer → community link | MEDIUM | No |
| 11 | Copyright 2024 → 2026 | LOW | No |
| 12 | Static OG image | LOW | No |
| — | Publish /trust and /audit pages | HIGH | Required for CoinGecko |

**Estimated time:** Items 1–7 can be done in ~30 minutes with WP admin access. Do these before sending any investor or press links.
