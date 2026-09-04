"""Inspect and finalize generated brand assets into public/hosting paths."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(r"C:\Users\Usuário\OneDrive\BORDERLESS\536-Marcio")
ASSETS = Path(r"C:\Users\Usuário\.cursor\projects\c-Users-Usu-rio-OneDrive-BORDERLESS-536-Marcio\assets")
PUBLIC = ROOT / "public" / "brand"
HOSTING = ROOT / "hosting-static" / "brand"


def make_transparent_from_flat_bg(img: Image.Image, mode: str = "auto") -> Image.Image:
    arr = np.array(img.convert("RGBA"), dtype=np.int16)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    h, w = r.shape

    # Sample corners to guess background
    corners = np.array(
        [
            arr[2, 2, :3],
            arr[2, w - 3, :3],
            arr[h - 3, 2, :3],
            arr[h - 3, w - 3, :3],
        ]
    )
    bg = corners.mean(axis=0)
    print("corner bg approx", bg.tolist())

    # Distance from background color
    dist = np.sqrt(
        (r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2
    )

    if mode == "logo":
        # Near-black or near-white flat canvas -> transparent
        near_bg = dist < 28
        # Also kill leftover white stroke separately
        max_c = np.maximum(np.maximum(r, g), b)
        min_c = np.minimum(np.minimum(r, g), b)
        sat = max_c - min_c
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        white_stroke = (lum > 185) & (sat < 45)
        remove = near_bg | white_stroke
    else:
        # Mascot: remove black / dark gray flat bg and any green leftovers
        near_bg = dist < 35
        green_score = g - np.maximum(r, b)
        green = (green_score > 22) & (g > 60)
        remove = near_bg | green

    out = arr.copy()
    out[remove, 3] = 0
    # Soften: if pixel is very dark and low alpha neighbors, clear
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def trim_transparent(img: Image.Image, pad: int = 8) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(img.width, r + pad)
    b = min(img.height, b + pad)
    return img.crop((l, t, r, b))


def save_everywhere(img: Image.Image, names: list[str]) -> None:
    for name in names:
        for base in (PUBLIC, HOSTING):
            path = base / name
            img.save(path, optimize=True)
            print("saved", path)


def main() -> None:
    logo_raw = Image.open(ASSETS / "logo-cotacondo-no-outline.png")
    logo = make_transparent_from_flat_bg(logo_raw, mode="logo")
    logo = trim_transparent(logo, pad=12)
    # Normalize width roughly like original ~320x104 aspect
    target_w = 640
    ratio = target_w / logo.width
    logo = logo.resize((target_w, max(1, int(logo.height * ratio))), Image.Resampling.LANCZOS)
    save_everywhere(logo, ["logo-transparent-v2.png", "logo-transparent.png"])

    mascot_raw = Image.open(ASSETS / "mascote-cotacondo-no-green.png")
    mascot = make_transparent_from_flat_bg(mascot_raw, mode="mascot")
    mascot = trim_transparent(mascot, pad=10)
    # Keep decent resolution
    if mascot.width > 900:
        ratio = 900 / mascot.width
        mascot = mascot.resize((900, max(1, int(mascot.height * ratio))), Image.Resampling.LANCZOS)
    save_everywhere(mascot, ["mascote.png"])

    # Avatar: circular crop of upper body if possible, else scaled square
    side = min(mascot.size)
    left = (mascot.width - side) // 2
    top = max(0, int(mascot.height * 0.02))
    if top + side > mascot.height:
        top = mascot.height - side
    avatar = mascot.crop((left, top, left + side, top + side)).resize((320, 320), Image.Resampling.LANCZOS)
    # Circular alpha mask
    av = np.array(avatar.convert("RGBA"))
    yy, xx = np.ogrid[:320, :320]
    mask = (xx - 160) ** 2 + (yy - 160) ** 2 <= 158**2
    av[~mask, 3] = 0
    avatar_img = Image.fromarray(av, "RGBA")
    save_everywhere(avatar_img, ["mascote-avatar-circular.png"])


if __name__ == "__main__":
    main()
