# TTS Logo Export Instructions — Exchange Submissions

Exchanges require a specific logo format. Follow exactly.

---

## Required Specs (most exchanges)

| Spec | Value |
|------|-------|
| Size | 256×256 px (minimum) — some require 300×300 |
| Format | PNG with transparent background |
| Background | Transparent (NOT white, NOT black) |
| Color space | sRGB |
| File name | `tts_logo_256.png` |

---

## Option A — Export from Existing Coin Image (Fastest)

The TTS coin image is already uploaded to WordPress:

```
https://temptationtoken.io/wp-content/uploads/2024/06/Copy-of-Temptation-Token-Coin-1024x1024.webp
```

Steps:
1. Download the image (right-click → Save as)
2. Open in any image editor (Photoshop, GIMP, Canva, or even Preview on Mac)
3. Resize canvas to 256×256 px
4. Export as PNG with **transparent background** (the coin image background must be removed)
5. Verify: the area outside the coin should be transparent (checkerboard pattern), not white

**Quick option — Canva:**
1. Go to canva.com → Create design → Custom size → 256×256 px
2. Upload the coin image → remove background (Background Remover tool)
3. Download → PNG → check "Transparent background"

**Quick option — remove.bg:**
1. Go to remove.bg
2. Upload the coin image → it auto-removes the background
3. Download the result
4. Resize to 256×256 in Preview or any editor

---

## Option B — Use the Favicon Source

If the site has a favicon.ico, it can be upscaled:
- WordPress media library → search "TTS logo" or "favicon"
- Download the highest-res version available
- Scale up to 256×256 (PNG only, no JPEG)

---

## Exchange-Specific Requirements

| Exchange | Size | Notes |
|----------|------|-------|
| CoinGecko | 200×200 | PNG, transparent preferred |
| CoinMarketCap | 200×200 | PNG or GIF, transparent or white BG |
| Gate.io | 256×256 | PNG, transparent |
| MEXC | 300×300 | PNG or JPG, white or transparent BG |
| DexScreener | Any square | Auto-cropped; use 256×256 |

For submissions requiring white background: Export at 256×256, then add a white `#FFFFFF` background layer behind the coin. Save as a separate file (`tts_logo_256_white.png`).

---

## Final Check Before Submitting

- [ ] File is square (1:1 ratio)
- [ ] Minimum 200×200 px
- [ ] PNG format
- [ ] Background is transparent OR white (not any other color)
- [ ] The TTS coin logo is clearly visible and centered
- [ ] File size under 1 MB (should be ~20–80 KB for a 256×256 PNG)
