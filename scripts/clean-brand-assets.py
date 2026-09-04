"""Remove white outline from logo and green-screen spill from mascot."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "brand"
HOSTING = ROOT / "hosting-static" / "brand"


def clean_logo(src: Path, dests: list[Path]) -> None:
    img = Image.open(src).convert("RGBA")
    arr = np.array(img, dtype=np.int16)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    # Near-white / light-gray stroke baked into the PNG.
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    saturation = max_c - min_c
    luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b)

    white_stroke = (
        (a > 20)
        & (luminance >= 165)
        & (saturation <= 55)
        & (r >= 140)
        & (g >= 140)
        & (b >= 140)
    )

    # Soft fringe: slightly less bright but still desaturated outline.
    soft_stroke = (
        (a > 20)
        & (luminance >= 120)
        & (saturation <= 35)
        & (~((r > g + 40) | (b > r + 25)))  # keep magenta / cyan brand color
    )

    remove = white_stroke | soft_stroke
    arr[remove, 3] = 0

    # Shrink leftover halo: if almost transparent neighbors dominate, cut more.
    alpha = arr[:, :, 3].astype(np.float32)
    # One pass erode of low-sat bright edge
    for _ in range(2):
        pad = np.pad(alpha, 1, mode="edge")
        neigh = (
            pad[0:-2, 1:-1]
            + pad[2:, 1:-1]
            + pad[1:-1, 0:-2]
            + pad[1:-1, 2:]
        ) / 4.0
        edge = (alpha > 0) & (neigh < 40) & (saturation <= 60) & (luminance >= 100)
        alpha[edge] = 0
    arr[:, :, 3] = alpha.astype(np.uint8)

    out = Image.fromarray(arr.astype(np.uint8), "RGBA")
    for dest in dests:
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, optimize=True)
        print(f"logo cleaned -> {dest}")


def clean_mascot(src: Path, dests: list[Path]) -> None:
    img = Image.open(src).convert("RGBA")
    arr = np.array(img, dtype=np.int16)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    # Chroma-key green / mint backdrop + spill.
    green_score = g.astype(np.int16) - np.maximum(r, b).astype(np.int16)
    green_ratio = g.astype(np.float32) / np.maximum(r.astype(np.float32) + b.astype(np.float32) + 1, 1)

    hard_green = (a > 10) & (
        ((green_score >= 28) & (g >= 70))
        | ((g >= 90) & (green_ratio >= 1.15) & (green_score >= 18))
        | ((g >= 140) & (r <= 170) & (b <= 170) & (green_score >= 20))
    )

    # Soft green fringe (spill on edges of character)
    soft_green = (a > 10) & (green_score >= 12) & (g >= 55) & (green_ratio >= 1.05)

    remove = hard_green | soft_green
    arr[remove, 3] = 0

    # Despill remaining green cast on semi-transparent / edge pixels
    keep = arr[:, :, 3] > 0
    spill = keep & (green_score >= 6)
    # Pull green toward max(r,b)
    g2 = arr[:, :, 1].copy()
    target = np.maximum(arr[:, :, 0], arr[:, :, 2])
    g2[spill] = np.minimum(g2[spill], target[spill] + 8)
    arr[:, :, 1] = g2

    # Clear near-black fully transparent leftovers
    alpha = arr[:, :, 3]
    nearly_empty = (alpha < 18) | (
        (alpha < 60)
        & (arr[:, :, 0] < 25)
        & (arr[:, :, 1] < 25)
        & (arr[:, :, 2] < 25)
    )
    arr[nearly_empty, 3] = 0

    out = Image.fromarray(arr.astype(np.uint8), "RGBA")
    for dest in dests:
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, optimize=True)
        print(f"mascot cleaned -> {dest}")


def main() -> None:
    logo_src = PUBLIC / "logo-transparent-v2.png"
    clean_logo(
        logo_src,
        [
            PUBLIC / "logo-transparent-v2.png",
            PUBLIC / "logo-transparent.png",
            HOSTING / "logo-transparent-v2.png",
            HOSTING / "logo-transparent.png",
        ],
    )

    # Also produce a non-black logo.png without outline for favicons if needed.
    # Keep original logo.png path updated from cleaned transparent composited? skip.

    mascot_src = PUBLIC / "mascote.png"
    clean_mascot(
        mascot_src,
        [
            PUBLIC / "mascote.png",
            HOSTING / "mascote.png",
        ],
    )

    avatar_src = PUBLIC / "mascote-avatar-circular.png"
    if avatar_src.exists():
        clean_mascot(
            avatar_src,
            [
                PUBLIC / "mascote-avatar-circular.png",
                HOSTING / "mascote-avatar-circular.png",
            ],
        )


if __name__ == "__main__":
    main()
