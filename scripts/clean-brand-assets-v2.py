"""Clean original brand assets carefully (no generative rewrite)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(r"C:\Users\Usuário\OneDrive\BORDERLESS\536-Marcio")
BACKUP = ROOT / "artifacts" / "qa" / "brand-backup"
PUBLIC = ROOT / "public" / "brand"
HOSTING = ROOT / "hosting-static" / "brand"


def save_both(img: Image.Image, name: str) -> None:
    for base in (PUBLIC, HOSTING):
        path = base / name
        img.save(path, optimize=True)
        print("saved", path, img.size)


def clean_logo(src: Path) -> Image.Image:
    arr = np.array(Image.open(src).convert("RGBA"), dtype=np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = max_c - min_c
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b

    # Brand content: saturated magenta/cyan gradients
    content = (a > 20) & (sat >= 40) & (
        ((r > g + 15) & (r > 70))  # magenta side
        | ((b > r + 8) & (g > 70))  # cyan side
        | ((g > 90) & (b > 90) & (sat >= 35))
    )

    # Explicit white/light outline stroke
    outline = (a > 20) & (lum >= 175) & (sat <= 50)

    # Also light gray fringe often left by cutouts
    fringe = (a > 20) & (lum >= 140) & (sat <= 28) & (~content)

    keep = content | ((a > 20) & (~outline) & (~fringe) & (sat >= 25))
    out = arr.copy()
    out[~keep, 3] = 0

    # Where we keep content but alpha is mixed with white fringe, boost toward content color
    # by discarding near-white contribution in RGB for edge pixels
    edge_white = keep & (lum > 160) & (sat < 70)
    # pull RGB away from white: blend toward more saturated estimate
    scale = np.clip((sat + 1) / (lum + 1) * 2.2, 0.55, 1.0)
    for i in range(3):
        ch = out[:, :, i]
        ch[edge_white] = np.clip(ch[edge_white] * scale[edge_white], 0, 255)
        out[:, :, i] = ch

    img = Image.fromarray(out.astype(np.uint8), "RGBA")
    # slight median on alpha to smooth jagged holes
    rgb = img.convert("RGB")
    alpha = img.split()[-1].filter(ImageFilter.MedianFilter(size=3))
    img = Image.merge("RGBA", (*rgb.split(), alpha))
    # restore full transparent where alpha very low
    arr2 = np.array(img)
    arr2[arr2[:, :, 3] < 12, 3] = 0
    return Image.fromarray(arr2, "RGBA")


def clean_mascot(src: Path) -> Image.Image:
    arr = np.array(Image.open(src).convert("RGBA"), dtype=np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    # True green-screen leftovers: strong green dominance
    green_dom = g - np.maximum(r, b)
    hard_bg = (a > 0) & (green_dom >= 35) & (g >= 80) & (r < 120) & (b < 130)
    # Soft mint halo around silhouette
    soft_bg = (a > 0) & (green_dom >= 18) & (g >= 70) & (r < 140)

    # Only remove if also relatively bright or edge-like (not dark armor)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    remove = hard_bg | (soft_bg & (lum >= 55) & (green_dom >= 22))
    arr[remove, 3] = 0

    # Despill: for remaining pixels with green cast, pull G down
    keep = arr[:, :, 3] > 0
    spill = keep & (green_dom > 4)
    target = np.maximum(arr[:, :, 0], arr[:, :, 2])
    # stronger under chin / bright spill
    strong = spill & (green_dom > 12)
    mild = spill & ~strong
    g2 = arr[:, :, 1].copy()
    g2[strong] = np.minimum(g2[strong], target[strong] + 4)
    g2[mild] = g2[mild] * 0.82 + target[mild] * 0.18
    arr[:, :, 1] = g2

    # Clear near-empty
    arr[arr[:, :, 3] < 10, 3] = 0
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def make_avatar(mascot: Image.Image) -> Image.Image:
    # Focus upper body
    w, h = mascot.size
    # Crop a square around the head/torso
    side = int(min(w, h) * 0.78)
    left = max(0, (w - side) // 2)
    top = max(0, int(h * 0.02))
    if top + side > h:
        top = h - side
    crop = mascot.crop((left, top, left + side, top + side)).resize((320, 320), Image.Resampling.LANCZOS)
    av = np.array(crop.convert("RGBA"))
    yy, xx = np.ogrid[:320, :320]
    mask = (xx - 160) ** 2 + (yy - 160) ** 2 <= 158**2
    av[~mask, 3] = 0
    return Image.fromarray(av, "RGBA")


def main() -> None:
    logo = clean_logo(BACKUP / "logo-transparent-v2.png")
    save_both(logo, "logo-transparent-v2.png")
    save_both(logo, "logo-transparent.png")

    mascot = clean_mascot(BACKUP / "mascote.png")
    save_both(mascot, "mascote.png")

    avatar_src = BACKUP / "mascote-avatar-circular.png"
    if avatar_src.exists():
        avatar = clean_mascot(avatar_src)
        # If avatar has circular black plate, keep circular mask from alpha
        save_both(avatar, "mascote-avatar-circular.png")
    else:
        save_both(make_avatar(mascot), "mascote-avatar-circular.png")

    # previews
    out = ROOT / "artifacts" / "qa" / "brand-backup"
    for name, bg in [("logo", (217, 224, 230)), ("mascot", (255, 255, 255))]:
        src = PUBLIC / ("logo-transparent-v2.png" if name == "logo" else "mascote.png")
        im = Image.open(src).convert("RGBA")
        canvas = Image.new("RGBA", im.size, bg + (255,))
        canvas.alpha_composite(im)
        canvas.convert("RGB").save(out / f"preview-clean-{name}.jpg", quality=92)
        print("preview", name)


if __name__ == "__main__":
    main()
