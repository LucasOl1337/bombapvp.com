"""G6l: kill light/dark checkerboard from baseAlt + finer anonymous cobble.

game-tilesets §1: large-scale tone gradients that create checkerboarding = fail.
Prior baseAlt was Brightness(0.94) → mean ~182 vs base ~194 → visible checker.
Also refine: more stones, softer grout; re-derive lane (no frame) + spawn ring.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128

# Softer grout (less mesh grid at 40px) + warm limestone family
GROUT = (150, 136, 118)
STONE_A = (216, 208, 194)
STONE_B = (206, 197, 183)
STONE_C = (226, 216, 200)
STONE_D = (198, 188, 172)


def toroidal_dist2(ax: float, ay: float, bx: float, by: float, w: int, h: int) -> float:
    dx = min(abs(ax - bx), w - abs(ax - bx))
    dy = min(abs(ay - by), h - abs(ay - by))
    return dx * dx + dy * dy


def generate_sites(n: int, w: int, h: int, rng: random.Random) -> list[tuple[float, float, tuple[int, int, int]]]:
    palette = [STONE_A, STONE_B, STONE_C, STONE_D]
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
            jx = rng.uniform(0.15, 0.85)
            jy = rng.uniform(0.15, 0.85)
            x = (col + jx) * cell_w
            y = (row + jy) * cell_h
            color = palette[i % len(palette)]
            tint = rng.randint(-7, 7)
            color = (
                max(0, min(255, color[0] + tint)),
                max(0, min(255, color[1] + tint)),
                max(0, min(255, color[2] + tint // 2)),
            )
            sites.append((x, y, color))
            i += 1
    return sites


def render_cobble(size: int = SIZE, n_stones: int = 42, seed: int = 47, grout_width: float = 1.05) -> Image.Image:
    rng = random.Random(seed)
    sites = generate_sites(n_stones, size, size, rng)
    img = Image.new("RGB", (size, size), GROUT)
    px = img.load()
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
            edge = math.sqrt(second_d) - math.sqrt(best_d)
            if edge < grout_width:
                t = edge / grout_width
                r = int(GROUT[0] * (1 - t) + best_c[0] * t)
                g = int(GROUT[1] * (1 - t) + best_c[1] * t)
                b = int(GROUT[2] * (1 - t) + best_c[2] * t)
                px[x, y] = (r, g, b)
            else:
                noise = ((x * 17 + y * 31 + int(best_d)) % 7) - 3
                r = max(0, min(255, best_c[0] + noise))
                g = max(0, min(255, best_c[1] + noise))
                b = max(0, min(255, best_c[2] + noise // 2))
                px[x, y] = (r, g, b)
    return img.filter(ImageFilter.SMOOTH)


def mean_rgb(im: Image.Image) -> float:
    px = list(im.convert("RGB").getdata())
    return sum(sum(p) for p in px) / (len(px) * 3)


def match_mean_brightness(im: Image.Image, target_mean: float) -> Image.Image:
    """Scale RGB so mean luminance matches target (prevents tone checkerboard)."""
    cur = mean_rgb(im)
    if cur < 1e-6:
        return im
    factor = target_mean / cur
    # clamp extreme
    factor = max(0.92, min(1.08, factor))
    return ImageEnhance.Brightness(im).enhance(factor)


def seam_delta(im: Image.Image) -> dict[str, float]:
    im = im.convert("RGB")
    w, h = im.size
    px = im.load()
    lr = tb = 0.0
    for y in range(h):
        a, b = px[0, y], px[w - 1, y]
        lr += abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
    for x in range(w):
        a, b = px[x, 0], px[x, h - 1]
        tb += abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
    return {"lr": lr / (h * 3), "tb": tb / (w * 3)}


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


def build_lane(base: Image.Image) -> Image.Image:
    """G6j continuous lane: cream lift only + 1px soft edge darken. No rectangle frame."""
    im = ImageEnhance.Brightness(base).enhance(1.14)
    cream = Image.new("RGB", im.size, (239, 229, 214))
    im = Image.blend(im, cream, 0.18)
    # soft perimeter darken (not a drawn gold frame)
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            edge = min(x, y, w - 1 - x, h - 1 - y)
            if edge == 0:
                r, g, b = px[x, y]
                px[x, y] = (max(0, r - 18), max(0, g - 16), max(0, b - 14))
            elif edge == 1:
                r, g, b = px[x, y]
                px[x, y] = (max(0, r - 8), max(0, g - 7), max(0, b - 6))
    return im


def build_spawn(base: Image.Image) -> Image.Image:
    """Open gold ring only on pad tile."""
    im = ImageEnhance.Brightness(base).enhance(1.06)
    cream = Image.new("RGB", im.size, (247, 239, 224))
    im = Image.blend(im, cream, 0.10)
    draw = ImageDraw.Draw(im)
    cx = cy = SIZE // 2
    for r, col in (
        (38, (180, 145, 70)),
        (37, (196, 158, 76)),
        (36, (210, 175, 95)),
        (35, (196, 158, 76)),
        (34, (160, 130, 65)),
    ):
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col)
    return im


def pick_best(seed_start: int, seed_end: int, n_stones: int) -> tuple[Image.Image, int, dict[str, float]]:
    best_im = None
    best_score = 1e18
    best_seed = seed_start
    best_d: dict[str, float] = {}
    for seed in range(seed_start, seed_end):
        im = render_cobble(SIZE, n_stones=n_stones, seed=seed)
        d = seam_delta(im)
        score = d["lr"] + d["tb"]
        if score < best_score:
            best_score = score
            best_im = im
            best_seed = seed
            best_d = d
    assert best_im is not None
    return best_im, best_seed, best_d


def field_preview(base: Image.Image, alt: Image.Image, path: Path, n: int = 8, cell: int = 40) -> None:
    b = base.resize((cell, cell), Image.Resampling.LANCZOS)
    a = alt.resize((cell, cell), Image.Resampling.LANCZOS)
    field = Image.new("RGB", (n * cell, n * cell))
    for y in range(n):
        for x in range(n):
            field.paste(a if (x + y) % 2 else b, (x * cell, y * cell))
    field.save(path, optimize=True)


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
    for y in range(2, n - 2):
        for x in range(2, n - 2):
            if x % 2 == 1 and y % 2 == 1 and x != n // 2 and y != n // 2:
                mock.paste(crate, (x * 40, y * 40), crate)
    mock.save(OUT / "_preview-arena-mock.png", optimize=True)


def main() -> None:
    base, seed_b, d_b = pick_best(40, 70, n_stones=44)
    print(f"base seed={seed_b} seam={d_b} mean={mean_rgb(base):.2f}")
    base.save(OUT / "floor-base.png", optimize=True)
    make_seam(base, OUT / "_seam-floor-base.png")
    downscale_preview(base, OUT / "_preview40-floor-base.png")

    alt, seed_a, d_a = pick_best(80, 120, n_stones=44)
    print(f"alt raw seed={seed_a} seam={d_a} mean={mean_rgb(alt):.2f}")
    # CRITICAL: match mean brightness to base — no tone checkerboard
    target = mean_rgb(base)
    alt = match_mean_brightness(alt, target)
    print(f"alt matched mean={mean_rgb(alt):.2f} (target {target:.2f})")
    alt.save(OUT / "floor-base-alt.png", optimize=True)
    make_seam(alt, OUT / "_seam-floor-base-alt.png")
    downscale_preview(alt, OUT / "_preview40-floor-base-alt.png")

    field_preview(base, alt, OUT / "_qa-floor-field.png")
    # tone checker metric: mean abs cell-mean delta across checker
    cell = 40
    b40 = base.resize((cell, cell), Image.Resampling.LANCZOS)
    a40 = alt.resize((cell, cell), Image.Resampling.LANCZOS)
    print(f"cell means base40={mean_rgb(b40):.2f} alt40={mean_rgb(a40):.2f} delta={abs(mean_rgb(b40)-mean_rgb(a40)):.2f}")

    lane = build_lane(base)
    lane.save(OUT / "floor-lane.png", optimize=True)
    make_seam(lane, OUT / "_seam-floor-lane.png")
    downscale_preview(lane, OUT / "_preview40-floor-lane.png")
    print(f"lane mean={mean_rgb(lane):.2f}")

    spawn = build_spawn(base)
    spawn.save(OUT / "floor-spawn.png", optimize=True)
    make_seam(spawn, OUT / "_seam-floor-spawn.png")
    downscale_preview(spawn, OUT / "_preview40-floor-spawn.png")

    rebuild_mock()
    print("OK")


if __name__ == "__main__":
    main()
