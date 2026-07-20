"""G6y: flatten edge tone on floor-base-alt / alt3 (kill residual cell-edge grid).

game-tilesets §1: large-scale tone gradients that create checkerboarding = fail.
base edge−inner ≈1.6; alt/alt3 ≈4.8–5.0 (brighter border ring) → faint 4-way grid.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128
# Soft edge band to rebalance toward inner mean
BAND = 10


def edge_inner(rgb: np.ndarray) -> tuple[float, float, float]:
    h, w, _ = rgb.shape
    edge = np.concatenate(
        [rgb[0], rgb[-1], rgb[1:-1, 0], rgb[1:-1, -1]]
    ).mean()
    inner = rgb[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4].mean()
    return float(edge), float(inner), float(abs(edge - inner))


def flatten_edge(im: Image.Image, band: int = BAND) -> Image.Image:
    """Scale pixels near tile edge so border mean ≈ inner mean (soft falloff)."""
    arr = np.array(im.convert("RGB"), dtype=np.float32)
    h, w, _ = arr.shape
    yy, xx = np.mgrid[0:h, 0:w]
    e = np.minimum(np.minimum(xx, yy), np.minimum(w - 1 - xx, h - 1 - yy)).astype(np.float32)

    edge_m, inner_m, _ = edge_inner(arr)
    if abs(edge_m - inner_m) < 1.2:
        return im.convert("RGB")

    # Target: pull edge mean to inner mean. Per-pixel scale with falloff in band.
    # scale_at_edge = inner/edge so mean moves; blend by (1 - e/band)
    if edge_m < 1e-3:
        return im.convert("RGB")
    scale = inner_m / edge_m
    # limit extreme correction
    scale = float(np.clip(scale, 0.94, 1.06))

    fall = np.clip(1.0 - (e / band), 0.0, 1.0)  # 1 at edge, 0 beyond band
    # Only apply when current local tendency matches global (brighter or darker edge)
    factor = 1.0 + (scale - 1.0) * fall
    out = arr * factor[..., None]
    out = np.clip(out, 0, 255).astype(np.uint8)
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


def rebuild_4way_field() -> None:
    alts = [
        Image.open(OUT / n).convert("RGB")
        for n in (
            "floor-base.png",
            "floor-base-alt.png",
            "floor-base-alt2.png",
            "floor-base-alt3.png",
        )
    ]
    cell = 40
    scaled = [a.resize((cell, cell), Image.Resampling.LANCZOS) for a in alts]
    n = 8
    field = Image.new("RGB", (n * cell, n * cell))
    for y in range(n):
        for x in range(n):
            field.paste(scaled[(x + 2 * y) % 4], (x * cell, y * cell))
    field.save(OUT / "_qa-floor-field-4way.png", optimize=True)
    means = [float(np.array(s, dtype=float).mean()) for s in scaled]
    print("cell means", [round(m, 2) for m in means], "spread", round(max(means) - min(means), 2))


def mean_rgb(im: Image.Image) -> float:
    return float(np.array(im.convert("RGB"), dtype=float).mean())


def main() -> None:
    base = Image.open(OUT / "floor-base.png").convert("RGB")
    target_mean = mean_rgb(base)
    print(f"base mean={target_mean:.2f} ei={edge_inner(np.array(base, dtype=np.float32))[2]:.2f}")

    for name in ("floor-base-alt.png", "floor-base-alt3.png"):
        src = Image.open(OUT / name).convert("RGB")
        e0, i0, d0 = edge_inner(np.array(src, dtype=np.float32))
        flat = flatten_edge(src)
        # re-match global mean to base (edge scale can shift overall slightly)
        cur = mean_rgb(flat)
        if cur > 1e-6:
            factor = float(np.clip(target_mean / cur, 0.97, 1.03))
            arr = np.clip(np.array(flat, dtype=np.float32) * factor, 0, 255).astype(np.uint8)
            flat = Image.fromarray(arr, mode="RGB")
        e1, i1, d1 = edge_inner(np.array(flat, dtype=np.float32))
        flat.save(OUT / name, optimize=True)
        make_seam(flat, OUT / f"_seam-{name.replace('.png', '')}.png")
        downscale_preview(flat, OUT / f"_preview40-{name.replace('.png', '')}.png")
        print(f"{name}: ei {d0:.2f}->{d1:.2f} (border {e0:.1f}->{e1:.1f}, inner {i0:.1f}->{i1:.1f}) mean={mean_rgb(flat):.2f}")

    rebuild_4way_field()
    print("OK")


if __name__ == "__main__":
    main()
