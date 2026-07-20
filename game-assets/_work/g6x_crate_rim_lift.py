"""G6x: lift painted outer crate rim so multi-crate fields don't grid.

G6w full-bleed pushed the dark iron outer frame to the cell edge.
Adjacent crates met dark+dark → heavy sticker grid across breakable fields.

Keep iron cross-bands + corner brackets; lift only the outer perimeter frame
toward local wood so cell joins read as continuous wood mass.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
BREAK = Path(r"C:\projetos\bombpvp\game-assets\gameplay\crates\break")
SIZE = 128
# Outer frame band (px from edge) to lift toward wood
RIM = 6
# How much of the dark rim to keep (0=full wood, 1=keep original)
RIM_KEEP = 0.08


def is_cross_band(x: int, y: int, size: int = SIZE) -> bool:
    """True on iron cross + end plates (do not lift these)."""
    mid = size // 2
    # Vertical / horizontal band thickness
    half_w = 9
    half_h = 9
    on_v = abs(x - mid) <= half_w
    on_h = abs(y - mid) <= half_h
    # Full cross arms
    if on_v or on_h:
        # Outer rim segment of the cross arms is still iron — keep
        return True
    # Corner brackets sit near corners along the outer frame ends of bands.
    # Already covered when on_v/on_h near edges. Extra: small corner plates.
    return False


def wood_palette(im: Image.Image) -> tuple[float, float, float]:
    """Mean wood color from bright interior (avoid iron)."""
    px = im.load()
    rs = gs = bs = 0.0
    n = 0
    for y in range(18, SIZE - 18):
        for x in range(18, SIZE - 18):
            if is_cross_band(x, y):
                continue
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            L = (r + g + b) / 3
            if L < 70:
                continue  # iron / shadow
            rs += r
            gs += g
            bs += b
            n += 1
    if n < 10:
        return (130.0, 88.0, 55.0)
    return (rs / n, gs / n, bs / n)


def lift_rim(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    out = im.copy()
    px = out.load()
    wr, wg, wb = wood_palette(im)
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            e = min(x, y, SIZE - 1 - x, SIZE - 1 - y)
            if e >= RIM:
                continue
            if is_cross_band(x, y):
                continue
            L = (r + g + b) / 3
            # Lift any non-bright wood in the rim band (outer frame is dark brown/black)
            if L > 115:
                continue
            # Soft falloff: stronger lift at outer edge
            t = 1.0 - (e / max(1, RIM - 1))  # 1 at edge, ~0 near RIM
            t = max(0.0, min(1.0, t))
            # Target: wood with slight darker bevel only
            bevel = 0.92 + 0.06 * (1.0 - t)
            tr = wr * bevel
            tg = wg * bevel
            tb = wb * bevel
            # Nearly full replace at outer edge
            blend = (1.0 - RIM_KEEP) * (0.72 + 0.28 * t)
            nr = int(max(0, min(255, r * (1 - blend) + tr * blend)))
            ng = int(max(0, min(255, g * (1 - blend) + tg * blend)))
            nb = int(max(0, min(255, b * (1 - blend) + tb * blend)))
            px[x, y] = (nr, ng, nb, a)
    # Keep corners keyable
    for p in ((0, 0), (SIZE - 1, 0), (0, SIZE - 1), (SIZE - 1, SIZE - 1)):
        px[p] = (0, 0, 0, 0)
    return out


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


def edge_L(im: Image.Image, depth: int = 0) -> float:
    a = list(im.convert("RGB").getdata())
    # mean of edge pixels at depth
    s = 0.0
    n = 0
    for y in range(SIZE):
        for x in range(SIZE):
            e = min(x, y, SIZE - 1 - x, SIZE - 1 - y)
            if e == depth:
                r, g, b = a[y * SIZE + x]
                s += (r + g + b) / 3
                n += 1
    return s / max(1, n)


def main() -> None:
    src = Image.open(OUT / "crate.png").convert("RGBA")
    print(f"before edge0 L={edge_L(src, 0):.1f} edge2 L={edge_L(src, 2):.1f} inner={mean_rgb_opaque(src):.1f}")

    crate = lift_rim(src)
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
        fr = lift_rim(Image.open(bp).convert("RGBA"))
        fr.save(bp, optimize=True)
        print(f"break {i} bytes={bp.stat().st_size}")

    crate_field(crate, alt, OUT / "_qa-crate-field.png", n=4)

    print(f"after  edge0 L={edge_L(crate, 0):.1f} edge2 L={edge_L(crate, 2):.1f} inner={mean_rgb_opaque(crate):.1f}")
    print(f"mean op crate={mean_rgb_opaque(crate):.2f} alt={mean_rgb_opaque(alt):.2f}")
    # join metric on field
    import numpy as np

    cf = np.array(Image.open(OUT / "_qa-crate-field.png").convert("RGB"), dtype=float)
    print(f"field join L x39-41={[round(float(cf[:, x].mean()), 1) for x in (38, 39, 40, 41)]}")
    print(f"corners {[crate.getpixel(p)[3] for p in ((0, 0), (127, 0), (0, 127), (127, 127))]}")
    print("OK")


if __name__ == "__main__":
    main()
