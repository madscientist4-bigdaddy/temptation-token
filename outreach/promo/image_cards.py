#!/usr/bin/env python3
"""
Branded leaderboard card (Pillow) to attach to a post.

TEMPLATE ONLY. It renders names, ranks and vote counts on the brand background — it
never composites a creator's photo unless you pass --photo pointing at an image you hold
a licence and a signed consent for. There is no photo-fetching code here on purpose: a
scraped headshot in a promotional graphic is a rights problem, and the safe default is
that the tool cannot do it even by accident.

    python3 promo/image_cards.py
    python3 promo/image_cards.py --photo /path/to/licensed.jpg --photo-consent-id AGR-2026-014
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tts_outreach import config  # noqa: E402

W, H = 1080, 1350           # 4:5, the largest IG feed slot
VOID, DEEP = (5, 5, 10), (12, 12, 20)
GOLD, GOLD_L, CREAM = (212, 175, 55), (240, 208, 96), (240, 232, 216)
MUTED, CRIMSON = (150, 145, 135), (192, 37, 58)

FONT_DIRS = ["/System/Library/Fonts/Supplemental", "/System/Library/Fonts", "/Library/Fonts"]


def font(names: list[str], size: int) -> ImageFont.FreeTypeFont:
    for d in FONT_DIRS:
        for n in names:
            p = Path(d) / n
            if p.exists():
                try:
                    return ImageFont.truetype(str(p), size)
                except Exception:
                    continue
    return ImageFont.load_default(size=size)


SERIF = ["Georgia.ttf", "Times New Roman.ttf", "Palatino.ttc"]
SANS = ["HelveticaNeue.ttc", "Helvetica.ttc", "Arial.ttf"]
SANS_B = ["Arial Bold.ttf", "HelveticaNeue.ttc", "Helvetica.ttc"]


def gradient(img: Image.Image) -> None:
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)],
               fill=(int(DEEP[0] + (VOID[0] - DEEP[0]) * t),
                     int(DEEP[1] + (VOID[1] - DEEP[1]) * t),
                     int(DEEP[2] + (VOID[2] - DEEP[2]) * t)))


def load_standings() -> dict:
    p = config.DATA_DIR / "standings.json"
    if p.exists():
        return json.loads(p.read_text())
    return {"round": "?", "closes": "Sunday 11:59 PM ET", "standings": []}


def render(s: dict, out: Path, photo: Path | None = None, consent_id: str = "") -> Path:
    img = Image.new("RGB", (W, H), VOID)
    gradient(img)
    d = ImageDraw.Draw(img)

    f_mark = font(SERIF, 62)
    f_title = font(SERIF, 78)
    f_eyebrow = font(SANS, 24)
    f_rank = font(SANS_B, 40)
    f_name = font(SANS, 40)
    f_votes = font(SANS_B, 34)
    f_foot = font(SANS, 24)

    d.rounded_rectangle([48, 44, 168, 152], radius=22, outline=GOLD, width=3)
    d.text((108, 98), "TT", font=f_mark, fill=GOLD_L, anchor="mm")

    d.text((W // 2, 210), "LIVE STANDINGS", font=f_eyebrow, fill=MUTED, anchor="mm")
    d.text((W // 2, 278), f"Round {s.get('round','?')}", font=f_title, fill=CREAM, anchor="mm")
    d.line([(W // 2 - 70, 330), (W // 2 + 70, 330)], fill=GOLD, width=2)

    rows = s.get("standings", [])[:10]
    y = 396
    for i, r in enumerate(rows, 1):
        top3 = i <= 3
        if top3:
            d.rounded_rectangle([56, y - 8, W - 56, y + 62], radius=12,
                                fill=(22, 20, 16), outline=(60, 50, 24))
        colour = [GOLD_L, (200, 200, 205), (205, 127, 50)][i - 1] if top3 else MUTED
        d.text((92, y + 27), f"{i}", font=f_rank, fill=colour, anchor="lm")
        name = (r.get("name", "—"))[:22]
        d.text((168, y + 27), name, font=f_name, fill=CREAM if top3 else (190, 185, 175), anchor="lm")
        if "votes" in r:
            d.text((W - 92, y + 27), f"{r['votes']:,}", font=f_votes,
                   fill=GOLD_L if top3 else MUTED, anchor="rm")
        y += 78
        if y > H - 250:
            break

    if not rows:
        d.text((W // 2, H // 2), "no standings yet", font=f_name, fill=MUTED, anchor="mm")

    # Licensed photo only, and only when a consent reference is supplied with it.
    if photo:
        if not consent_id:
            raise SystemExit(
                "--photo requires --photo-consent-id (the signed model-release reference). "
                "Refusing to composite an image without a consent record."
            )
        try:
            ph = Image.open(photo).convert("RGB")
            side = 190
            ph.thumbnail((side * 2, side * 2))
            ph = ph.crop((0, 0, min(ph.width, side), min(ph.height, side))).resize((side, side))
            img.paste(ph, (W - side - 56, 60))
            d.text((W - side - 56, 60 + side + 16), f"licensed · {consent_id}",
                   font=font(SANS, 18), fill=MUTED)
        except Exception as e:
            raise SystemExit(f"could not load --photo: {e}")

    d.line([(56, H - 132), (W - 56, H - 132)], fill=(40, 38, 46), width=1)
    d.text((56, H - 96), f"Voting closes {s.get('closes','Sunday 11:59 PM ET')}",
           font=f_foot, fill=MUTED)
    d.text((W - 56, H - 96), f"{date.today():%b %d, %Y}", font=f_foot, fill=MUTED, anchor="rt")
    d.text((56, H - 58), "temptationtoken.io  ·  #ad", font=f_foot, fill=GOLD)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--photo", type=Path, help="path to a LICENSED, consented image")
    ap.add_argument("--photo-consent-id", default="", help="signed model-release reference")
    ap.add_argument("--out", type=Path)
    a = ap.parse_args()

    s = load_standings()
    out = a.out or (config.ROOT / "cards" / f"leaderboard_{date.today()}.png")
    p = render(s, out, a.photo, a.photo_consent_id)
    print(f"\n  \033[32m✓\033[0m {p.relative_to(config.ROOT)}  ({p.stat().st_size // 1024} KB, {W}x{H})")
    if not a.photo:
        print("  \033[2mtemplate only — no creator photo (supply --photo + --photo-consent-id)\033[0m\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
