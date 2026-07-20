"""G6e: stronger lane contrast + install richer wall if provided; rebuild mock."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128
SESSION_WALL = Path(
    r"C:\Users\user\.grok\sessions\C%3A%5Cprojetos%5Cbombpvp"
    r"\019f7b20-da2f-7602-8609-f18525f50a3f\images"
)
# Will also scan latest session for wall candidate via env / known path


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


def strengthen_lane(base: Image.Image) -> Image.Image:
    """Brighter cream lift + thicker edge frame for route readability at 40px."""
    im = ImageEnhance.Brightness(base).enhance(1.16)
    im = ImageEnhance.Contrast(im).enhance(1.05)
    cream = Image.new("RGB", im.size, (245, 236, 220))
    im = Image.blend(im, cream, 0.28)
    draw = ImageDraw.Draw(im)
    # thicker double frame
    for margin, color in (
        (8, (150, 125, 90)),
        (9, (190, 165, 120)),
        (10, (150, 125, 90)),
    ):
        draw.rectangle(
            [margin, margin, SIZE - 1 - margin, SIZE - 1 - margin],
            outline=color,
        )
    return im


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
    print("mock ok")


def install_wall(src: Path) -> None:
    im = Image.open(src).resize((SIZE, SIZE), Image.Resampling.LANCZOS).convert("RGB")
    # slight darken if too light
    im = ImageEnhance.Brightness(im).enhance(0.92)
    im = ImageEnhance.Contrast(im).enhance(1.08)
    im.save(OUT / "wall.png", optimize=True)
    make_seam(im, OUT / "_seam-wall.png")
    downscale_preview(im, OUT / "_preview40-wall.png")
    print("wall", (OUT / "wall.png").stat().st_size, "from", src)


def main() -> None:
    # lane from floor-base
    base = Image.open(OUT / "floor-base.png").convert("RGB")
    lane = strengthen_lane(base)
    lane.save(OUT / "floor-lane.png", optimize=True)
    make_seam(lane, OUT / "_seam-floor-lane.png")
    downscale_preview(lane, OUT / "_preview40-floor-lane.png")
    print("lane", (OUT / "floor-lane.png").stat().st_size)

    # wall from latest session image if caller passes via argv
    import sys
    if len(sys.argv) > 1:
        install_wall(Path(sys.argv[1]))
    rebuild_mock()
    print("OK")


if __name__ == "__main__":
    main()
