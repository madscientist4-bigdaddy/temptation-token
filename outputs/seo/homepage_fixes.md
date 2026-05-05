# Homepage Text Fixes — temptationtoken.io (WordPress)
*Apply via Elementor editor on the homepage. Check each item.*
*Last audit: May 2026*

---

## 1. Prize Split References — 40% → 35%

Search the homepage in Elementor for any of these and update:

| Find (OLD) | Replace With (NEW) |
|------------|-------------------|
| "40% of the prize pool" | "35% of the prize pool" |
| "top voter wins 40%" | "top voter wins 35%" |
| "40% to top voter" | "35% to top voter" |
| "40/40/10/10" | "35/35/10/20" |
| "40/40" | "35/35" |

**Canonical prize language to use:**
> Prize distribution: 35% to the top voter, 35% to the winning profile, 10% to Polaris Project charity, and 20% to Blockchain Entertainment LLC.

---

## 2. Audit Status

| Find (OLD) | Replace With (NEW) |
|------------|-------------------|
| "Audit pending" | "Audited by Solidproof ✓" |
| "Audit expected" | "Audited by Solidproof ✓" |
| "Coming soon — audit" | "Audited by Solidproof ✓" |
| "temptationtoken.io/audit" | "app.solidproof.io/projects/temptation-token" |
| Any reference to audit as future tense | Present tense: "Audited by Solidproof — zero critical findings" |

**Add this sentence wherever you mention security:**
> Zero critical findings. Zero high findings. TrustNet score 17.92.

---

## 3. Copyright Year

| Find | Replace With |
|------|-------------|
| "© 2024" | "© 2026" |
| "© 2025" | "© 2026" |
| "Copyright 2024" | "Copyright 2026" |

---

## 4. App Store Button References

Remove any of the following completely from the homepage:
- "Download on the App Store" button or badge
- "Get it on Google Play" button or badge
- Apple App Store link
- Google Play Store link
- "Coming soon to iOS / Android"

The game is web-only at app.temptationtoken.io. There is no mobile app.

---

## 5. Blockchain References

| Find (OLD) | Replace With (NEW) |
|------------|-------------------|
| "on Polygon" | "on Base" |
| "on Ethereum" | "on Base" |
| "Polygon blockchain" | "Base blockchain" |
| "MATIC" | remove or replace with "ETH (Base)" |
| Chain ID 137 | Chain ID 8453 |

---

## 6. Meta Title Update
*In WordPress → Rank Math → Homepage settings (not Elementor)*

| Field | Old Value | New Value |
|-------|-----------|-----------|
| SEO Title | (whatever is there) | `Temptation Token — Vote. Win. Earn $TTS on Base` |

---

## 7. Meta Description Update
*In Rank Math on homepage*

```
The first vote-to-earn crypto game on Base blockchain. Vote $TTS on weekly profiles — top voter wins 35% of the prize pool. Audited by Solidproof. LP locked. Chainlink VRF.
```

---

## 8. OG Description Update
*In Rank Math → Social → Facebook (OG) on homepage*

```
The first vote-to-earn crypto game on Base blockchain. Vote $TTS on weekly profiles — top voter wins 35% of the prize pool. Audited by Solidproof. Chainlink VRF. LP locked 12 months.
```

---

## 9. Staking Tier References

If the homepage mentions staking tiers, check against canonical:

| Tier | Min USD | APR | Vote Boost |
|------|---------|-----|-----------|
| Bronze | $50 | 8% | 1.1x |
| Silver | $100 | 12% | 1.25x |
| Gold | $250 | 18% | 1.5x |
| Diamond | $1,000 | 32% | 2x |
| VIP | $5,000 | 45% | 3x |

Remove: "Platinum" tier (does not exist)
Remove: Any APR higher than 45%
Remove: Any vote multiplier higher than 3x

---

## 10. Round Schedule References

| Find (OLD) | Replace With (NEW) |
|------------|-------------------|
| "Friday to Friday" | "Monday 12:00 AM EDT to Sunday 11:59 PM EDT" |
| "weekly rounds on Friday" | "weekly rounds start Monday 12:00 AM EDT" |
| Any UTC display of round times | EDT equivalent |

---

## How to Find Text in Elementor

1. Open homepage in Elementor editor
2. Use Ctrl+F (Windows) or Cmd+F (Mac) — Elementor has a Find & Replace if you have Pro
3. If no Find & Replace: use the Navigator panel (left) to click through sections
4. Alternatively: go to Pages → Edit (Classic) → check the raw text in the Text tab

**No Find & Replace in Elementor Free?** Check each section manually using the Navigator. Elementor Free does not include global Find & Replace — upgrade to Pro or check each widget individually.
