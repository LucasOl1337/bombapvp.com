"""Remake v5 — processa bases IA (Grok image_gen 1024px) em tiles 256px engine-ready.

Entrada (game-assets/_work/tile-remake/): src-floor.png, src-wall.png, src-crate.png
Saida: game-assets/arenas/themes/tournament-clean/ + GameMechanics/assets/arena/tournament-clean/
QA:   game-assets/_work/tile-remake/qa/ (seams 2x2 + arena mock @48px)
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

WORK = Path(r"C:\projetos\bombpvp\game-assets\_work\tile-remake")
THEME = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\tournament-clean")
LAB = Path(r"C:\projetos\bombpvp\GameMechanics\assets\arena\tournament-clean")
QA = WORK / "qa"
QA.mkdir(parents=True, exist_ok=True)

SIZE = 256
LANCZOS = Image.Resampling.LANCZOS


def make_seamless(im: Image.Image, band: int = 96) -> Image.Image:
    """Toroidal: rola metade (costuras viram cruz central) e blend suave na cruz."""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    h, w = a.shape[:2]
    rolled = np.roll(np.roll(a, h // 2, axis=0), w // 2, axis=1)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx = np.abs(xx - w / 2)
    dy = np.abs(yy - h / 2)
    d = np.minimum(dx, dy)
    t = np.clip(d / band, 0.0, 1.0)
    t = t * t * (3 - 2 * t)  # smoothstep
    mask = t[..., None]
    out = rolled * mask + a * (1.0 - mask)
    return Image.fromarray(out.astype(np.uint8), "RGB")


def grade_toward(im: Image.Image, target: tuple[int, int, int], max_gain: float = 0.12) -> Image.Image:
    """Ajusta media por canal na direcao do alvo (ganho limitado)."""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    mean = a.reshape(-1, 3).mean(axis=0)
    tgt = np.array(target, dtype=np.float32)
    gain = np.clip((tgt - mean) / np.maximum(mean, 1.0), -max_gain, max_gain)
    out = np.clip(a * (1.0 + gain), 0, 255)
    return Image.fromarray(out.astype(np.uint8), "RGB")


def match_mean(im: Image.Image, ref: Image.Image) -> Image.Image:
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    r = np.asarray(ref.convert("RGB")).astype(np.float32)
    diff = r.reshape(-1, 3).mean(axis=0) - a.reshape(-1, 3).mean(axis=0)
    return Image.fromarray(np.clip(a + diff, 0, 255).astype(np.uint8), "RGB")


def crop_inset(im: Image.Image, frac: float) -> Image.Image:
    w, h = im.size
    m = int(w * frac)
    return im.crop((m, m, w - m, h - m))


def seam_preview(im: Image.Image, path: Path) -> None:
    w, h = im.size
    canvas = Image.new("RGB", (w * 2, h * 2))
    for ox, oy in ((0, 0), (w, 0), (0, h), (w, h)):
        canvas.paste(im.convert("RGB"), (ox, oy))
    canvas.save(path, optimize=True)


GOLD = (0xC4, 0x9E, 0x4C)


def draw_ring(base: Image.Image, dashed: bool) -> Image.Image:
    """Redesenha os aneis (crisp @256): spawn = anel solido; portal = 2 aneis tracejados."""
    from PIL import ImageDraw

    im = base.convert("RGB").copy()
    dr = ImageDraw.Draw(im)
    c = SIZE // 2

    def ring(r: int, width: int, dash: bool) -> None:
        bbox = (c - r, c - r, c + r, c + r)
        if not dash:
            dr.ellipse(bbox, outline=GOLD, width=width)
            return
        step, on = 30, 18  # graus: 18 desenhado, 12 de gap
        for start in range(0, 360, step):
            dr.arc(bbox, start=start, end=start + on, fill=GOLD, width=width)

    if dashed:
        ring(int(SIZE * 0.34), 6, dash=True)
        ring(int(SIZE * 0.24), 6, dash=True)
    else:
        ring(int(SIZE * 0.32), 8, dash=False)
    return im


def main() -> None:
    # ---------- FLOOR ----------
    src_floor = Image.open(WORK / "src-floor.png")
    floor512 = make_seamless(src_floor).resize((512, 512), LANCZOS)
    floor512 = grade_toward(floor512, (0xD8, 0xD0, 0xC2))

    crops = {
        "floor-base.png": (0, 0),
        "floor-base-alt.png": (256, 0),
        "floor-base-alt2.png": (0, 256),
        "floor-base-alt3.png": (256, 256),
    }
    floors: dict[str, Image.Image] = {}
    for name, (ox, oy) in crops.items():
        floors[name] = floor512.crop((ox, oy, ox + SIZE, oy + SIZE))
    base = floors["floor-base.png"]
    for name in ("floor-base-alt.png", "floor-base-alt2.png", "floor-base-alt3.png"):
        floors[name] = match_mean(floors[name], base)

    # lane: lift cream puro (sem escurecer borda)
    a = np.asarray(base).astype(np.float32)
    cream = np.array((0xF4, 0xEC, 0xD8), dtype=np.float32)
    lane = np.clip(a * 0.68 + cream * 0.32, 0, 255)
    lane = np.clip(lane * 1.05, 0, 255).astype(np.uint8)
    floors["floor-lane.png"] = Image.fromarray(lane, "RGB")

    floors["floor-spawn.png"] = draw_ring(base, dashed=False)
    floors["floor-portal.png"] = draw_ring(base, dashed=True)

    # ---------- WALL ----------
    src_wall = Image.open(WORK / "src-wall.png")
    wall = crop_inset(src_wall.convert("RGB"), 0.03).resize((SIZE, SIZE), LANCZOS)
    wall_alt = match_mean(wall.rotate(-90, expand=True), wall)

    # ---------- CRATE ----------
    src_crate = Image.open(WORK / "src-crate.png")
    crate_rgb = crop_inset(src_crate.convert("RGB"), 0.02).resize((SIZE, SIZE), LANCZOS)
    crate = crate_rgb.convert("RGBA")  # full-bleed, alpha 255
    alt_arr = np.asarray(crate_rgb.transpose(Image.Transpose.FLIP_LEFT_RIGHT)).astype(np.float32)
    alt_arr = np.clip(alt_arr * 1.015 + 1.5, 0, 255).astype(np.uint8)
    crate_alt = Image.fromarray(alt_arr, "RGB").convert("RGBA")

    out: dict[str, Image.Image] = {
        **floors,
        "wall.png": wall,
        "wall-alt.png": wall_alt,
        "crate.png": crate,
        "crate-alt.png": crate_alt,
    }

    # ---------- grava nos 2 destinos ----------
    for name, im in out.items():
        for dest in (THEME, LAB):
            im.save(dest / name, optimize=True)
        print(f"wrote {name} {im.size} {im.mode}")

    # ---------- QA ----------
    seam_preview(base, QA / "_seam-floor-base.png")
    seam_preview(floors["floor-base-alt.png"], QA / "_seam-floor-alt.png")
    seam_preview(wall, QA / "_seam-wall.png")
    seam_preview(crate_rgb, QA / "_seam-crate.png")

    t = 48
    n = 11
    small = {k: v.convert("RGBA").resize((t, t), LANCZOS) for k, v in out.items()}
    mock = Image.new("RGBA", (n * t, n * t), (10, 12, 16, 255))
    variants = ["floor-base.png", "floor-base-alt.png", "floor-base-alt2.png", "floor-base-alt3.png"]
    for y in range(n):
        for x in range(n):
            if (x, y) in ((2, 2), (2, n - 3), (n - 3, 2), (n - 3, n - 3)):
                tile = small["floor-spawn.png"]
            elif x == n // 2 or y == n // 2:
                tile = small["floor-lane.png"]
            elif (x + y) % 7 == 0 and 0 < x < n - 1 and 0 < y < n - 1:
                tile = small["wall.png"] if (x + y) % 2 == 0 else small["wall-alt.png"]
            elif (x * 3 + y) % 5 == 0:
                tile = small["crate.png"] if (x + y) % 2 == 0 else small["crate-alt.png"]
            else:
                tile = small[variants[(x + 2 * y) % 4]]
            mock.paste(tile, (x * t, y * t), tile)
    mock.paste(small["floor-portal.png"], (5 * t, 5 * t), small["floor-portal.png"])
    mock.save(QA / "_preview-arena-mock.png", optimize=True)
    print("QA em", QA)
    print("OK")


if __name__ == "__main__":
    main()
