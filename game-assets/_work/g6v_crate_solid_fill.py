"""G6v: crate solid cell fill (pad 7→3) + gentler rim; re-scale alt + break.

G6r expanded pad 15→6, but soft_rim still ate ~1px and opaque fill stayed
~76% (pad≈7). Multi-crate fields show cream floor seams → sticker grid.

Target pad=3 (~1px @40) with lighter alpha feather so breakables fill cells
without hard square corners.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
BREAK = Path(r"C:\projetos\bombpvp\game-assets\gameplay\crates\break")
SIZE = 128
# Expand body to pad=1; gentle feather lands opaque pad≈2–3 (~0.9 fill).
TARGET_PAD = 1


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


def soft_rim(im: Image.Image) -> Image.Image:
    """1px outer feather only — keep body solid for multi-crate fields."""
    alpha = im.getchannel("A")
    ap = alpha.load()
    w, h = alpha.size
    new_a = alpha.copy()
    npx = new_a.load()
    for y in range(h):
        for x in range(w):
            a = ap[x, y]
            if a < 8:
                continue
            # Only true border pixels (min edge distance 0 or 1 into content)
            edge = min(x, y, w - 1 - x, h - 1 - y)
            if edge == 0:
                npx[x, y] = 0
            elif edge == 1 and a > 40:
                npx[x, y] = min(a, 140)
    out = im.copy()
    out.putalpha(new_a)
    px = out.load()
    for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        px[p] = (0, 0, 0, 0)
    return out


def expand_fill(im: Image.Image, target_pad: int = TARGET_PAD) -> Image.Image:
    im = im.convert("RGBA")
    x0, y0, x1, y1 = opaque_bbox(im)
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    tw = SIZE - 2 * target_pad
    th = SIZE - 2 * target_pad
    scaled = crop.resize((tw, th), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(scaled, (target_pad, target_pad), scaled)
    return soft_rim(out)


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
    """Micro-variant wood tint/grain; tight mean-match to base."""
    im = base.copy().convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            if r + g + b < 220 and abs(r - g) < 25:
                # iron bands — slight cool shift
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
    for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
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
    base_src = Image.open(OUT / "crate.png").convert("RGBA")
    old_pad, old_fill = fill_metrics(base_src)
    print(f"before pad≈{old_pad} fill>200={old_fill:.3f}")

    crate = expand_fill(base_src, TARGET_PAD)
    crate.save(OUT / "crate.png", optimize=True)
    make_seam(crate, OUT / "_seam-crate.png")
    crate.resize((40, 40), Image.Resampling.LANCZOS).save(OUT / "_preview40-crate.png", optimize=True)
    crate.resize((40, 40), Image.Resampling.LANCZOS).save(OUT / "_qa-crate40.png", optimize=True)

    alt = soft_rim(build_alt(crate))
    alt.save(OUT / "crate-alt.png", optimize=True)
    make_seam(alt, OUT / "_seam-crate-alt.png")
    alt.resize((40, 40), Image.Resampling.LANCZOS).save(OUT / "_preview40-crate-alt.png", optimize=True)

    for i in range(4):
        p = BREAK / f"crate-break-{i}.png"
        if not p.exists():
            continue
        fr = expand_fill(Image.open(p).convert("RGBA"), TARGET_PAD)
        fr.save(p, optimize=True)
        print(f"break {i} bytes={p.stat().st_size}")

    crate_field(crate, alt, OUT / "_qa-crate-field.png", n=4)

    pad, fill = fill_metrics(crate)
    pad_a, fill_a = fill_metrics(alt)
    print(f"after crate pad≈{pad} fill>200={fill:.3f}")
    print(f"after alt   pad≈{pad_a} fill>200={fill_a:.3f}")
    print(f"mean opaque crate={mean_rgb_opaque(crate):.2f} alt={mean_rgb_opaque(alt):.2f}")
    print(f"corners {[crate.getpixel(p)[3] for p in ((0, 0), (127, 0), (0, 127), (127, 127))]}")
    print(f"crate bytes={(OUT / 'crate.png').stat().st_size} alt={(OUT / 'crate-alt.png').stat().st_size}")
    print("OK")


if __name__ == "__main__":
    main()
