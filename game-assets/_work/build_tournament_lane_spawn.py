"""Build lane/spawn from floor-base cobble + framed wall already on disk; QA mock."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128


def soft_edge_crossfade(im: Image.Image, band: int = 5) -> Image.Image:
    im = im.convert("RGB")
    w, h = im.size
    arr = im.copy()
    px = arr.load()
    src = im.load()
    for y in range(h):
        for x in range(w):
            d = min(x, y, w - 1 - x, h - 1 - y)
            if d >= band:
                continue
            if x < band or x >= w - band:
                opp = src[w - 1 - x, y]
            else:
                opp = src[x, h - 1 - y]
            t = (band - d) / band * 0.35
            r, g, b = src[x, y]
            or_, og, ob = opp
            px[x, y] = (
                int(r * (1 - t) + or_ * t),
                int(g * (1 - t) + og * t),
                int(b * (1 - t) + ob * t),
            )
    return arr


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


def force_edge_blend(im: Image.Image, band: int = 10) -> Image.Image:
    """Stronger wrap blend to reduce hard tile seams on cobble."""
    im = im.convert("RGB")
    w, h = im.size
    src = im.load()
    out = im.copy()
    px = out.load()
    for y in range(h):
        for x in range(w):
            # distance to nearest edge
            dl, dr, dt, db = x, w - 1 - x, y, h - 1 - y
            d = min(dl, dr, dt, db)
            if d >= band:
                continue
            # average with wrapped counterpart(s)
            samples = [src[x, y]]
            if dl < band:
                samples.append(src[w - 1 - x, y])
            if dr < band:
                samples.append(src[w - 1 - x, y])
            if dt < band:
                samples.append(src[x, h - 1 - y])
            if db < band:
                samples.append(src[x, h - 1 - y])
            t = (band - d) / band * 0.55
            ar = sum(s[0] for s in samples) / len(samples)
            ag = sum(s[1] for s in samples) / len(samples)
            ab = sum(s[2] for s in samples) / len(samples)
            r, g, b = src[x, y]
            px[x, y] = (
                int(r * (1 - t) + ar * t),
                int(g * (1 - t) + ag * t),
                int(b * (1 - t) + ab * t),
            )
    return out


def build_lane(base: Image.Image) -> Image.Image:
    """Brighter cream cobble + thin edge frame for route read."""
    im = ImageEnhance.Brightness(base).enhance(1.12)
    im = ImageEnhance.Color(im).enhance(0.95)
    # cream lift
    cream = Image.new("RGB", im.size, (239, 229, 214))
    im = Image.blend(im, cream, 0.18)
    draw = ImageDraw.Draw(im)
    # thin frame near edges (lane marker)
    margin = 10
    color = (180, 155, 120)
    for i in range(2):
        draw.rectangle(
            [margin + i, margin + i, SIZE - 1 - margin - i, SIZE - 1 - margin - i],
            outline=color,
        )
    return force_edge_blend(im, band=6)


def build_spawn(base: Image.Image) -> Image.Image:
    """Slightly bright cobble + open gold ring."""
    im = ImageEnhance.Brightness(base).enhance(1.08)
    cream = Image.new("RGB", im.size, (247, 239, 224))
    im = Image.blend(im, cream, 0.14)
    draw = ImageDraw.Draw(im)
    cx = cy = SIZE // 2
    r_outer = 38
    r_inner = 33
    # gold ring with soft outer/inner
    for r in range(r_inner, r_outer + 1):
        # mid of band is brightest gold
        mid = (r_inner + r_outer) / 2
        dist = abs(r - mid)
        strength = max(0.0, 1.0 - dist / ((r_outer - r_inner) / 2 + 0.01))
        # #c49e4c
        col = (
            int(196 * strength + 180 * (1 - strength)),
            int(158 * strength + 150 * (1 - strength)),
            int(76 * strength + 100 * (1 - strength)),
        )
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col)
    # slight ring anti-alias
    im = im.filter(ImageFilter.SMOOTH)
    return force_edge_blend(im, band=6)


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
    print("mock written")


def main() -> None:
    base = Image.open(OUT / "floor-base.png").convert("RGB")
    # re-apply stronger seam fix on base
    base = force_edge_blend(base, band=12)
    base.save(OUT / "floor-base.png", optimize=True)
    make_seam(base, OUT / "_seam-floor-base.png")
    downscale_preview(base, OUT / "_preview40-floor-base.png")
    print("floor-base re-seam", (OUT / "floor-base.png").stat().st_size)

    lane = build_lane(base)
    lane.save(OUT / "floor-lane.png", optimize=True)
    make_seam(lane, OUT / "_seam-floor-lane.png")
    downscale_preview(lane, OUT / "_preview40-floor-lane.png")
    print("floor-lane", (OUT / "floor-lane.png").stat().st_size)

    spawn = build_spawn(base)
    spawn.save(OUT / "floor-spawn.png", optimize=True)
    make_seam(spawn, OUT / "_seam-floor-spawn.png")
    downscale_preview(spawn, OUT / "_preview40-floor-spawn.png")
    print("floor-spawn", (OUT / "floor-spawn.png").stat().st_size)

    # wall seam/preview refresh
    wall = Image.open(OUT / "wall.png").convert("RGB")
    make_seam(wall, OUT / "_seam-wall.png")
    downscale_preview(wall, OUT / "_preview40-wall.png")

    rebuild_mock()
    print("OK")


if __name__ == "__main__":
    main()
