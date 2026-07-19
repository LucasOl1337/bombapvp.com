from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

SESSION = Path(
    r"C:\Users\user\.grok\sessions\C%3A%5Cprojetos%5Cbombpvp\019f7791-95d9-79d3-8d5d-621417345f1a\images"
)
ROOT = Path(r"C:\projetos\bombpvp")
WORK = ROOT / "game-assets/creative-workshop/rounds/2026-07-18/1905-bomb-flame-blast"
FRAMES = ROOT / "game-assets/gameplay/bomb/explosion/frames"
GAME_EXP = ROOT / "game-assets/gameplay/bomb/explosion"
FX_EXP = ROOT / "game-assets/effects/explosions"

WORK.mkdir(parents=True, exist_ok=True)
FRAMES.mkdir(parents=True, exist_ok=True)

shutil.copy2(SESSION / "10.jpg", WORK / "source-sheet-v1.jpg")
shutil.copy2(SESSION / "11.jpg", WORK / "source-peak-v1.jpg")


def remove_chroma(im: Image.Image, t_lo: float = 18, t_hi: float = 70) -> Image.Image:
    arr = np.asarray(im.convert("RGB"), dtype=np.int16)
    border = np.concatenate([arr[0], arr[-1], arr[:, 0], arr[:, -1]], axis=0)
    key = np.median(border, axis=0).astype(np.float64)
    diff = np.max(np.abs(arr.astype(np.float64) - key), axis=2)
    g = arr[:, :, 1].astype(np.float64)
    r = arr[:, :, 0].astype(np.float64)
    b = arr[:, :, 2].astype(np.float64)
    dominance = g - np.maximum(r, b)

    alpha = np.clip((diff - t_lo) / max(1.0, t_hi - t_lo), 0, 1)
    alpha = np.where((dominance > 30) & (diff < 120), alpha * 0.1, alpha)
    alpha = np.where(diff <= t_lo, 0.0, alpha)
    alpha = np.where(diff >= t_hi, np.maximum(alpha, 0.95), alpha)
    a8 = (alpha * 255).astype(np.uint8)

    out = np.zeros((*arr.shape[:2], 4), dtype=np.uint8)
    out[:, :, :3] = np.clip(arr, 0, 255).astype(np.uint8)
    spill = (a8 > 0) & (a8 < 245) & (dominance > 6)
    g2 = out[:, :, 1].astype(np.float64)
    cap = np.maximum(out[:, :, 0], out[:, :, 2]).astype(np.float64) + 6
    g2 = np.where(spill, np.minimum(g2, cap), g2)
    out[:, :, 1] = np.clip(g2, 0, 255).astype(np.uint8)
    out[:, :, 3] = a8
    return Image.fromarray(out, "RGBA")


def clean_green(im: Image.Image) -> Image.Image:
    a = np.asarray(im.convert("RGBA")).copy()
    r, g, b, al = a[:, :, 0].astype(np.int16), a[:, :, 1].astype(np.int16), a[:, :, 2].astype(np.int16), a[:, :, 3]
    keyish = (g > r + 20) & (g > b + 20) & (g > 80) & (al > 0)
    kill = keyish & (g > 130) & (r < 130)
    al = al.copy()
    al[kill] = 0
    mild = keyish & ~kill
    g2 = g.astype(np.float32)
    g2[mild] = np.minimum(g2[mild], np.maximum(r, b)[mild].astype(np.float32) + 4)
    fringe = (al > 0) & (al < 35) & (g > r + 12) & (g > b + 12)
    al[fringe] = 0
    out = a.copy()
    out[:, :, 1] = np.clip(g2, 0, 255).astype(np.uint8)
    out[:, :, 3] = al
    return Image.fromarray(out, "RGBA")


def content_square(im: Image.Image, size: int, pad: float = 0.1) -> Image.Image:
    a = np.asarray(im.split()[-1])
    ys, xs = np.where(a > 16)
    if len(xs) == 0:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    side = int(max(x1 - x0, y1 - y0) * (1 + pad * 2))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    left, top = int(round(cx - side / 2)), int(round(cy - side / 2))
    right, bottom = left + side, top + side
    canvas = Image.new(
        "RGBA",
        (max(right, im.width) - min(left, 0) + 8, max(bottom, im.height) - min(top, 0) + 8),
        (0, 0, 0, 0),
    )
    ox, oy = -min(left, 0) + 4, -min(top, 0) + 4
    canvas.paste(im, (ox, oy), im)
    l2, t2 = left - min(left, 0) + 4, top - min(top, 0) + 4
    cropped = canvas.crop((l2, t2, l2 + side, t2 + side))
    return cropped.resize((size, size), Image.Resampling.LANCZOS)


def split_sheet(path: Path, cols: int = 4, rows: int = 4, inset: int = 3):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    cw, ch = w // cols, h // rows
    cells = []
    for r in range(rows):
        for c in range(cols):
            cells.append(im.crop((c * cw + inset, r * ch + inset, (c + 1) * cw - inset, (r + 1) * ch - inset)))
    return cells


def main() -> None:
    raw = split_sheet(WORK / "source-sheet-v1.jpg")
    keyed = [clean_green(remove_chroma(c)) for c in raw]
    peak = clean_green(remove_chroma(Image.open(WORK / "source-peak-v1.jpg")))

    # Peak frames in middle of sequence (indices 5-8 of 16)
    keyed[6] = peak
    keyed[7] = peak

    cell = 256
    base = [content_square(k, cell) for k in keyed]

    dense: list[Image.Image] = []
    for i, fr in enumerate(base):
        dense.append(fr)
        if i < len(base) - 1 and i % 2 == 0:
            dense.append(Image.blend(fr, base[i + 1], 0.5))
    if len(dense) > 24:
        idxs = [round(i * (len(dense) - 1) / 23) for i in range(24)]
        dense = [dense[i] for i in idxs]
    while len(dense) < 24:
        dense.append(dense[-1].copy())

    for i, fr in enumerate(dense):
        fr.save(FRAMES / f"flame-anim-{i:02d}.png", "PNG", optimize=True)

    cols, rows = 6, 4
    sheet = Image.new("RGBA", (cell * cols, cell * rows), (0, 0, 0, 0))
    for i, fr in enumerate(dense):
        sheet.paste(fr, ((i % cols) * cell, (i // cols) * cell), fr)

    sheet_path = GAME_EXP / "flame-anim-sheet-v1.png"
    fx_path = FX_EXP / "bomb-explosion-anim-sheet-v1.png"
    sheet.save(sheet_path, "PNG", optimize=True)
    sheet.save(fx_path, "PNG", optimize=True)

    # Static fallback = mid peak frame
    dense[8].resize((128, 128), Image.Resampling.LANCZOS).save(GAME_EXP / "flame.png", "PNG", optimize=True)

    # Preview GIF
    gif = []
    for fr in dense:
        bg = Image.new("RGBA", (128, 128), (18, 14, 22, 255))
        bg.alpha_composite(fr.resize((128, 128), Image.Resampling.LANCZOS))
        gif.append(bg.convert("P", palette=Image.Palette.ADAPTIVE, colors=255))
    gif[0].save(
        WORK / "preview-blast-v1.gif",
        save_all=True,
        append_images=gif[1:],
        duration=40,
        loop=0,
        disposal=2,
    )
    sheet.resize((sheet.width // 2, sheet.height // 2), Image.Resampling.LANCZOS).save(
        WORK / "preview-contact-v1.png", "PNG"
    )

    sa = np.asarray(sheet)
    residual = int(((sa[:, :, 3] > 0) & (sa[:, :, 1] > 160) & (sa[:, :, 0] < 90) & (sa[:, :, 2] < 90)).sum())
    opaque = [
        int((np.asarray(Image.open(FRAMES / f"flame-anim-{i:02d}.png"))[:, :, 3] > 180).sum())
        for i in range(24)
    ]
    print("sheet", sheet.size, sheet_path.stat().st_size)
    print("opaque", opaque)
    print("residual", residual)
    print("sha", hashlib.sha256(sheet_path.read_bytes()).hexdigest()[:16])
    print("done")


if __name__ == "__main__":
    main()
