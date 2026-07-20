"""G6k: continuous charcoal wall slab — no sand/gold picture-frame stickers.

Adjacent wall cells should read as solid mass (soft bevel only), not framed tiles.
"""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128

BORDER = (16, 14, 12)
OUTER = (36, 33, 29)
FACE = (70, 64, 56)
TOP = (96, 88, 78)
LIP = (175, 155, 120)


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


def render_wall(size: int = SIZE, seed: int = 53) -> Image.Image:
    """
    Solid charcoal stone slab, edge-to-edge grain.
    Soft dark rim only — no gold/sand 4-edge picture frame.
    Thin muted top lip only (theme accent).
    """
    rng = random.Random(seed)
    im = Image.new("RGB", (size, size), FACE)
    px = im.load()

    n_coarse = value_noise_field(size, 16, 10, rng)
    n_mid = value_noise_field(size, 7, 6, rng)
    n_fine = value_noise_field(size, 3, 3.5, rng)

    for y in range(size):
        for x in range(size):
            n = n_coarse[y][x] + n_mid[y][x] + n_fine[y][x]
            depth = ((size - x) + (size - y)) / (size * 2) * 8 - 2
            edge = min(x, y, size - 1 - x, size - 1 - y)
            vignette = -3 if edge < 4 else 0
            r = int(max(0, min(255, FACE[0] + n + depth + vignette)))
            g = int(max(0, min(255, FACE[1] + n * 0.95 + depth + vignette)))
            b = int(max(0, min(255, FACE[2] + n * 0.75 + depth * 0.6 + vignette)))
            px[x, y] = (r, g, b)

    for _ in range(220):
        x = rng.randint(4, size - 5)
        y = rng.randint(4, size - 5)
        dark = rng.randint(-16, -5)
        r, g, b = px[x, y]
        px[x, y] = (max(0, r + dark), max(0, g + dark), max(0, b + dark // 2))
        if rng.random() < 0.35:
            for dx, dy in ((1, 0), (-1, 0), (0, 1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < size and 0 <= yy < size:
                    r, g, b = px[xx, yy]
                    px[xx, yy] = (
                        max(0, r + dark // 2),
                        max(0, g + dark // 2),
                        max(0, b + dark // 3),
                    )

    im = im.filter(ImageFilter.SMOOTH)
    draw = ImageDraw.Draw(im)
    draw.rectangle([0, 0, size - 1, size - 1], outline=BORDER, width=2)
    draw.rectangle([2, 2, size - 3, size - 3], outline=OUTER, width=1)

    for i, boost in ((3, 14), (4, 8), (5, 4)):
        col = (
            min(255, TOP[0] + boost // 2),
            min(255, TOP[1] + boost // 2),
            min(255, TOP[2] + boost // 3),
        )
        draw.line([(i, i), (size - 1 - i, i)], fill=col, width=1)

    # muted sand hairline ONLY on top — never full frame
    draw.line([(7, 4), (size - 8, 4)], fill=LIP, width=1)
    draw.line([(3, size - 3), (size - 4, size - 3)], fill=BORDER, width=1)
    return im


def rebuild_mock() -> None:
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
    for cx, cy in ((3, 3), (4, 3), (3, 4), (7, 7), (7, 8), (8, 7)):
        mock.paste(wall, (cx * 40, cy * 40), wall)
    for y in range(2, n - 2):
        for x in range(2, n - 2):
            if x % 2 == 1 and y % 2 == 1 and x != n // 2 and y != n // 2:
                if (x, y) not in ((3, 3), (7, 7)):
                    mock.paste(crate, (x * 40, y * 40), crate)
    mock.save(OUT / "_preview-arena-mock.png", optimize=True)
    print("mock written")


def main() -> None:
    wall = render_wall()
    wall.save(OUT / "wall.png", optimize=True)
    make_seam(wall, OUT / "_seam-wall.png")
    downscale_preview(wall, OUT / "_preview40-wall.png")
    print(f"wall bytes={(OUT / 'wall.png').stat().st_size}")

    w = wall.resize((40, 40), Image.Resampling.LANCZOS)
    cluster = Image.new("RGB", (80, 80))
    for ox, oy in ((0, 0), (40, 0), (0, 40), (40, 40)):
        cluster.paste(w, (ox, oy))
    cluster.save(OUT / "_preview40-wall-cluster.png", optimize=True)

    rebuild_mock()
    print("OK")


if __name__ == "__main__":
    main()
