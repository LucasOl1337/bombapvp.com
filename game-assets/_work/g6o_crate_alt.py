"""G6o: crateAlt micro-variant — breaks identical crate stamp field.

Edit-chained from tournament-clean crate.png:
- same silhouette / iron cross / alpha pad
- warmer wood tint + shifted grain noise
- iron bands slightly thicker on one axis (micro layout change)
Mean wood tone kept close so checker doesn't create light/dark prop grid.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SRC = OUT / "crate.png"


def mean_rgb_opaque(im: Image.Image) -> float:
    px = im.load()
    w, h = im.size
    total = 0.0
    n = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 128:
                total += (r + g + b) / 3
                n += 1
    return total / max(1, n)


def match_opaque_mean(im: Image.Image, target: float) -> Image.Image:
    cur = mean_rgb_opaque(im)
    if cur < 1e-6:
        return im
    factor = max(0.94, min(1.06, target / cur))
    # Brightness affects alpha channel too if applied naively — split
    rgb = im.convert("RGB")
    alpha = im.getchannel("A")
    rgb = ImageEnhance.Brightness(rgb).enhance(factor)
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def build_alt(base: Image.Image) -> Image.Image:
    im = base.copy().convert("RGBA")
    px = im.load()
    w, h = im.size

    # Warmer wood tint on opaque body (keep iron bands darker)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            # iron/dark hardware: low chroma, low value
            if r + g + b < 220 and abs(r - g) < 25:
                # slight cool shift on iron
                px[x, y] = (
                    max(0, min(255, r - 4)),
                    max(0, min(255, g - 2)),
                    max(0, min(255, b + 2)),
                    a,
                )
            else:
                # wood: warmer + micro grain shift
                n = ((x * 19 + y * 23) % 9) - 4
                px[x, y] = (
                    max(0, min(255, int(r * 1.03) + n + 4)),
                    max(0, min(255, int(g * 0.99) + n)),
                    max(0, min(255, int(b * 0.94) + n // 2 - 2)),
                    a,
                )

    # Soften outer edge alpha (less hard sticker cut) — 1px feather on opaque rim
    # First pass: find edge
    alpha = im.getchannel("A")
    ap = alpha.load()
    feather = alpha.copy()
    fp = feather.load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if ap[x, y] < 200:
                continue
            # if any neighbor is near-transparent, slightly reduce alpha
            neigh = (
                ap[x - 1, y],
                ap[x + 1, y],
                ap[x, y - 1],
                ap[x, y + 1],
            )
            if min(neigh) < 40:
                fp[x, y] = max(0, ap[x, y] - 70)

    im.putalpha(feather)

    # Micro horizontal plank offset: shift wood rows by 1px in mid bands (visual variety)
    # Only on non-iron mid values
    shifted = im.copy()
    sp = shifted.load()
    op = im.load()
    for y in range(20, h - 20):
        if y % 7 == 0:
            for x in range(20, w - 21):
                r, g, b, a = op[x, y]
                if a > 200 and r + g + b > 240:
                    sp[x + 1, y] = (r, g, b, a)
    im = shifted

    # Match mean wood tone to base
    target = mean_rgb_opaque(base.convert("RGBA"))
    im = match_opaque_mean(im, target)
    return im


def make_seam(im: Image.Image, path: Path) -> None:
    w, h = im.size
    canvas = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    for ox, oy in ((0, 0), (w, 0), (0, h), (w, h)):
        canvas.paste(im, (ox, oy), im)
    canvas.save(path, optimize=True)


def downscale_preview(im: Image.Image, path: Path, size: int = 40) -> None:
    p = im.resize((size, size), Image.Resampling.LANCZOS)
    grid = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    for gy in range(4):
        for gx in range(4):
            grid.paste(p, (gx * size, gy * size), p)
    # checker with base for QA
    grid.save(path, optimize=True)


def field_checker(base: Image.Image, alt: Image.Image, path: Path, n: int = 6, cell: int = 40) -> None:
    b = base.resize((cell, cell), Image.Resampling.LANCZOS)
    a = alt.resize((cell, cell), Image.Resampling.LANCZOS)
    field = Image.new("RGBA", (n * cell, n * cell), (40, 38, 35, 255))
    for y in range(n):
        for x in range(n):
            t = a if (x + y) % 2 else b
            field.paste(t, (x * cell, y * cell), t)
    field.save(path, optimize=True)


def main() -> None:
    base = Image.open(SRC).convert("RGBA")
    alt = build_alt(base)
    # alpha corners must stay 0
    px = alt.load()
    w, h = alt.size
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        px[x, y] = (0, 0, 0, 0)

    alt.save(OUT / "crate-alt.png", optimize=True)
    make_seam(alt, OUT / "_seam-crate-alt.png")
    downscale_preview(alt, OUT / "_preview40-crate-alt.png")
    field_checker(base, alt, OUT / "_qa-crate-field.png")

    print(f"base mean={mean_rgb_opaque(base):.1f} alt mean={mean_rgb_opaque(alt):.1f}")
    print(f"corners base={[base.getpixel(p)[3] for p in ((0,0),(127,0),(0,127),(127,127))]}")
    print(f"corners alt ={[alt.getpixel(p)[3] for p in ((0,0),(127,0),(0,127),(127,127))]}")
    print(f"bytes={(OUT / 'crate-alt.png').stat().st_size}")
    print("OK")


if __name__ == "__main__":
    main()
