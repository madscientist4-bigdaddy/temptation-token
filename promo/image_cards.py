#!/usr/bin/env python3
"""
image_cards.py — branded PNG leaderboard card to attach to a post.

    python3 promo/image_cards.py                          # uses promo/standings.json
    python3 promo/image_cards.py --standings my.json --out card.png
    python3 promo/image_cards.py --size square            # 1080x1080 for IG

TEMPLATE ONLY. It renders the TTS logo, the top 10 by name/handle, and the date.

It will NOT put a photo of a creator on a card unless you explicitly pass BOTH
--photo <path> AND --photo-consent, and even then it only accepts a local file you
supplied. No scraping, no pulling images from profiles. Putting someone's face on
promotional material without a licence and their consent is a real legal problem
(right of publicity), and this is an adult-adjacent context where it matters more,
not less — so the tool makes the consent step deliberate rather than default.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent

BG = (12, 12, 20)
CARD = (20, 20, 31)
GOLD = (212, 175, 55)
GOLD_LIGHT = (240, 208, 96)
TEXT = (245, 245, 245)
MUTED = (154, 154, 168)
LINE = (44, 40, 30)

SIZES = {"post": (1200, 1500), "square": (1080, 1080), "wide": (1600, 900)}


def font(size: int, bold: bool = False):
    """Best-effort system fonts; Pillow's default is a poor last resort but never crashes."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except Exception:  # noqa: BLE001
            continue
    return ImageFont.load_default()


def load_logo(px: int) -> Image.Image | None:
    for p in (REPO / "public" / "tts_logo.webp", REPO / "public" / "favicon.svg"):
        if p.exists() and p.suffix != ".svg":
            try:
                im = Image.open(p).convert("RGBA")
                im.thumbnail((px, px), Image.LANCZOS)
                return im
            except Exception:  # noqa: BLE001
                pass
    return None


def render(standings: list[dict], round_label: str, size: str, out: Path,
           photo: Path | None = None) -> Path:
    W, H = SIZES[size]
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    pad = int(W * 0.055)
    y = pad

    logo = load_logo(int(W * 0.11))
    if logo:
        img.paste(logo, (pad, y), logo)
        tx = pad + logo.width + int(W * 0.025)
    else:
        tx = pad

    d.text((tx, y + int(W * 0.008)), "TEMPTATION TOKEN", font=font(int(W * 0.038), True), fill=GOLD)
    d.text((tx, y + int(W * 0.055)), f"Leaderboard · Round {round_label}",
           font=font(int(W * 0.024)), fill=MUTED)
    y += int(W * 0.135)

    d.line([(pad, y), (W - pad, y)], fill=LINE, width=2)
    y += int(W * 0.03)

    rows = standings[:10]
    if not rows:
        d.text((pad, y), "No standings available", font=font(int(W * 0.03)), fill=MUTED)
    row_h = int((H - y - pad * 2.2) / max(len(rows), 1))
    row_h = min(row_h, int(W * 0.085))

    f_rank = font(int(W * 0.036), True)
    f_name = font(int(W * 0.032), True)
    f_handle = font(int(W * 0.022))

    for i, r in enumerate(rows):
        ry = y + i * row_h
        if i % 2 == 0:
            d.rounded_rectangle([pad - 8, ry - 6, W - pad + 8, ry + row_h - 14],
                                radius=10, fill=CARD)
        rank = str(r.get("rank", i + 1))
        rank_col = GOLD_LIGHT if i == 0 else GOLD if i < 3 else MUTED
        d.text((pad + 4, ry), f"#{rank}", font=f_rank, fill=rank_col)
        name = str(r.get("name", "—"))[:26]
        d.text((pad + int(W * 0.085), ry - 2), name, font=f_name, fill=TEXT)
        handle = str(r.get("handle") or "")
        if handle:
            d.text((pad + int(W * 0.085), ry + int(W * 0.033)), handle, font=f_handle, fill=MUTED)
        votes = r.get("votes")
        if votes is not None:
            vt = f"{float(votes):,.0f} votes"
            bbox = d.textbbox((0, 0), vt, font=f_handle)
            d.text((W - pad - (bbox[2] - bbox[0]), ry + int(W * 0.012)), vt,
                   font=f_handle, fill=MUTED)

    # Optional, consent-gated creator photo — small, cornered, never the focal point.
    if photo and photo.exists():
        try:
            ph = Image.open(photo).convert("RGB")
            side = int(W * 0.16)
            ph.thumbnail((side, side), Image.LANCZOS)
            img.paste(ph, (W - pad - ph.width, H - pad - ph.height - int(W * 0.05)))
        except Exception as e:  # noqa: BLE001
            print(f"  ! could not place photo: {e}", file=sys.stderr)

    foot = font(int(W * 0.019))
    d.text((pad, H - pad - int(W * 0.045)), date.today().strftime("%B %-d, %Y"),
           font=foot, fill=MUTED)
    d.text((pad, H - pad - int(W * 0.02)), "app.temptationtoken.io  ·  #ad",
           font=foot, fill=MUTED)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Render a branded leaderboard PNG.")
    ap.add_argument("--standings", default=str(ROOT / "standings.json"))
    ap.add_argument("--out", default="")
    ap.add_argument("--size", choices=list(SIZES), default="post")
    ap.add_argument("--photo", default="", help="Local path to a licensed, consented image")
    ap.add_argument("--photo-consent", action="store_true",
                    help="Required with --photo: you confirm you hold a licence AND consent")
    a = ap.parse_args()

    sp = Path(a.standings)
    if not sp.exists():
        print(f"✗ standings not found: {sp}", file=sys.stderr)
        return 2
    raw = json.loads(sp.read_text(encoding="utf-8"))
    standings = raw.get("standings") or raw.get("leaderboard") or []
    round_label = str(raw.get("round", "current"))

    photo = None
    if a.photo:
        if not a.photo_consent:
            print("✗ --photo requires --photo-consent.\n"
                  "  Only pass a photo you have a licence for AND the creator's consent to use\n"
                  "  in promotional material. This tool will not source images itself.",
                  file=sys.stderr)
            return 2
        photo = Path(a.photo)
        if not photo.exists():
            print(f"✗ photo not found: {photo}", file=sys.stderr)
            return 2

    out = Path(a.out) if a.out else ROOT / "out" / f"leaderboard_{date.today().isoformat()}_{a.size}.png"
    p = render(standings, round_label, a.size, out, photo)
    print(f"\n✓ card → {p}  ({SIZES[a.size][0]}x{SIZES[a.size][1]})")
    if not photo:
        print("  Template only — no creator photos included.")
    print("  Attach to a post; #ad is rendered on the card, keep it in the caption too.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
