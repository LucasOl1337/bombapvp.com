"""Process tournament-clean Imagine outputs into engine-ready 128px tiles."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

SESSION = Path(
    r"C:\Users\user\.grok\sessions\C%3A%5Cprojetos%5Cbombpvp"
    r"\019f7b1c-464c-74a1-94ef-588366fdc4b2\images"
)
OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
OUT.mkdir(parents=True, exist_ok=True)

SOURCES = {
    "floor-base.png": SESSION / "1.jpg",
    "floor-lane.png": SESSION / "4.jpg",
    "floor-spawn.png": SESSION / "5.jpg",
    "wall.png": SESSION / "6.jpg",
    "crate.png": SESSION / "2.jpg",
}
SIZE = 128


def soft_edge_crossfade(im: Image.Image, band: int = 5) -> Image.Image:
    """Mild edge blend so 2x2 seams are softer (floors only)."""
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


def key_black_to_alpha(im: Image.Image, thr: int = 30) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if r <= thr and g <= thr and b <= thr:
                px[x, y] = (r, g, b, 0)
    return im


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


def main() -> None:
    crate_info: dict | None = None
    for name, src in SOURCES.items():
        if not src.exists():
            raise SystemExit(f"missing source: {src}")
        im = Image.open(src)
        im = im.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        if name.startswith("floor"):
            im = soft_edge_crossfade(im, band=5).convert("RGB")
        elif name == "wall.png":
            im = im.convert("RGB")
        elif name == "crate.png":
            im = key_black_to_alpha(im, thr=30)
            alpha = im.split()[-1]
            corners = [
                alpha.getpixel((0, 0)),
                alpha.getpixel((SIZE - 1, 0)),
                alpha.getpixel((0, SIZE - 1)),
                alpha.getpixel((SIZE - 1, SIZE - 1)),
            ]
            px = im.load()
            black = 0
            for y in range(SIZE):
                for x in range(SIZE):
                    r, g, b, aa = px[x, y]
                    if aa > 200 and r < 15 and g < 15 and b < 15:
                        black += 1
            crate_info = {
                "corners": corners,
                "black_opaque": black,
                "mode": im.mode,
            }
            if any(c > 10 for c in corners):
                raise SystemExit(f"crate corners not transparent: {corners}")
            if black > 0:
                raise SystemExit(f"crate has opaque black leftovers: {black}")

        out_path = OUT / name
        im.save(out_path, optimize=True)
        make_seam(im, OUT / f"_seam-{name}")
        downscale_preview(im, OUT / f"_preview40-{name}")
        print(f"wrote {out_path.name} size={im.size} mode={im.mode} bytes={out_path.stat().st_size}")

    print("crate checks:", crate_info)

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
    mock_path = OUT / "_preview-arena-mock.png"
    mock.save(mock_path, optimize=True)
    print("mock written", mock_path)
    print("OK")


if __name__ == "__main__":
    main()
