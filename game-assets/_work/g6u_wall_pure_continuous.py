"""G6u: pure continuous wall — no perimeter darken / no per-cell top lip.

G6k removed gold frames; G6n added masonry. Soft dark 4-edge rim + top lip
still painted a grid on multi-cell wall clusters (edge−inner mean ~46).
Same sticker-class defect as pre-G6t lanes.

Rebuild wall + wallAlt edge-to-edge charcoal masonry only:
- running-bond courses + grain (40px readable)
- NO vignette, NO BORDER/OUTER rectangle, NO top lip, NO bottom hairline
- wallAlt: offset bond + mean-match (G6p contract)
"""
from __future__ import annotations

import random
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128

FACE = (68, 62, 54)
FACE_B = (62, 56, 49)
FACE_C = (74, 68, 60)
FACE_D = (66, 60, 52)
# Softer than face-40 so courses read at 40px without hard lattice bars across multi-cell walls
MORTAR = (42, 38, 33)


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


def mean_rgb(im: Image.Image) -> float:
    px = list(im.convert("RGB").getdata())
    return sum(sum(p) for p in px) / (len(px) * 3)


def edge_inner_delta(im: Image.Image) -> float:
    a = np.array(im.convert("RGB"), dtype=float)
    h, w, _ = a.shape
    edge = np.concatenate(
        [
            a[0, :].reshape(-1, 3),
            a[-1, :].reshape(-1, 3),
            a[1:-1, 0].reshape(-1, 3),
            a[1:-1, -1].reshape(-1, 3),
        ]
    )
    inner = a[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4].reshape(-1, 3)
    return float(np.abs(edge.mean(0) - inner.mean(0)).mean())


def render_wall(
    size: int = SIZE,
    seed: int = 61,
    top_split: float = 0.45,
    bot_split: float = 0.55,
) -> Image.Image:
    """Edge-to-edge masonry face — pure continuous, no rim/lip framing."""
    rng = random.Random(seed)
    im = Image.new("RGB", (size, size), FACE)
    px = im.load()

    n_coarse = value_noise_field(size, 14, 9, rng)
    n_mid = value_noise_field(size, 6, 5, rng)
    n_fine = value_noise_field(size, 3, 3, rng)

    mid_y = size // 2
    mortar_w = 2
    # Mortar reaches near edges so multi-cell courses don't leave a dead frame band
    margin = 1

    def block_id(x: int, y: int) -> int:
        if y < mid_y:
            split = int(size * top_split)
            return 0 if x < split else 1
        split = int(size * bot_split)
        return 2 if x < split else 3

    block_faces = [FACE, FACE_B, FACE_C, FACE_D]

    for y in range(size):
        for x in range(size):
            base = block_faces[block_id(x, y) % 4]
            n = n_coarse[y][x] + n_mid[y][x] + n_fine[y][x]
            # Noise only — no diagonal depth (tiling creates tone checker) and no edge vignette
            r = int(max(0, min(255, base[0] + n)))
            g = int(max(0, min(255, base[1] + n * 0.95)))
            b = int(max(0, min(255, base[2] + n * 0.75)))
            px[x, y] = (r, g, b)

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

    soft_h_line(mid_y, margin, size - 1 - margin, mortar_w)
    soft_v_line(int(size * top_split), margin, mid_y - 1, mortar_w)
    soft_v_line(int(size * bot_split), mid_y + 1, size - 1 - margin, mortar_w)

    for _ in range(180):
        x = rng.randint(2, size - 3)
        y = rng.randint(2, size - 3)
        dark = rng.randint(-14, -4)
        r, g, b = px[x, y]
        px[x, y] = (max(0, r + dark), max(0, g + dark), max(0, b + dark // 2))

    im = im.filter(ImageFilter.SMOOTH)
    # Intentionally NO perimeter rectangle, NO top lip, NO bottom hairline
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


def wall_field(wall: Image.Image, wall_alt: Image.Image, path: Path, n: int = 4) -> None:
    """Checker wall / wallAlt at 40px — continuous mass gate."""
    w40 = wall.resize((40, 40), Image.Resampling.LANCZOS)
    a40 = wall_alt.resize((40, 40), Image.Resampling.LANCZOS)
    field = Image.new("RGB", (40 * n, 40 * n))
    for y in range(n):
        for x in range(n):
            t = a40 if (x + y) % 2 else w40
            field.paste(t, (x * 40, y * 40))
    field.save(path, optimize=True)


def rebuild_mock() -> None:
    base = Image.open(OUT / "floor-base.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    base_alt = Image.open(OUT / "floor-base-alt.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    lane = Image.open(OUT / "floor-lane.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    spawn = Image.open(OUT / "floor-spawn.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    wall = Image.open(OUT / "wall.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    wall_alt = Image.open(OUT / "wall-alt.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    crate = Image.open(OUT / "crate.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    n = 11
    mock = Image.new("RGBA", (n * 40, n * 40), (0, 0, 0, 255))
    for y in range(n):
        for x in range(n):
            if x == 0 or y == 0 or x == n - 1 or y == n - 1:
                t = wall_alt if (x + y) % 2 else wall
            elif (x, y) in ((2, 2), (2, n - 3), (n - 3, 2), (n - 3, n - 3)):
                t = spawn
            elif x == n // 2 or y == n // 2:
                t = lane
            else:
                t = base_alt if (x + y) % 2 else base
            mock.paste(t, (x * 40, y * 40), t)
    for cx, cy in ((3, 3), (4, 3), (3, 4), (7, 7), (7, 8), (8, 7)):
        t = wall_alt if (cx + cy) % 2 else wall
        mock.paste(t, (cx * 40, cy * 40), t)
    for y in range(2, n - 2):
        for x in range(2, n - 2):
            if x % 2 == 1 and y % 2 == 1 and x != n // 2 and y != n // 2:
                if (x, y) not in ((3, 3), (7, 7)):
                    mock.paste(crate, (x * 40, y * 40), crate)
    mock.save(OUT / "_preview-arena-mock.png", optimize=True)


def main() -> None:
    wall = render_wall(seed=61, top_split=0.45, bot_split=0.55)
    wall_alt = render_wall(seed=77, top_split=0.55, bot_split=0.40)

    # Mean-match alt to primary so checker doesn't create tone grid
    m0 = mean_rgb(wall)
    m1 = mean_rgb(wall_alt)
    if m1 > 1e-6:
        factor = m0 / m1
        wall_alt = ImageEnhance.Brightness(wall_alt).enhance(factor)

    wall.save(OUT / "wall.png", optimize=True)
    wall_alt.save(OUT / "wall-alt.png", optimize=True)

    make_seam(wall, OUT / "_seam-wall.png")
    make_seam(wall_alt, OUT / "_seam-wall-alt.png")
    downscale_preview(wall, OUT / "_preview40-wall.png")
    downscale_preview(wall_alt, OUT / "_preview40-wall-alt.png")

    w40 = wall.resize((40, 40), Image.Resampling.LANCZOS)
    w40.save(OUT / "_qa-wall40.png", optimize=True)
    cluster = Image.new("RGB", (80, 80))
    for ox, oy in ((0, 0), (40, 0), (0, 40), (40, 40)):
        cluster.paste(w40, (ox, oy))
    cluster.save(OUT / "_preview40-wall-cluster.png", optimize=True)

    wall_field(wall, wall_alt, OUT / "_qa-wall-field.png", n=4)
    rebuild_mock()

    d0 = edge_inner_delta(wall)
    d1 = edge_inner_delta(wall_alt)
    arr = np.array(w40, dtype=float)
    print(f"wall edge-inner delta={d0:.2f} (want ~small; was ~46)")
    print(f"wallAlt edge-inner delta={d1:.2f}")
    print(f"mean wall={mean_rgb(wall):.2f} alt={mean_rgb(wall_alt):.2f}")
    print(f"wall40 full std={arr.std():.2f} interior std={arr[4:36,4:36].std():.2f}")
    print(f"wall bytes={(OUT / 'wall.png').stat().st_size}")
    print(f"wall-alt bytes={(OUT / 'wall-alt.png').stat().st_size}")
    print("OK")


if __name__ == "__main__":
    main()
