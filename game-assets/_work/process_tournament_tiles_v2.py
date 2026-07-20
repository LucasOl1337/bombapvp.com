"""Install tournament-clean v2 floor-base + wall; keep lane/spawn/crate; rebuild mock."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

SESSION = Path(
    r"C:\Users\user\.grok\sessions\C%3A%5Cprojetos%5Cbombpvp"
    r"\019f7b20-da2f-7602-8609-f18525f50a3f\images"
)
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
    grid = Image.new(im.mode, (size * 4, size * 4))
    for gy in range(4):
        for gx in range(4):
            grid.paste(p, (gx * size, gy * size))
    grid.save(path, optimize=True)


def install(name: str, src: Path, floor: bool = False) -> Image.Image:
    im = Image.open(src).resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    if floor:
        im = soft_edge_crossfade(im)
    im = im.convert("RGB")
    out = OUT / name
    im.save(out, optimize=True)
    make_seam(im, OUT / f"_seam-{name}")
    downscale_preview(im, OUT / f"_preview40-{name}")
    print(f"wrote {name} bytes={out.stat().st_size}")
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
    path = OUT / "_preview-arena-mock.png"
    mock.save(path, optimize=True)
    print("mock", path)


def main() -> None:
    install("floor-base.png", SESSION / "1.jpg", floor=True)
    install("wall.png", SESSION / "2.jpg", floor=False)
    rebuild_mock()
    print("OK")


if __name__ == "__main__":
    main()
