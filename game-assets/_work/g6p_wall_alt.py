"""G6p: wallAlt — offset masonry bond to break identical wall stamp motif.

Same family as G6n wall (charcoal courses, soft rim, top lip, no gold frame).
Splits inverted + different grain seed so adjacent walls don't share the same T-joint.
Mean-matched to base wall so checker doesn't create light/dark solid grid.
"""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

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


def mean_rgb(im: Image.Image) -> float:
    px = list(im.convert("RGB").getdata())
    return sum(sum(p) for p in px) / (len(px) * 3)


def render_wall(
    size: int = SIZE,
    seed: int = 77,
    top_split: float = 0.55,
    bot_split: float = 0.40,
) -> Image.Image:
    """Offset bond: top split right-heavy, bottom left-heavy (inverse of primary wall)."""
    rng = random.Random(seed)
    im = Image.new("RGB", (size, size), FACE)
    px = im.load()

    n_coarse = value_noise_field(size, 14, 9, rng)
    n_mid = value_noise_field(size, 6, 5, rng)
    n_fine = value_noise_field(size, 3, 3, rng)

    margin = 8
    mid_y = size // 2
    mortar_w = 2

    def block_id(x: int, y: int) -> int:
        if y < mid_y:
            split = int(size * top_split)
            return 0 if x < split else 1
        split = int(size * bot_split)
        return 2 if x < split else 3

    block_faces = [FACE, FACE_B, FACE_C, (66, 60, 52)]

    for y in range(size):
        for x in range(size):
            base = block_faces[block_id(x, y) % 4]
            n = n_coarse[y][x] + n_mid[y][x] + n_fine[y][x]
            depth = ((size - x) + (size - y)) / (size * 2) * 7 - 1.5
            edge = min(x, y, size - 1 - x, size - 1 - y)
            vignette = -4 if edge < 5 else 0
            r = int(max(0, min(255, base[0] + n + depth + vignette)))
            g = int(max(0, min(255, base[1] + n * 0.95 + depth + vignette)))
            b = int(max(0, min(255, base[2] + n * 0.75 + depth * 0.55 + vignette)))
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

    for _ in range(160):
        x = rng.randint(margin + 2, size - margin - 3)
        y = rng.randint(margin + 2, size - margin - 3)
        dark = rng.randint(-14, -4)
        r, g, b = px[x, y]
        px[x, y] = (max(0, r + dark), max(0, g + dark), max(0, b + dark // 2))

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


def main() -> None:
    base = Image.open(OUT / "wall.png").convert("RGB")
    target = mean_rgb(base)
    alt = render_wall(seed=77, top_split=0.55, bot_split=0.40)
    # mean-match
    factor = max(0.94, min(1.06, target / max(1e-6, mean_rgb(alt))))
    alt = ImageEnhance.Brightness(alt).enhance(factor)
    alt.save(OUT / "wall-alt.png", optimize=True)
    make_seam(alt, OUT / "_seam-wall-alt.png")
    downscale_preview(alt, OUT / "_preview40-wall-alt.png")

    # checker field QA
    b40 = base.resize((40, 40), Image.Resampling.LANCZOS)
    a40 = alt.resize((40, 40), Image.Resampling.LANCZOS)
    field = Image.new("RGB", (160, 160))
    for y in range(4):
        for x in range(4):
            field.paste(a40 if (x + y) % 2 else b40, (x * 40, y * 40))
    field.save(OUT / "_qa-wall-field.png", optimize=True)

    print(f"base mean={mean_rgb(base):.2f} alt mean={mean_rgb(alt):.2f} delta={abs(mean_rgb(base)-mean_rgb(alt)):.2f}")
    print(f"bytes={(OUT / 'wall-alt.png').stat().st_size}")
    print("OK")


if __name__ == "__main__":
    main()
