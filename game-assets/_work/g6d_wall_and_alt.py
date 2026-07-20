"""G6d: solid wall at 40px + second seamless cobble baseAlt for checkerboard."""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128

# Reuse cobble from seamless_cobble
import importlib.util

spec = importlib.util.spec_from_file_location(
    "seamless_cobble",
    Path(__file__).with_name("seamless_cobble.py"),
)
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def make_seam(im: Image.Image, path: Path) -> None:
    w, h = im.size
    canvas = Image.new(im.mode, (w * 2, h * 2))
    for ox, oy in ((0, 0), (w, 0), (0, h), (w, h)):
        canvas.paste(im, (ox, oy))
    canvas.save(path, optimize=True)


def downscale_preview(im: Image.Image, path: Path, size: int = 40) -> None:
    p = im.resize((size, size), Image.Resampling.LANCZOS)
    mode = "RGBA" if im.mode == "RGBA" else im.mode
    bg = (0, 0, 0, 0) if mode == "RGBA" else (0, 0, 0)
    grid = Image.new(mode, (size * 4, size * 4), bg)
    for gy in range(4):
        for gx in range(4):
            if p.mode == "RGBA":
                grid.paste(p, (gx * size, gy * size), p)
            else:
                grid.paste(p, (gx * size, gy * size))
    grid.save(path, optimize=True)


def render_wall(size: int = SIZE) -> Image.Image:
    """
    Solid charcoal slab, full-frame bevel on all 4 edges, sand accent ring.
    Reads as a block at 40px — no empty 'picture frame' center.
    """
    # palette from theme
    outer = (38, 35, 31)       # #26231f
    body = (58, 52, 46)        # #3a342e
    face = (72, 66, 58)
    top = (91, 83, 74)         # #5b534a
    accent = (216, 192, 154)   # #d8c09a
    border = (20, 18, 16)

    im = Image.new("RGB", (size, size), body)
    draw = ImageDraw.Draw(im)
    # outer border
    draw.rectangle([0, 0, size - 1, size - 1], outline=border, width=2)
    # outer dark ring
    draw.rectangle([2, 2, size - 3, size - 3], outline=outer, width=3)
    # top-ish highlight band (subtle, all-around soft face)
    draw.rectangle([5, 5, size - 6, size - 6], outline=top, width=2)
    # sand accent inner frame
    draw.rectangle([8, 8, size - 9, size - 9], outline=accent, width=1)
    # filled face with subtle noise grain
    px = im.load()
    for y in range(10, size - 10):
        for x in range(10, size - 10):
            n = ((x * 13 + y * 29) % 9) - 4
            # slight vertical gradient (top slightly lighter) without strong direction
            g = int((size - 10 - y) / (size - 20) * 6)
            r = max(0, min(255, face[0] + n + g))
            gch = max(0, min(255, face[1] + n + g))
            b = max(0, min(255, face[2] + n + g // 2))
            px[x, y] = (r, gch, b)
    # soft inner fill edge
    im = im.filter(ImageFilter.SMOOTH)
    # re-draw crisp frames after smooth
    draw = ImageDraw.Draw(im)
    draw.rectangle([0, 0, size - 1, size - 1], outline=border, width=2)
    draw.rectangle([8, 8, size - 9, size - 9], outline=accent, width=1)
    return im


def rebuild_mock_with_alt() -> None:
    base = Image.open(OUT / "floor-base.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    base_alt = Image.open(OUT / "floor-base-alt.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    lane = Image.open(OUT / "floor-lane.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    spawn = Image.open(OUT / "floor-spawn.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    wall = Image.open(OUT / "wall.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    crate = Image.open(OUT / "crate.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    n = 11
    mock = Image.new("RGBA", (n * 40, n * 40), (0, 0, 0, 255))
    for y in range(n):
        for x in range(n):
            if x == 0 or y == 0 or x == n - 1 or y == n - 1:
                t = wall
            elif (x, y) in ((2, 2), (2, n - 3), (n - 3, 2), (n - 3, n - 3)):
                t = spawn
            elif x == n // 2 or y == n // 2:
                t = lane
            else:
                t = base_alt if (x + y) % 2 else base
            mock.paste(t, (x * 40, y * 40), t)
    for y in range(2, n - 2):
        for x in range(2, n - 2):
            if x % 2 == 1 and y % 2 == 1 and x != n // 2 and y != n // 2:
                mock.paste(crate, (x * 40, y * 40), crate)
    mock.save(OUT / "_preview-arena-mock.png", optimize=True)
    print("mock with checker baseAlt written")


def main() -> None:
    # baseAlt with different seed, same seamless cobble generator
    best = None
    best_score = 1e18
    best_seed = 0
    for seed in range(80, 100):
        im = mod.render_cobble(SIZE, n_stones=30, seed=seed)
        d = mod.seam_delta(im)
        score = d["lr"] + d["tb"]
        if score < best_score:
            best_score = score
            best = im
            best_seed = seed
    assert best is not None
    # slightly darker lift so checker reads vs base
    from PIL import ImageEnhance
    alt = ImageEnhance.Brightness(best).enhance(0.94)
    alt.save(OUT / "floor-base-alt.png", optimize=True)
    make_seam(alt, OUT / "_seam-floor-base-alt.png")
    downscale_preview(alt, OUT / "_preview40-floor-base-alt.png")
    print(f"floor-base-alt seed={best_seed} seam={mod.seam_delta(alt)} bytes={(OUT/'floor-base-alt.png').stat().st_size}")

    wall = render_wall()
    wall.save(OUT / "wall.png", optimize=True)
    make_seam(wall, OUT / "_seam-wall.png")
    downscale_preview(wall, OUT / "_preview40-wall.png")
    print(f"wall bytes={(OUT/'wall.png').stat().st_size}")

    rebuild_mock_with_alt()
    print("OK")


if __name__ == "__main__":
    main()
