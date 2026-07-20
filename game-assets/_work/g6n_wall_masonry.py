"""G6n: wall masonry readable at 40px — stone courses, no gold sticker frames.

Prior G6k wall removed gold frames but face was almost featureless at game scale
(interior std ~7.7). Add soft running-bond stone courses + grain so walls read
as charcoal masonry slabs, not flat UI squares.
"""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128

BORDER = (14, 12, 11)
OUTER = (34, 31, 28)
FACE = (68, 62, 54)
FACE_B = (62, 56, 49)
FACE_C = (74, 68, 60)
MORTAR = (28, 25, 22)
TOP = (98, 90, 80)
LIP = (175, 155, 120)


def value_noise_field(size: int, cell: int, amp: float, rng: random.Random) -> list[list[float]]:
    cols = size // cell + 3
    rows = size // cell + 3
    grid = [[rng.uniform(-1, 1) for _ in range(cols)] for _ in range(rows)]
    out = [[0.0] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            gx = x / cell
            gy = y / cell
            x0 = int(gx)
            y0 = int(gy)
            fx = gx - x0
            fy = gy - y0
            sx = fx * fx * (3 - 2 * fx)
            sy = fy * fy * (3 - 2 * fy)
            v00 = grid[y0][x0]
            v10 = grid[y0][x0 + 1]
            v01 = grid[y0 + 1][x0]
            v11 = grid[y0 + 1][x0 + 1]
            v0 = v00 * (1 - sx) + v10 * sx
            v1 = v01 * (1 - sx) + v11 * sx
            out[y][x] = (v0 * (1 - sy) + v1 * sy) * amp
    return out


def render_wall(size: int = SIZE, seed: int = 61) -> Image.Image:
    rng = random.Random(seed)
    im = Image.new("RGB", (size, size), FACE)
    px = im.load()

    n_coarse = value_noise_field(size, 14, 9, rng)
    n_mid = value_noise_field(size, 6, 5, rng)
    n_fine = value_noise_field(size, 3, 3, rng)

    # Running-bond stone blocks: 2 rows × staggered columns
    # Margins keep masonry inside soft rim (no gold outer frame)
    margin = 8
    mid_y = size // 2
    mortar_w = 2

    def block_id(x: int, y: int) -> int:
        """Stable id for which stone this pixel belongs to."""
        yy = y
        if yy < mid_y:
            # top row: two blocks split near 0.45 width
            split = int(size * 0.45)
            col = 0 if x < split else 1
            return col  # 0,1
        # bottom row: staggered — three-ish / two with offset split
        split = int(size * 0.55)
        col = 0 if x < split else 1
        return 2 + col  # 2,3

    block_faces = [
        FACE,
        FACE_B,
        FACE_C,
        (66, 60, 52),
    ]

    for y in range(size):
        for x in range(size):
            bid = block_id(x, y)
            base = block_faces[bid % len(block_faces)]
            n = n_coarse[y][x] + n_mid[y][x] + n_fine[y][x]
            depth = ((size - x) + (size - y)) / (size * 2) * 7 - 1.5
            edge = min(x, y, size - 1 - x, size - 1 - y)
            vignette = -4 if edge < 5 else 0
            r = int(max(0, min(255, base[0] + n + depth + vignette)))
            g = int(max(0, min(255, base[1] + n * 0.95 + depth + vignette)))
            b = int(max(0, min(255, base[2] + n * 0.75 + depth * 0.55 + vignette)))
            px[x, y] = (r, g, b)

    # Soft mortar lines (inside face only) — readable at 40px, not gold
    draw = ImageDraw.Draw(im)

    def soft_h_line(y0: int, x0: int, x1: int, width: int = 2) -> None:
        for dy in range(-1, width + 1):
            yy = y0 + dy
            if 0 <= yy < size:
                alpha = 1.0 if 0 <= dy < width else 0.45
                col = tuple(int(MORTAR[i] * alpha + FACE[i] * (1 - alpha)) for i in range(3))
                draw.line([(x0, yy), (x1, yy)], fill=col, width=1)

    def soft_v_line(x0: int, y0: int, y1: int, width: int = 2) -> None:
        for dx in range(-1, width + 1):
            xx = x0 + dx
            if 0 <= xx < size:
                alpha = 1.0 if 0 <= dx < width else 0.45
                col = tuple(int(MORTAR[i] * alpha + FACE[i] * (1 - alpha)) for i in range(3))
                draw.line([(xx, y0), (xx, y1)], fill=col, width=1)

    # horizontal course joint
    soft_h_line(mid_y, margin, size - 1 - margin, mortar_w)
    # top-row vertical joint
    soft_v_line(int(size * 0.45), margin, mid_y - 1, mortar_w)
    # bottom-row staggered vertical joint
    soft_v_line(int(size * 0.55), mid_y + 1, size - 1 - margin, mortar_w)

    # micro pits for stone pores
    for _ in range(160):
        x = rng.randint(margin + 2, size - margin - 3)
        y = rng.randint(margin + 2, size - margin - 3)
        dark = rng.randint(-14, -4)
        r, g, b = px[x, y]
        px[x, y] = (max(0, r + dark), max(0, g + dark), max(0, b + dark // 2))

    im = im.filter(ImageFilter.SMOOTH)
    draw = ImageDraw.Draw(im)

    # Soft dark rim only — NO gold/sand 4-edge frame (G6k contract)
    draw.rectangle([0, 0, size - 1, size - 1], outline=BORDER, width=2)
    draw.rectangle([2, 2, size - 3, size - 3], outline=OUTER, width=1)

    # Top lip highlight + muted sand hairline (top only)
    for i, boost in ((3, 14), (4, 8), (5, 4)):
        col = (
            min(255, TOP[0] + boost // 2),
            min(255, TOP[1] + boost // 2),
            min(255, TOP[2] + boost // 3),
        )
        draw.line([(i, i), (size - 1 - i, i)], fill=col, width=1)
    draw.line([(7, 4), (size - 8, 4)], fill=LIP, width=1)
    draw.line([(3, size - 3), (size - 4, size - 3)], fill=BORDER, width=1)

    return im


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


def rebuild_mock() -> None:
    base = Image.open(OUT / "floor-base.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    base_alt = Image.open(OUT / "floor-base-alt.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    lane = Image.open(OUT / "floor-lane.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    spawn = Image.open(OUT / "floor-spawn.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    portal = Image.open(OUT / "floor-portal.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
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
            elif (x, y) in ((0, n // 2), (n - 1, n // 2), (n // 2, 0), (n // 2, n - 1)):
                t = portal  # won't hit due to border walls; kept for completeness
            elif x == n // 2 or y == n // 2:
                t = lane
            else:
                t = base_alt if (x + y) % 2 else base
            mock.paste(t, (x * 40, y * 40), t)
    # interior solid walls
    for cx, cy in ((3, 3), (4, 3), (3, 4), (7, 7), (7, 8), (8, 7)):
        mock.paste(wall, (cx * 40, cy * 40), wall)
    for y in range(2, n - 2):
        for x in range(2, n - 2):
            if x % 2 == 1 and y % 2 == 1 and x != n // 2 and y != n // 2:
                if (x, y) not in ((3, 3), (7, 7)):
                    mock.paste(crate, (x * 40, y * 40), crate)
    mock.save(OUT / "_preview-arena-mock.png", optimize=True)


def main() -> None:
    wall = render_wall()
    wall.save(OUT / "wall.png", optimize=True)
    make_seam(wall, OUT / "_seam-wall.png")
    downscale_preview(wall, OUT / "_preview40-wall.png")
    w40 = wall.resize((40, 40), Image.Resampling.LANCZOS)
    w40.save(OUT / "_qa-wall40.png", optimize=True)
    cluster = Image.new("RGB", (80, 80))
    for ox, oy in ((0, 0), (40, 0), (0, 40), (40, 40)):
        cluster.paste(w40, (ox, oy))
    cluster.save(OUT / "_preview40-wall-cluster.png", optimize=True)

    # contrast metric
    import numpy as np

    arr = np.array(w40, dtype=float)
    print(f"wall40 full std={arr.std():.2f} interior std={arr[4:36,4:36].std():.2f}")
    print(f"wall bytes={(OUT / 'wall.png').stat().st_size}")
    rebuild_mock()
    print("OK")


if __name__ == "__main__":
    main()
