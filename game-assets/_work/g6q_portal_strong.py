"""G6q: stronger wrap-portal dashed ring — readable at 40px, still ≠ spawn solid ring.

Prior G6m portal dashes were too faint at mid-edges (looked like incomplete parentheses).
Keep open dashed language (passage) vs solid spawn ring (safe pad).
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


def draw_arc_ring(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    dash_deg: float,
    gap_deg: float,
    colors: list[tuple[int, int, int]],
    width: int,
    phase: float = 0.0,
) -> None:
    """4 long dashes at N/E/S/W with clear gaps — open gate, not closed sticker."""
    step = dash_deg + gap_deg
    starts = [phase - dash_deg / 2 + i * 90 for i in range(4)]
    for start in starts:
        for wi, col in enumerate(colors):
            scale = 1.0 - wi * 0.02
            pts: list[tuple[float, float]] = []
            steps = max(12, int(dash_deg * 1.2))
            for s in range(steps + 1):
                ang = math.radians(start + dash_deg * s / steps)
                x = cx + r * scale * math.cos(ang)
                y = cy + r * scale * math.sin(ang)
                pts.append((x, y))
            draw.line(pts, fill=col, width=max(1, width - wi))


def build_portal(base: Image.Image) -> Image.Image:
    im = ImageEnhance.Brightness(base).enhance(1.06)
    cool = Image.new("RGB", im.size, (230, 224, 214))
    im = Image.blend(im, cool, 0.10)
    draw = ImageDraw.Draw(im)
    cx = cy = SIZE // 2

    # Outer strong dashed ring — longer dashes, thicker, brighter gold
    outer_colors = [
        (140, 110, 45),
        (196, 158, 76),
        (220, 185, 105),
        (200, 165, 85),
    ]
    draw_arc_ring(draw, cx, cy, 38, dash_deg=58, gap_deg=32, colors=outer_colors, width=4, phase=0)

    # Inner echo (slightly shorter dashes, thinner) — depth without closing the ring
    inner_colors = [
        (160, 130, 60),
        (205, 170, 95),
    ]
    draw_arc_ring(draw, cx, cy, 30, dash_deg=48, gap_deg=42, colors=inner_colors, width=2, phase=0)

    # Small radial tick marks at dash midpoints (N/E/S/W) — read as "gate" at 40px
    for ang0 in (0, 90, 180, 270):
        ang = math.radians(ang0)
        x0 = cx + 22 * math.cos(ang)
        y0 = cy + 22 * math.sin(ang)
        x1 = cx + 26 * math.cos(ang)
        y1 = cy + 26 * math.sin(ang)
        draw.line([(x0, y0), (x1, y1)], fill=(190, 155, 75), width=2)

    return im


def main() -> None:
    base = Image.open(OUT / "floor-base.png").convert("RGB")
    portal = build_portal(base)
    portal.save(OUT / "floor-portal.png", optimize=True)
    make_seam(portal, OUT / "_seam-floor-portal.png")
    downscale_preview(portal, OUT / "_preview40-floor-portal.png")

    spawn = Image.open(OUT / "floor-spawn.png").convert("RGB").resize((40, 40), Image.Resampling.LANCZOS)
    p40 = portal.resize((40, 40), Image.Resampling.LANCZOS)
    cmp = Image.new("RGB", (130, 40), (20, 20, 20))
    cmp.paste(spawn, (0, 0))
    cmp.paste(p40, (45, 0))
    # side-by-side also with lane for context
    lane = Image.open(OUT / "floor-lane.png").convert("RGB").resize((40, 40), Image.Resampling.LANCZOS)
    cmp.paste(lane, (90, 0))
    cmp.save(OUT / "_qa-spawn-portal-lane40.png", optimize=True)
    p40.save(OUT / "_qa-portal40.png", optimize=True)

    print(f"portal bytes={(OUT / 'floor-portal.png').stat().st_size}")
    print("OK")


if __name__ == "__main__":
    main()
