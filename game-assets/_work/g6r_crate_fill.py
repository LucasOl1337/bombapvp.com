"""G6r: expand crate fill (pad 15→6) + soft rim; re-scale alt + break frames.

Breakables looked floaty in-cell (opaque only ~77% of tile). Scale body larger,
soft-feather outer alpha so less hard sticker cut. Keep RGBA corners 0.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
BREAK = Path(r"C:\projetos\bombpvp\game-assets\gameplay\crates\break")
SIZE = 128
TARGET_PAD = 6  # was 15


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


def expand_fill(im: Image.Image, target_pad: int = TARGET_PAD) -> Image.Image:
    im = im.convert("RGBA")
    x0, y0, x1, y1 = opaque_bbox(im)
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    # target content size
    tw = SIZE - 2 * target_pad
    th = SIZE - 2 * target_pad
    scaled = crop.resize((tw, th), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(scaled, (target_pad, target_pad), scaled)
    return soft_rim(out)


def soft_rim(im: Image.Image, feather: int = 2) -> Image.Image:
    """Slightly soften hard outer opaque edge (not full blur of content)."""
    alpha = im.getchannel("A")
    # erode-ish: reduce alpha on pixels that border near-transparent
    ap = alpha.load()
    w, h = alpha.size
    new_a = alpha.copy()
    npx = new_a.load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            a = ap[x, y]
            if a < 40:
                continue
            neigh = (ap[x - 1, y], ap[x + 1, y], ap[x, y - 1], ap[x, y + 1])
            if min(neigh) < 30:
                npx[x, y] = max(0, a - 90)
            elif min(neigh) < 80:
                npx[x, y] = max(0, a - 40)
    # light smooth on alpha only
    new_a = new_a.filter(ImageFilter.SMOOTH)
    out = im.copy()
    out.putalpha(new_a)
    # force corners transparent
    px = out.load()
    for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        px[p] = (0, 0, 0, 0)
    return out


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


def build_alt(base: Image.Image) -> Image.Image:
    """Edit-chain micro-variant (same as G6o spirit) on expanded crate."""
    im = base.copy().convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            if r + g + b < 220 and abs(r - g) < 25:
                px[x, y] = (
                    max(0, min(255, r - 4)),
                    max(0, min(255, g - 2)),
                    max(0, min(255, b + 2)),
                    a,
                )
            else:
                n = ((x * 19 + y * 23) % 9) - 4
                px[x, y] = (
                    max(0, min(255, int(r * 1.03) + n + 4)),
                    max(0, min(255, int(g * 0.99) + n)),
                    max(0, min(255, int(b * 0.94) + n // 2 - 2)),
                    a,
                )
    # match mean
    target = mean_rgb_opaque(base)
    cur = mean_rgb_opaque(im)
    factor = max(0.94, min(1.06, target / max(1e-6, cur)))
    rgb = ImageEnhance.Brightness(im.convert("RGB")).enhance(factor)
    alpha = im.getchannel("A")
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    px = out.load()
    for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        px[p] = (0, 0, 0, 0)
    return out


def make_seam(im: Image.Image, path: Path) -> None:
    w, h = im.size
    canvas = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    for ox, oy in ((0, 0), (w, 0), (0, h), (w, h)):
        canvas.paste(im, (ox, oy), im)
    canvas.save(path, optimize=True)


def main() -> None:
    base_src = Image.open(OUT / "crate.png").convert("RGBA")
    x0, y0, x1, y1 = opaque_bbox(base_src)
    old_pad = min(x0, y0, SIZE - 1 - x1, SIZE - 1 - y1)
    print(f"old pad≈{old_pad} bbox=({x0},{y0})-({x1},{y1})")

    crate = expand_fill(base_src, TARGET_PAD)
    crate.save(OUT / "crate.png", optimize=True)
    make_seam(crate, OUT / "_seam-crate.png")
    crate.resize((40, 40), Image.Resampling.LANCZOS).save(OUT / "_preview40-crate.png", optimize=True)

    alt = build_alt(crate)
    alt = soft_rim(alt)  # keep soft edge on alt too
    alt.save(OUT / "crate-alt.png", optimize=True)
    make_seam(alt, OUT / "_seam-crate-alt.png")
    alt.resize((40, 40), Image.Resampling.LANCZOS).save(OUT / "_preview40-crate-alt.png", optimize=True)

    # break frames: same expand
    for i in range(4):
        p = BREAK / f"crate-break-{i}.png"
        if not p.exists():
            continue
        fr = expand_fill(Image.open(p).convert("RGBA"), TARGET_PAD)
        fr.save(p, optimize=True)
        print(f"break {i} bytes={p.stat().st_size}")

    # metrics
    px = crate.load()
    xs = [x for y in range(SIZE) for x in range(SIZE) if px[x, y][3] > 200]
    ys = [y for y in range(SIZE) for x in range(SIZE) if px[x, y][3] > 200]
    print(f"new pad LRTB {min(xs)} {min(ys)} {SIZE-1-max(xs)} {SIZE-1-max(ys)}")
    print(f"fill {(max(xs)-min(xs)+1)/SIZE:.3f}")
    print(f"corners {[crate.getpixel(p)[3] for p in ((0,0),(127,0),(0,127),(127,127))]}")
    print(f"crate bytes={ (OUT/'crate.png').stat().st_size} alt={(OUT/'crate-alt.png').stat().st_size}")
    print("OK")


if __name__ == "__main__":
    main()
