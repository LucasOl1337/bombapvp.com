"""G6w: crate full-bleed cell fill — no soft perimeter hairline.

G6v pad≈3 still zeroed the full outer ring (soft_rim edge==0 → α=0).
At TILE_SIZE=40 multi-crate fields showed cream floor hairlines between cells.

Fix: expand body to pad=0, force opaque interior, transparent only on the
four corner pixels (keyable corners for non-grid draw paths). Keep iron-rim
silhouette painted in the art, not via empty alpha pad.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
BREAK = Path(r"C:\projetos\bombpvp\game-assets\gameplay\crates\break")
SIZE = 128


def opaque_bbox(im: Image.Image, thr: int = 16) -> tuple[int, int, int, int]:
    px = im.load()
    w, h = im.size
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > thr:
                xs.append(x)
                ys.append(y)
    if not xs:
        return (0, 0, w - 1, h - 1)
    return (min(xs), min(ys), max(xs), max(ys))


def fullbleed(im: Image.Image) -> Image.Image:
    """Scale solid body to full tile; α=255 everywhere except 4 corners."""
    im = im.convert("RGBA")
    # thr=200: crop only solid wood/iron, drop soft-rim fringe before scale
    x0, y0, x1, y1 = opaque_bbox(im, thr=200)
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    # Flatten crop alpha so LANCZOS doesn't reintroduce soft edges from partial α
    cpx = crop.load()
    cw, ch = crop.size
    for y in range(ch):
        for x in range(cw):
            r, g, b, a = cpx[x, y]
            cpx[x, y] = (r, g, b, 255 if a > 200 else 0)
    scaled = crop.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    # Force full α (drop LANCZOS edge bleed) then key corners only
    px = scaled.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, _a = px[x, y]
            px[x, y] = (r, g, b, 255)
    for p in ((0, 0), (SIZE - 1, 0), (0, SIZE - 1), (SIZE - 1, SIZE - 1)):
        px[p] = (0, 0, 0, 0)
    return scaled


def mean_rgb_opaque(im: Image.Image) -> float:
    px = im.load()
    total = 0.0
    n = 0
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = px[x, y]
            if a > 128:
                total += (r + g + b) / 3
                n += 1
    return total / max(1, n)


def build_alt(base: Image.Image) -> Image.Image:
    im = base.copy().convert("RGBA")
    px = im.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            if r + g + b < 220 and abs(r - g) < 25:
                px[x, y] = (
                    max(0, min(255, r - 3)),
                    max(0, min(255, g - 1)),
                    max(0, min(255, b + 2)),
                    a,
                )
            else:
                n = ((x * 19 + y * 23) % 7) - 3
                px[x, y] = (
                    max(0, min(255, int(r * 1.02) + n + 2)),
                    max(0, min(255, int(g * 0.995) + n)),
                    max(0, min(255, int(b * 0.96) + n // 2 - 1)),
                    a,
                )
    target = mean_rgb_opaque(base)
    cur = mean_rgb_opaque(im)
    factor = max(0.97, min(1.03, target / max(1e-6, cur)))
    rgb = ImageEnhance.Brightness(im.convert("RGB")).enhance(factor)
    alpha = im.getchannel("A")
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    px = out.load()
    for p in ((0, 0), (SIZE - 1, 0), (0, SIZE - 1), (SIZE - 1, SIZE - 1)):
        px[p] = (0, 0, 0, 0)
    return out


def make_seam(im: Image.Image, path: Path) -> None:
    w, h = im.size
    canvas = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    for ox, oy in ((0, 0), (w, 0), (0, h), (w, h)):
        canvas.paste(im, (ox, oy), im)
    canvas.save(path, optimize=True)


def crate_field(crate: Image.Image, alt: Image.Image, path: Path, n: int = 4) -> None:
    floor = Image.open(OUT / "floor-base.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    c40 = crate.resize((40, 40), Image.Resampling.LANCZOS)
    a40 = alt.resize((40, 40), Image.Resampling.LANCZOS)
    field = Image.new("RGBA", (40 * n, 40 * n), (0, 0, 0, 255))
    for y in range(n):
        for x in range(n):
            field.paste(floor, (x * 40, y * 40), floor)
            t = a40 if (x + y) % 2 else c40
            field.paste(t, (x * 40, y * 40), t)
    field.save(path, optimize=True)


def fill_metrics(im: Image.Image, thr: int = 200) -> tuple[int, float]:
    px = im.load()
    xs = [x for y in range(SIZE) for x in range(SIZE) if px[x, y][3] > thr]
    ys = [y for y in range(SIZE) for x in range(SIZE) if px[x, y][3] > thr]
    if not xs:
        return (-1, 0.0)
    pad = min(min(xs), min(ys), SIZE - 1 - max(xs), SIZE - 1 - max(ys))
    fill = sum(1 for y in range(SIZE) for x in range(SIZE) if px[x, y][3] > thr) / (SIZE * SIZE)
    return pad, fill


def main() -> None:
    src = Image.open(OUT / "crate.png").convert("RGBA")
    old_pad, old_fill = fill_metrics(src)
    print(f"before pad≈{old_pad} fill={old_fill:.3f}")

    crate = fullbleed(src)
    crate.save(OUT / "crate.png", optimize=True)
    make_seam(crate, OUT / "_seam-crate.png")
    crate.resize((40, 40), Image.Resampling.LANCZOS).save(OUT / "_preview40-crate.png", optimize=True)
    crate.resize((40, 40), Image.Resampling.LANCZOS).save(OUT / "_qa-crate40.png", optimize=True)

    alt = build_alt(crate)
    alt.save(OUT / "crate-alt.png", optimize=True)
    make_seam(alt, OUT / "_seam-crate-alt.png")
    alt.resize((40, 40), Image.Resampling.LANCZOS).save(OUT / "_preview40-crate-alt.png", optimize=True)

    for i in range(4):
        bp = BREAK / f"crate-break-{i}.png"
        if not bp.exists():
            continue
        fr = fullbleed(Image.open(bp).convert("RGBA"))
        fr.save(bp, optimize=True)
        print(f"break {i} bytes={bp.stat().st_size}")

    crate_field(crate, alt, OUT / "_qa-crate-field.png", n=4)

    pad, fill = fill_metrics(crate)
    # 40px pair seam check on black
    c40 = crate.resize((40, 40), Image.Resampling.LANCZOS)
    pair = Image.new("RGBA", (80, 40), (0, 0, 0, 255))
    pair.paste(c40, (0, 0), c40)
    pair.paste(c40, (40, 0), c40)
    import numpy as np

    pa = np.array(pair)
    print(f"after pad≈{pad} fill={fill:.3f}")
    print(f"mean op crate={mean_rgb_opaque(crate):.2f} alt={mean_rgb_opaque(alt):.2f}")
    print(f"pair A@39-41 mean={[round(float(pa[:, x, 3].mean()), 1) for x in (38, 39, 40, 41)]}")
    print(f"pair RGB@39-41 mean={[round(float(pa[:, x, :3].mean()), 1) for x in (38, 39, 40, 41)]}")
    print(f"corners {[crate.getpixel(p)[3] for p in ((0, 0), (127, 0), (0, 127), (127, 127))]}")
    print("OK")


if __name__ == "__main__":
    main()
