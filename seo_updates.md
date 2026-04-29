# Temptation Token — SEO Overhaul (WordPress)

## 1. Homepage Meta Tags

```html
<title>Temptation Token ($TTS) — The Hot or Not Voting Game on Base</title>
<meta name="description" content="Vote on photos, earn $TTS rewards, and stake for yield on Base blockchain. Temptation Token is the Web3 Hot or Not game where your vote has real value." />
<meta name="keywords" content="Temptation Token, TTS token, Web3 voting game, Base blockchain, crypto hot or not, vote to earn, stake to earn, Base mainnet NFT" />
<link rel="canonical" href="https://temptationtoken.io/" />

<!-- Open Graph -->
<meta property="og:title" content="Temptation Token — Vote, Earn, Win on Base" />
<meta property="og:description" content="The first vote-to-earn game on Base. Spend $TTS to vote for your favourite profiles. Winners get NFT trophies. Stakers earn yield." />
<meta property="og:image" content="https://temptationtoken.io/og-image.jpg" />
<meta property="og:url" content="https://temptationtoken.io/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Temptation Token" />

<!-- Twitter/X Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@TemptationToken" />
<meta name="twitter:title" content="Temptation Token — The Hot or Not Game on Base" />
<meta name="twitter:description" content="Vote on profiles using $TTS tokens. Win weekly NFT trophies. Stake for yield. Live on Base blockchain." />
<meta name="twitter:image" content="https://temptationtoken.io/og-image.jpg" />
```

---

## 2. JSON-LD Schema Markup

### WebApplication schema (add to `<head>` of homepage)

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Temptation Token",
  "url": "https://app.temptationtoken.io",
  "description": "A Web3 Hot or Not voting game on Base blockchain. Users vote for photo profiles by spending $TTS tokens. Weekly winners receive NFT trophies. Stakers earn yield.",
  "applicationCategory": "Game",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free to play — requires $TTS token to vote"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Temptation Token",
    "url": "https://temptationtoken.io",
    "sameAs": [
      "https://t.me/temptationtoken",
      "https://twitter.com/TemptationToken"
    ]
  }
}
</script>
```

### Token/CryptoCurrency schema

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Thing",
  "name": "Temptation Token",
  "alternateName": "$TTS",
  "description": "ERC-20 utility token on Base mainnet. Used to vote in the Temptation Token hot-or-not game. Contract: 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9",
  "url": "https://temptationtoken.io",
  "identifier": "0x5570eA97d53A53170e973894A9Fa7feb5785d3b9"
}
</script>
```

---

## 3. Copy Corrections (WordPress Pages)

### Hero Section
**Before (generic):** "The revolutionary crypto game"
**After:** "The Web3 Hot or Not Voting Game on Base — Vote with $TTS, Win NFT Trophies, Earn Yield"

### Sub-headline
**Before:** "Join our community"
**After:** "Spend $TTS tokens to vote for your favourite profiles. Every vote is on-chain. Winners walk away with exclusive NFTs and the prize pool."

### CTA Button
**Before:** "Play Now" / "Launch App"
**After:** "Play Free on Base →" (links to app.temptationtoken.io)

### About Section Header
**Before:** "About Temptation Token"
**After:** "What Is Temptation Token? The First Vote-to-Earn Game on Base"

### About Body
Replace with: "Temptation Token ($TTS) is a provably fair, on-chain Hot or Not voting game deployed on Base mainnet. Every week a new round opens — players spend $TTS tokens to cast votes for photo profiles. The profile with the most votes wins the prize pool. Top voters earn a share too. All results are settled by Chainlink VRF — verifiable, tamper-proof, and on-chain forever."

### Tokenomics Section Header
**Before:** "Tokenomics"
**After:** "$TTS Token — How It Works"

---

## 4. Rank Math / Yoast Settings

### Homepage
- **Focus keyword:** `Web3 voting game Base blockchain`
- **Secondary keywords:** `TTS token, vote to earn crypto, hot or not NFT game, Base mainnet game`
- **SEO Title:** `Temptation Token ($TTS) | Vote-to-Earn Game on Base | Win NFT Trophies`
- **Meta description:** `Vote on photos with $TTS tokens on Base blockchain. Win weekly NFT trophies, earn staking yield, and collect rewards in the original Web3 Hot or Not game.`

### /about Page
- **Focus keyword:** `Temptation Token TTS token`
- **SEO Title:** `About Temptation Token — $TTS Token on Base Blockchain`
- **Meta description:** `Learn how Temptation Token works — a provably fair voting game on Base using Chainlink VRF. Stake $TTS for yield. Win NFT trophies.`

### /how-to-play Page
- **Focus keyword:** `how to play Temptation Token`
- **SEO Title:** `How to Play Temptation Token — Vote, Earn & Win $TTS`
- **Meta description:** `Step-by-step guide: connect your wallet on Base, buy $TTS, vote for profiles, earn rewards, and win NFT trophies every week.`

### /staking Page
- **Focus keyword:** `TTS staking yield Base`
- **SEO Title:** `Stake $TTS — Earn Passive Yield on Base | Temptation Token`
- **Meta description:** `Stake your $TTS tokens to earn weekly yield from the prize pool. Flexible, on-chain staking on Base mainnet with no lockups.`

---

## 5. robots.txt

```
User-agent: *
Allow: /

# Block admin and internal API routes
Disallow: /wp-admin/
Disallow: /wp-login.php
Disallow: /api/

Sitemap: https://temptationtoken.io/sitemap.xml
```

---

## 6. Sitemap Priority Settings (via Rank Math)

| URL | Priority | Change Freq |
|-----|----------|-------------|
| / | 1.0 | weekly |
| /how-to-play | 0.9 | monthly |
| /staking | 0.8 | monthly |
| /about | 0.7 | monthly |
| /faq | 0.7 | monthly |
| /blog/* | 0.6 | weekly |

---

## 7. Blog Post Outlines (10 SEO-Targeted Articles)

### 1. "What Is Temptation Token? The Web3 Hot or Not Game Explained"
**Target keyword:** `what is Temptation Token`
**Outline:**
- What the game is (voting, $TTS, NFTs)
- How rounds work (weekly, Chainlink VRF)
- How to get started (wallet, buy $TTS, vote)
- Why it's different from other crypto games
- CTA: Play Now

### 2. "How to Buy $TTS Token on Base in 5 Minutes"
**Target keyword:** `how to buy TTS token`
**Outline:**
- What you need (Base wallet, ETH)
- Step 1: Get a wallet (MetaMask, Coinbase Wallet)
- Step 2: Bridge ETH to Base
- Step 3: Buy $TTS on Uniswap
- Step 4: Connect to app.temptationtoken.io
- CTA: Buy $TTS

### 3. "Vote-to-Earn Crypto Games in 2025 — What's Actually Worth Playing"
**Target keyword:** `vote to earn crypto 2025`
**Outline:**
- The rise of vote-to-earn
- Key criteria for a good game (on-chain, fair, rewarding)
- Temptation Token vs other games
- How the prize pool works
- CTA: Try It

### 4. "Chainlink VRF Explained — Why It Makes Temptation Token Provably Fair"
**Target keyword:** `Chainlink VRF game fairness`
**Outline:**
- What VRF is and why it matters
- How it's used in TTS rounds
- Why this beats custodial or centralized games
- Technical details (light, accessible)
- CTA: Verify on BaseScan

### 5. "Base Blockchain Games — The Best Play-to-Earn Projects on Base in 2025"
**Target keyword:** `Base blockchain games 2025`
**Outline:**
- Why Base is great for games (speed, cost, Coinbase ecosystem)
- Top games on Base
- Temptation Token spotlight
- How to get started on Base
- CTA: Play on Base

### 6. "What Are NFT Trophies? How Temptation Token Winners Are Immortalized On-Chain"
**Target keyword:** `NFT game trophies Base`
**Outline:**
- What an NFT trophy is in TTS context
- How winners are selected (VRF + prize pool)
- What the NFT looks like / metadata
- Why it has lasting value
- CTA: Win Your Trophy

### 7. "Staking $TTS — How to Earn Passive Income from the Temptation Token Prize Pool"
**Target keyword:** `TTS staking yield`
**Outline:**
- What staking is in TTS
- Staking tiers and multipliers
- How yield is calculated (share of prize pool)
- Risks and considerations
- CTA: Stake Now

### 8. "How to Submit Your Photo to Temptation Token — A Complete Guide"
**Target keyword:** `submit photo Temptation Token`
**Outline:**
- What submission means
- Requirements (SFW, format)
- The review process
- What happens if approved
- Rewards for winning profiles
- CTA: Submit

### 9. "Referral Programs in Web3 — How Temptation Token Pays You to Grow the Game"
**Target keyword:** `Web3 referral program crypto`
**Outline:**
- How the TTS referral program works
- Your referral link
- Bonuses for referring and being referred
- How to maximize referral income
- CTA: Get Your Link

### 10. "Is Temptation Token Safe? Security, Smart Contracts, and Audit Status"
**Target keyword:** `Temptation Token safe legit`
**Outline:**
- Smart contract transparency (BaseScan links)
- Chainlink VRF for fair settlement
- Gnosis Safe multisig for treasury
- Blockaid integration
- No rug risk (token fully distributed)
- CTA: Verify on BaseScan

---

## 8. Internal Linking Strategy

- Every blog post → links to `/how-to-play`, `/staking`, and `app.temptationtoken.io`
- Homepage → links to top 3 blog posts + `/faq`
- `/staking` ↔ `/how-to-play` cross-links
- Footer: `/about`, `/faq`, `/staking`, `/blog`, `app.temptationtoken.io`

---

## 9. Technical SEO Checklist

- [ ] Add `hreflang="en"` if launching non-English versions
- [ ] Compress all images to WebP — especially hero and OG image
- [ ] Lazy-load below-fold images
- [ ] Add `alt` text to every image including logo
- [ ] Enable Rank Math breadcrumbs on all inner pages
- [ ] Verify Google Search Console ownership (add HTML tag to `<head>`)
- [ ] Submit sitemap to Google Search Console
- [ ] Set up 301 redirect: `www.temptationtoken.io` → `temptationtoken.io`
- [ ] Add Google Analytics 4 or Plausible tag
- [ ] Page speed: aim for LCP < 2.5s on mobile (Core Web Vitals)
