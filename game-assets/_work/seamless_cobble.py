"""
Build a truly seamless limestone cobble tile via wrapped Voronoi cells,
then derive lane/spawn; keep wall/crate. Tournament-clean main arena.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128
SEED = 42

# Warm limestone palette (tournament-clean)
GROUT = (120, 100, 82)
STONE_A = (216, 208, 194)  # #d8d0c2
STONE_B = (206, 197, 183)  # #cec5b7
STONE_C = (226, 216, 200)
STONE_D = (198, 188, 172)
HIGHLIGHT = (236, 228, 214)
SHADOW = (170, 158, 140)


def toroidal_dist2(ax: float, ay: float, bx: float, by: float, w: int, h: int) -> float:
    dx = abs(ax - bx)
    dy = abs(ay - by)
    dx = min(dx, w - dx)
    dy = min(dy, h - dy)
    return dx * dx + dy * dy


def generate_sites(n: int, w: int, h: int, rng: random.Random) -> list[tuple[float, float, tuple[int, int, int]]]:
    palette = [STONE_A, STONE_B, STONE_C, STONE_D]
    # stratified jitter grid for even density (avoids landmark clumps)
    cols = int(math.sqrt(n))
    rows = int(math.ceil(n / cols))
    sites: list[tuple[float, float, tuple[int, int, int]]] = []
    cell_w = w / cols
    cell_h = h / rows
    i = 0
    for row in range(rows):
        for col in range(cols):
            if i >= n:
                break
            jx = rng.uniform(0.18, 0.82)
            jy = rng.uniform(0.18, 0.82)
            x = (col + jx) * cell_w
            y = (row + jy) * cell_h
            color = palette[i % len(palette)]
            # mild per-stone tint
            tint = rng.randint(-8, 8)
            color = (
                max(0, min(255, color[0] + tint)),
                max(0, min(255, color[1] + tint)),
                max(0, min(255, color[2] + tint // 2)),
            )
            sites.append((x, y, color))
            i += 1
    return sites


def render_cobble(size: int = SIZE, n_stones: int = 28, seed: int = SEED) -> Image.Image:
    rng = random.Random(seed)
    sites = generate_sites(n_stones, size, size, rng)
    # second ring of wrapped site copies not needed if distance is toroidal
    img = Image.new("RGB", (size, size), GROUT)
    px = img.load()

    # assign each pixel nearest site (toroidal) → stone face; leave grout near borders
    # precompute site list
    for y in range(size):
        for x in range(size):
            best_d = 1e18
            second_d = 1e18
            best_c = GROUT
            for sx, sy, col in sites:
                d = toroidal_dist2(x + 0.5, y + 0.5, sx, sy, size, size)
                if d < best_d:
                    second_d = best_d
                    best_d = d
                    best_c = col
                elif d < second_d:
                    second_d = d
            # edge distance between voronoi cells → grout thickness
            edge = math.sqrt(second_d) - math.sqrt(best_d)
            if edge < 1.35:
                # grout band
                t = edge / 1.35
                r = int(GROUT[0] * (1 - t) + best_c[0] * t)
                g = int(GROUT[1] * (1 - t) + best_c[1] * t)
                b = int(GROUT[2] * (1 - t) + best_c[2] * t)
                px[x, y] = (r, g, b)
            else:
                # soft radial shade within stone (non-directional overall)
                # use hash of site for stable micro-variation
                noise = ((x * 17 + y * 31 + int(best_d)) % 7) - 3
                r = max(0, min(255, best_c[0] + noise))
                g = max(0, min(255, best_c[1] + noise))
                b = max(0, min(255, best_c[2] + noise // 2))
                px[x, y] = (r, g, b)

    # mild overall grain
    img = img.filter(ImageFilter.SMOOTH)
    return img


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


def seam_delta(im: Image.Image) -> dict[str, float]:
    """Mean abs RGB delta across left-right and top-bottom edges (lower = better)."""
    im = im.convert("RGB")
    w, h = im.size
    px = im.load()
    lr = 0.0
    tb = 0.0
    for y in range(h):
        a = px[0, y]
        b = px[w - 1, y]
        lr += abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
    for x in range(w):
        a = px[x, 0]
        b = px[x, h - 1]
        tb += abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
    return {"lr": lr / (h * 3), "tb": tb / (w * 3)}


def build_lane(base: Image.Image) -> Image.Image:
    im = ImageEnhance.Brightness(base).enhance(1.10)
    cream = Image.new("RGB", im.size, (239, 229, 214))
    im = Image.blend(im, cream, 0.16)
    draw = ImageDraw.Draw(im)
    margin = 10
    color = (175, 150, 115)
    for i in range(2):
        draw.rectangle(
            [margin + i, margin + i, SIZE - 1 - margin - i, SIZE - 1 - margin - i],
            outline=color,
        )
    return im


def build_spawn(base: Image.Image) -> Image.Image:
    im = ImageEnhance.Brightness(base).enhance(1.07)
    cream = Image.new("RGB", im.size, (247, 239, 224))
    im = Image.blend(im, cream, 0.12)
    draw = ImageDraw.Draw(im)
    cx = cy = SIZE // 2
    # thin gold ring
    for r, col in (
        (38, (180, 145, 70)),
        (37, (196, 158, 76)),
        (36, (210, 175, 95)),
        (35, (196, 158, 76)),
        (34, (160, 130, 65)),
    ):
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col)
    return im


def rebuild_mock() -> None:
    base = Image.open(OUT / "floor-base.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
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
                t = base
            mock.paste(t, (x * 40, y * 40), t)
    for y in range(2, n - 2):
        for x in range(2, n - 2):
            if x % 2 == 1 and y % 2 == 1 and x != n // 2 and y != n // 2:
                mock.paste(crate, (x * 40, y * 40), crate)
    mock.save(OUT / "_preview-arena-mock.png", optimize=True)


def main() -> None:
    # try a few seeds, pick lowest edge delta
    best_im = None
    best_score = 1e18
    best_seed = SEED
    for seed in range(SEED, SEED + 12):
        im = render_cobble(SIZE, n_stones=30, seed=seed)
        d = seam_delta(im)
        score = d["lr"] + d["tb"]
        if score < best_score:
            best_score = score
            best_im = im
            best_seed = seed
    assert best_im is not None
    base = best_im
    print(f"best seed={best_seed} seam_delta={seam_delta(base)} score={best_score:.3f}")

    base.save(OUT / "floor-base.png", optimize=True)
    make_seam(base, OUT / "_seam-floor-base.png")
    downscale_preview(base, OUT / "_preview40-floor-base.png")

    lane = build_lane(base)
    lane.save(OUT / "floor-lane.png", optimize=True)
    make_seam(lane, OUT / "_seam-floor-lane.png")
    downscale_preview(lane, OUT / "_preview40-floor-lane.png")

    spawn = build_spawn(base)
    spawn.save(OUT / "floor-spawn.png", optimize=True)
    make_seam(spawn, OUT / "_seam-floor-spawn.png")
    downscale_preview(spawn, OUT / "_preview40-floor-spawn.png")

    # refresh wall/crate seams if present
    for name in ("wall.png", "crate.png"):
        p = OUT / name
        if p.exists():
            im = Image.open(p)
            make_seam(im, OUT / f"_seam-{name}")
            downscale_preview(im, OUT / f"_preview40-{name}")

    rebuild_mock()
    print("sizes:", {n: (OUT / n).stat().st_size for n in (
        "floor-base.png", "floor-lane.png", "floor-spawn.png", "wall.png", "crate.png"
    )})
    print("OK")


if __name__ == "__main__":
    main()
