"""G6s: baseAlt2 + baseAlt3 — 4-way floor layout variation (mean-matched).

game-tilesets: 2–3 anonymous variants break motif better than one checker.
Keep same mean brightness as base so multi-way pick doesn't create tone grid.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

from PIL import Image, ImageEnhance

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
SIZE = 128

# Reuse G6l cobble generator
spec = importlib.util.spec_from_file_location(
    "g6l",
    Path(__file__).with_name("g6l_floor_match_alt.py"),
)
assert spec and spec.loader
g6l = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g6l)


def mean_rgb(im: Image.Image) -> float:
    return g6l.mean_rgb(im)


def make_seam(im: Image.Image, path: Path) -> None:
    g6l.make_seam(im, path)


def downscale_preview(im: Image.Image, path: Path) -> None:
    g6l.downscale_preview(im, path)


def main() -> None:
    base = Image.open(OUT / "floor-base.png").convert("RGB")
    target = mean_rgb(base)
    print(f"base mean={target:.2f}")

    # Distinct seeds far from base(45) and alt(87)
    specs = [
        ("floor-base-alt2.png", 120, 150),
        ("floor-base-alt3.png", 160, 190),
    ]
    alts: list[Image.Image] = [base, Image.open(OUT / "floor-base-alt.png").convert("RGB")]
    for name, s0, s1 in specs:
        im, seed, d = g6l.pick_best(s0, s1, n_stones=44)
        im = g6l.match_mean_brightness(im, target)
        im.save(OUT / name, optimize=True)
        make_seam(im, OUT / f"_seam-{name.replace('.png', '')}.png")
        downscale_preview(im, OUT / f"_preview40-{name.replace('.png', '')}.png")
        print(f"{name} seed={seed} seam={d} mean={mean_rgb(im):.2f}")
        alts.append(im)

    # 4-way field QA using (x + 2*y) % 4
    cell = 40
    scaled = [a.resize((cell, cell), Image.Resampling.LANCZOS) for a in alts]
    n = 8
    field = Image.new("RGB", (n * cell, n * cell))
    for y in range(n):
        for x in range(n):
            field.paste(scaled[(x + 2 * y) % 4], (x * cell, y * cell))
    field.save(OUT / "_qa-floor-field-4way.png", optimize=True)

    means = [mean_rgb(a.resize((cell, cell), Image.Resampling.LANCZOS)) for a in alts]
    print("cell means", [round(m, 2) for m in means], "max-min", round(max(means) - min(means), 2))
    print("OK")


if __name__ == "__main__":
    main()
