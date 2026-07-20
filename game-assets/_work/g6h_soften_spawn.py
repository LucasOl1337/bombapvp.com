"""G6h: quieter spawn tile so 3x3 spawn bays don't look like gold polka-dots."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128


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


def build_quiet_spawn(base: Image.Image) -> Image.Image:
    """
    Spawn bay tile: slight cream lift + soft low-contrast ring.
    9 of these in a 3x3 corner should read as a protected zone, not 9 bullseyes.
    """
    im = ImageEnhance.Brightness(base).enhance(1.06)
    cream = Image.new("RGB", im.size, (247, 239, 224))
    im = Image.blend(im, cream, 0.10)

    # Soft gold wash via alpha overlay ring (thin + translucent)
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx = cy = SIZE // 2
    # outer soft ring band
    for r, a in (
        (40, 40),
        (39, 70),
        (38, 90),
        (37, 70),
        (36, 40),
    ):
        # #c49e4c with alpha
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            outline=(196, 158, 76, a),
        )
    # tiny center dash (orientation only, not loud)
    draw.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(196, 158, 76, 35))

    base_rgba = im.convert("RGBA")
    out = Image.alpha_composite(base_rgba, overlay).convert("RGB")
    out = out.filter(ImageFilter.SMOOTH)
    return out


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
    # simulate 3x3 spawn bay noise at corners
    for y in range(1, 4):
        for x in range(1, 4):
            mock.paste(spawn, (x * 40, y * 40), spawn)
    for y in range(2, n - 2):
        for x in range(2, n - 2):
            if x % 2 == 1 and y % 2 == 1 and x != n // 2 and y != n // 2:
                mock.paste(crate, (x * 40, y * 40), crate)
    mock.save(OUT / "_preview-arena-mock.png", optimize=True)


def main() -> None:
    base = Image.open(OUT / "floor-base.png").convert("RGB")
    spawn = build_quiet_spawn(base)
    spawn.save(OUT / "floor-spawn.png", optimize=True)
    make_seam(spawn, OUT / "_seam-floor-spawn.png")
    downscale_preview(spawn, OUT / "_preview40-floor-spawn.png")
    print("spawn", (OUT / "floor-spawn.png").stat().st_size)
    rebuild_mock()
    print("OK")


if __name__ == "__main__":
    main()
