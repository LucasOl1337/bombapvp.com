"""G6m: wrap-portal floor tile — open dashed ring, no gold square sticker frame.

Portals currently use lane cobble + code strokeRect → hard gold squares at map edges.
Portal tile: same cobble family, open dashed ring (distinct from solid spawn ring).
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128


def make_seam(im: Image.Image, path: Path) -> None:
    w, h = im.size
    canvas = Image.new(im.mode, (w * 2, h * 2))
    for ox, oy in ((0, 0), (w, 0), (0, h), (w, h)):
        canvas.paste(im, (ox, oy))
    canvas.save(path, optimize=True)


def downscale_preview(im: Image.Image, path: Path, size: int = 40) -> None:
    p = im.resize((size, size), Image.Resampling.LANCZOS)
    grid = Image.new(im.mode, (size * 4, size * 4))
    for gy in range(4):
        for gx in range(4):
            grid.paste(p, (gx * size, gy * size))
    grid.save(path, optimize=True)


def draw_dashed_ellipse(
    draw: ImageDraw.ImageDraw,
    bbox: tuple[int, int, int, int],
    colors: list[tuple[int, int, int]],
    dash_deg: float = 28,
    gap_deg: float = 17,
) -> None:
    """Dashed ring via short arc segments — open gate feel, not a closed sticker frame."""
    cx = (bbox[0] + bbox[2]) / 2
    cy = (bbox[1] + bbox[3]) / 2
    rx = (bbox[2] - bbox[0]) / 2
    ry = (bbox[3] - bbox[1]) / 2
    # 4 dash groups at N/E/S/W, gaps at diagonals → reads as passage
    starts = [ -dash_deg / 2 + i * 90 for i in range(4)]
    for start in starts:
        for width, col in enumerate(colors):
            # slightly thicker outer → thinner inner via radius shrink
            scale = 1.0 - width * 0.012
            steps = max(8, int(dash_deg))
            pts: list[tuple[float, float]] = []
            for s in range(steps + 1):
                ang = math.radians(start + dash_deg * s / steps)
                x = cx + rx * scale * math.cos(ang)
                y = cy + ry * scale * math.sin(ang)
                pts.append((x, y))
            if len(pts) >= 2:
                draw.line(pts, fill=col, width=2 if width == 1 else 1)


def build_portal(base: Image.Image) -> Image.Image:
    # Slight cool lift so portal ≠ spawn warm ring, still floor family
    im = ImageEnhance.Brightness(base).enhance(1.05)
    cool = Image.new("RGB", im.size, (228, 222, 212))
    im = Image.blend(im, cool, 0.10)
    draw = ImageDraw.Draw(im)
    cx = cy = SIZE // 2
    r = 36
    bbox = (cx - r, cy - r, cx + r, cy + r)
    # gold family, muted — outer dark, mid bright, inner soft
    colors = [
        (160, 130, 65),
        (196, 158, 76),
        (210, 175, 95),
        (180, 145, 70),
    ]
    draw_dashed_ellipse(draw, bbox, colors)

    # tiny open center cross-gap hint (not a solid disc)
    for ang0 in (45, 135, 225, 315):
        ang = math.radians(ang0)
        x0 = cx + 10 * math.cos(ang)
        y0 = cy + 10 * math.sin(ang)
        x1 = cx + 16 * math.cos(ang)
        y1 = cy + 16 * math.sin(ang)
        draw.line([(x0, y0), (x1, y1)], fill=(175, 150, 100), width=1)

    return im


def main() -> None:
    base = Image.open(OUT / "floor-base.png").convert("RGB")
    portal = build_portal(base)
    portal.save(OUT / "floor-portal.png", optimize=True)
    make_seam(portal, OUT / "_seam-floor-portal.png")
    downscale_preview(portal, OUT / "_preview40-floor-portal.png")
    print(f"portal bytes={(OUT / 'floor-portal.png').stat().st_size}")

    # side-by-side spawn vs portal at 40 for family check
    spawn = Image.open(OUT / "floor-spawn.png").convert("RGB").resize((40, 40), Image.Resampling.LANCZOS)
    p40 = portal.resize((40, 40), Image.Resampling.LANCZOS)
    cmp = Image.new("RGB", (90, 40), (20, 20, 20))
    cmp.paste(spawn, (0, 0))
    cmp.paste(p40, (50, 0))
    cmp.save(OUT / "_qa-spawn-vs-portal40.png", optimize=True)
    print("OK")


if __name__ == "__main__":
    main()
