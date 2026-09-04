"""Install best clean logo + lightly despill original mascot."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(r"C:\Users\Usuário\OneDrive\BORDERLESS\536-Marcio")
ASSETS = Path(r"C:\Users\Usuário\.cursor\projects\c-Users-Usu-rio-OneDrive-BORDERLESS-536-Marcio\assets")
BACKUP = ROOT / "artifacts" / "qa" / "brand-backup"
PUBLIC = ROOT / "public" / "brand"
HOSTING = ROOT / "hosting-static" / "brand"


def save_both(img: Image.Image, name: str) -> None:
    for base in (PUBLIC, HOSTING):
        path = base / name
        img.save(path, optimize=True)
        print("saved", path, img.size)


def logo_from_ai() -> Image.Image:
    raw = Image.open(ASSETS / "logo-cotacondo-no-outline.png").convert("RGBA")
    arr = np.array(raw, dtype=np.float32)
    r, g, b, a = [arr[:, :, i] for i in range(4)]
    # Generated canvas is near-white; punch to transparent
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = max_c - min_c
    # Keep saturated brand pixels; drop flat light canvas + residual pale halo
    keep = (sat >= 28) & (lum < 245) & ~((lum > 200) & (sat < 35))
    arr[~keep, 3] = 0
    # Also force alpha 0 on near-white
    arr[(lum > 235) & (sat < 20), 3] = 0
    img = Image.fromarray(arr.astype(np.uint8), "RGBA")
    bbox = img.getbbox()
    if bbox:
        pad = 10
        l, t, r0, b0 = bbox
        img = img.crop((max(0, l - pad), max(0, t - pad), min(img.width, r0 + pad), min(img.height, b0 + pad)))
    # Normalize size
    target_w = 640
    ratio = target_w / img.width
    img = img.resize((target_w, max(1, int(img.height * ratio))), Image.Resampling.LANCZOS)
    return img


def mascot_despill() -> Image.Image:
    arr = np.array(Image.open(BACKUP / "mascote.png").convert("RGBA"), dtype=np.float32)
    r, g, b, a = [arr[:, :, i] for i in range(4)]
    green_dom = g - np.maximum(r, b)
    # Only remove obvious green-screen blobs (not dark armor)
    hard = (a > 0) & (green_dom >= 40) & (g >= 95) & (r < 110) & (b < 120)
    arr[hard, 3] = 0
    # Despill reflections on metal / chin
    keep = arr[:, :, 3] > 0
    spill = keep & (green_dom > 6)
    target = np.maximum(arr[:, :, 0], arr[:, :, 2])
    g2 = arr[:, :, 1].copy()
    amount = np.clip((green_dom - 6) / 40.0, 0, 0.85)
    g2[spill] = g2[spill] * (1 - amount[spill]) + np.minimum(g2[spill], target[spill] + 6) * amount[spill]
    arr[:, :, 1] = g2
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def avatar_despill() -> Image.Image:
    arr = np.array(Image.open(BACKUP / "mascote-avatar-circular.png").convert("RGBA"), dtype=np.float32)
    r, g, b, a = [arr[:, :, i] for i in range(4)]
    green_dom = g - np.maximum(r, b)
    # Avatar often has solid circular plate — keep dark circle, only despill green
    keep = a > 0
    spill = keep & (green_dom > 6)
    target = np.maximum(r, b)
    amount = np.clip((green_dom - 6) / 40.0, 0, 0.85)
    g2 = g.copy()
    g2[spill] = g2[spill] * (1 - amount[spill]) + np.minimum(g2[spill], target[spill] + 6) * amount[spill]
    arr[:, :, 1] = g2
    # Remove pure green exterior if any outside the black circle
    hard = (a > 0) & (green_dom >= 40) & (g >= 95) & (r < 110)
    arr[hard, 3] = 0
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def preview(img: Image.Image, bg: tuple[int, int, int], path: Path) -> None:
    canvas = Image.new("RGBA", img.size, bg + (255,))
    canvas.alpha_composite(img)
    canvas.convert("RGB").save(path, quality=92)


def main() -> None:
    logo = logo_from_ai()
    save_both(logo, "logo-transparent-v2.png")
    save_both(logo, "logo-transparent.png")

    mascot = mascot_despill()
    save_both(mascot, "mascote.png")

    avatar = avatar_despill()
    save_both(avatar, "mascote-avatar-circular.png")

    out = BACKUP
    preview(logo, (217, 224, 230), out / "preview-final-logo.jpg")
    preview(mascot, (255, 255, 255), out / "preview-final-mascot.jpg")
    print("done")


if __name__ == "__main__":
    main()
