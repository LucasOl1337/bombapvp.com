"""G6z: flatten wall / wallAlt edge bands to shared face mean.

Post-G6u continuous walls still had opposite edge bias:
  wall edge L≈60.8 (brighter) vs wall-alt edge L≈57.9 (darker)
Checker (x+y)%2 then paints a light/dark join lattice (field join delta ~6.9).

Soft-scale outer band toward shared target face mean; keep interior masonry.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128
BAND = 8


def edge_inner_L(rgb: np.ndarray) -> tuple[float, float, float]:
    h, w, _ = rgb.shape
    edge = np.concatenate([rgb[0], rgb[-1], rgb[1:-1, 0], rgb[1:-1, -1]]).mean()
    inner = rgb[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4].mean()
    return float(edge), float(inner), float(abs(edge - inner))


def flatten_to_target(im: Image.Image, target_L: float, band: int = BAND) -> Image.Image:
    arr = np.array(im.convert("RGB"), dtype=np.float32)
    h, w, _ = arr.shape
    yy, xx = np.mgrid[0:h, 0:w]
    e = np.minimum(np.minimum(xx, yy), np.minimum(w - 1 - xx, h - 1 - yy)).astype(np.float32)

    # Per-pixel luminance
    L = arr.mean(axis=2)
    # Only touch band; scale toward target_L where falloff applies
    fall = np.clip(1.0 - (e / band), 0.0, 1.0)
    # Avoid divide-by-zero on near-black
    safe_L = np.maximum(L, 1.0)
    scale = target_L / safe_L
    scale = np.clip(scale, 0.90, 1.12)
    factor = 1.0 + (scale - 1.0) * fall
    out = arr * factor[..., None]
    out = np.clip(out, 0, 255).astype(np.uint8)
    return Image.fromarray(out, mode="RGB")


def mean_match(im: Image.Image, target: float) -> Image.Image:
    arr = np.array(im.convert("RGB"), dtype=np.float32)
    cur = float(arr.mean())
    if cur < 1e-6:
        return im.convert("RGB")
    factor = float(np.clip(target / cur, 0.96, 1.04))
    out = np.clip(arr * factor, 0, 255).astype(np.uint8)
    return Image.fromarray(out, mode="RGB")


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


def wall_field(wall: Image.Image, alt: Image.Image, path: Path, n: int = 4) -> None:
    w40 = wall.resize((40, 40), Image.Resampling.LANCZOS)
    a40 = alt.resize((40, 40), Image.Resampling.LANCZOS)
    field = Image.new("RGB", (40 * n, 40 * n))
    for y in range(n):
        for x in range(n):
            t = a40 if (x + y) % 2 else w40
            field.paste(t, (x * 40, y * 40))
    field.save(path, optimize=True)


def rebuild_mock() -> None:
    base = Image.open(OUT / "floor-base.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    base_alt = Image.open(OUT / "floor-base-alt.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    lane = Image.open(OUT / "floor-lane.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    spawn = Image.open(OUT / "floor-spawn.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    wall = Image.open(OUT / "wall.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    wall_alt = Image.open(OUT / "wall-alt.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    crate = Image.open(OUT / "crate.png").convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
    n = 11
    mock = Image.new("RGBA", (n * 40, n * 40), (0, 0, 0, 255))
    for y in range(n):
        for x in range(n):
            if x == 0 or y == 0 or x == n - 1 or y == n - 1:
                t = wall_alt if (x + y) % 2 else wall
            elif (x, y) in ((2, 2), (2, n - 3), (n - 3, 2), (n - 3, n - 3)):
                t = spawn
            elif x == n // 2 or y == n // 2:
                t = lane
            else:
                t = base_alt if (x + y) % 2 else base
            mock.paste(t, (x * 40, y * 40), t)
    for cx, cy in ((3, 3), (4, 3), (3, 4), (7, 7), (7, 8), (8, 7)):
        t = wall_alt if (cx + cy) % 2 else wall
        mock.paste(t, (cx * 40, cy * 40), t)
    for y in range(2, n - 2):
        for x in range(2, n - 2):
            if x % 2 == 1 and y % 2 == 1 and x != n // 2 and y != n // 2:
                if (x, y) not in ((3, 3), (7, 7)):
                    mock.paste(crate, (x * 40, y * 40), crate)
    mock.save(OUT / "_preview-arena-mock.png", optimize=True)


def main() -> None:
    wall = Image.open(OUT / "wall.png").convert("RGB")
    alt = Image.open(OUT / "wall-alt.png").convert("RGB")
    wa = np.array(wall, dtype=np.float32)
    aa = np.array(alt, dtype=np.float32)

    # Shared target = average of both inner faces (keeps charcoal family)
    _, w_inner, w_ei0 = edge_inner_L(wa)
    _, a_inner, a_ei0 = edge_inner_L(aa)
    target_face = (w_inner + a_inner) / 2.0
    target_global = (float(wa.mean()) + float(aa.mean())) / 2.0
    print(f"target face L={target_face:.2f} global={target_global:.2f}")
    print(f"before wall ei={w_ei0:.2f} alt ei={a_ei0:.2f}")

    wall2 = flatten_to_target(wall, target_face)
    alt2 = flatten_to_target(alt, target_face)
    # Global mean-match both to same target so checker has no tone grid
    wall2 = mean_match(wall2, target_global)
    alt2 = mean_match(alt2, target_global)

    wall2.save(OUT / "wall.png", optimize=True)
    alt2.save(OUT / "wall-alt.png", optimize=True)
    make_seam(wall2, OUT / "_seam-wall.png")
    make_seam(alt2, OUT / "_seam-wall-alt.png")
    downscale_preview(wall2, OUT / "_preview40-wall.png")
    downscale_preview(alt2, OUT / "_preview40-wall-alt.png")
    w40 = wall2.resize((40, 40), Image.Resampling.LANCZOS)
    w40.save(OUT / "_qa-wall40.png", optimize=True)
    cluster = Image.new("RGB", (80, 80))
    for ox, oy in ((0, 0), (40, 0), (0, 40), (40, 40)):
        cluster.paste(w40, (ox, oy))
    cluster.save(OUT / "_preview40-wall-cluster.png", optimize=True)
    wall_field(wall2, alt2, OUT / "_qa-wall-field.png", n=4)
    rebuild_mock()

    wa2 = np.array(wall2, dtype=np.float32)
    aa2 = np.array(alt2, dtype=np.float32)
    we, wi, w_ei = edge_inner_L(wa2)
    ae, ai, a_ei = edge_inner_L(aa2)
    print(f"after  wall ei={w_ei:.2f} border={we:.1f} inner={wi:.1f} mean={wa2.mean():.2f}")
    print(f"after  alt  ei={a_ei:.2f} border={ae:.1f} inner={ai:.1f} mean={aa2.mean():.2f}")

    wf = np.array(Image.open(OUT / "_qa-wall-field.png").convert("RGB"), dtype=float)
    print(f"field join |L39-L40|={abs(wf[:, 39].mean() - wf[:, 40].mean()):.2f}")
    print("OK")


if __name__ == "__main__":
    main()
