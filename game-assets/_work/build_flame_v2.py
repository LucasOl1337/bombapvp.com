"""Build flame-anim 6x4 sheet from Imagine keyframes (chroma + interpolate)."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

SRC = Path(
    r"C:\Users\user\.grok\sessions\C%3A%5Cprojetos%5Cbombpvp"
    r"\019f7aa2-1047-72f1-828b-0e119f193b9c\images"
)
WORK = Path(r"game-assets/_work/flame-v2")
OUT_FRAMES = Path(r"game-assets/gameplay/bomb/explosion/frames")
OUT_SHEET = Path(r"game-assets/gameplay/bomb/explosion/flame-anim-sheet-v1.png")
OUT_STATIC = Path(r"game-assets/gameplay/bomb/explosion/flame.png")
BOMB_PATH = Path(r"game-assets/gameplay/bomb/sprites/bomb.png")

WORK.mkdir(parents=True, exist_ok=True)
OUT_FRAMES.mkdir(parents=True, exist_ok=True)

CELL = 256
COLS, ROWS = 6, 4
FRAME_COUNT = COLS * ROWS  # 24

KEY_FILES = {
    "birth": "30.jpg",
    "medium": "33.jpg",
    "large": "36.jpg",
    "peak": "29.jpg",
    "roil": "34.jpg",
    "dissipate": "32.jpg",
    "gone": "35.jpg",
}


def chroma_key_green(im: Image.Image, tol: int = 55) -> Image.Image:
    """Convert pure-ish green chroma to alpha; keep fire colors."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            green_score = g - max(r, b)
            if g > 90 and green_score > 28 and r < 120 and b < 120:
                if green_score > tol or (g > 140 and r < 80 and b < 80):
                    opx[x, y] = (0, 0, 0, 0)
                else:
                    alpha = max(0, min(255, int(255 * (1 - green_score / tol))))
                    g2 = min(g, max(r, b) + 10)
                    opx[x, y] = (r, g2, b, alpha)
            else:
                if g > r + 20 and g > b + 20 and max(r, b) < 180:
                    excess = g - max(r, b)
                    g2 = max(r, b) + 8
                    a2 = max(0, a - excess // 2)
                    opx[x, y] = (r, g2, b, a2)
                else:
                    opx[x, y] = (r, g, b, a)
    return out


def content_bbox(im: Image.Image, alpha_thresh: int = 12):
    a = im.split()[-1]
    return a.point(lambda v: 255 if v > alpha_thresh else 0).getbbox()


def center_on_canvas(im: Image.Image, size: int = CELL, pad_frac: float = 0.08) -> Image.Image:
    im = im.convert("RGBA")
    bb = content_bbox(im)
    if not bb:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cropped = im.crop(bb)
    cw, ch = cropped.size
    max_dim = max(cw, ch)
    target = int(size * (1 - 2 * pad_frac))
    scale = target / max_dim
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def alpha_blend(a: Image.Image, b: Image.Image, t: float) -> Image.Image:
    t = max(0.0, min(1.0, t))
    if t <= 0:
        return a.copy()
    if t >= 1:
        return b.copy()
    ar = a.convert("RGBA")
    br = b.convert("RGBA")
    out = Image.new("RGBA", ar.size)
    ap = ar.load()
    bp = br.load()
    op = out.load()
    w, h = ar.size
    for y in range(h):
        for x in range(w):
            r1, g1, b1, a1 = ap[x, y]
            r2, g2, b2, a2 = bp[x, y]
            aa1, aa2 = a1 / 255.0, a2 / 255.0
            ao = aa1 * (1 - t) + aa2 * t
            if ao < 1e-6:
                op[x, y] = (0, 0, 0, 0)
            else:
                r = (r1 * aa1 * (1 - t) + r2 * aa2 * t) / ao
                g = (g1 * aa1 * (1 - t) + g2 * aa2 * t) / ao
                bch = (b1 * aa1 * (1 - t) + b2 * aa2 * t) / ao
                op[x, y] = (int(r), int(g), int(bch), int(ao * 255))
    return out


def scale_content(im: Image.Image, factor: float) -> Image.Image:
    if abs(factor - 1.0) < 0.01:
        return im.copy()
    w, h = im.size
    nw, nh = max(1, int(w * factor)), max(1, int(h * factor))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(resized, ((w - nw) // 2, (h - nh) // 2), resized)
    return canvas


def rotate_content(im: Image.Image, degrees: float) -> Image.Image:
    if abs(degrees) < 0.5:
        return im.copy()
    return im.rotate(
        degrees,
        resample=Image.Resampling.BICUBIC,
        expand=False,
        fillcolor=(0, 0, 0, 0),
    )


def mul_alpha(im: Image.Image, factor: float) -> Image.Image:
    r, g, b, a = im.split()
    a = a.point(lambda v: int(max(0, min(255, v * factor))))
    return Image.merge("RGBA", (r, g, b, a))


def main() -> None:
    print("Chroma-keying and centering keys...")
    keys: dict[str, Image.Image] = {}
    for name, fn in KEY_FILES.items():
        raw = Image.open(SRC / fn)
        keyed = chroma_key_green(raw)
        keyed = keyed.filter(ImageFilter.MedianFilter(size=3))
        r, g, b, a = keyed.split()
        a = a.point(lambda v: 0 if v < 10 else v)
        keyed = Image.merge("RGBA", (r, g, b, a))
        centered = center_on_canvas(keyed, CELL)
        keys[name] = centered
        centered.save(WORK / f"key-{name}.png")
        print(f"  {name}: bbox={content_bbox(centered)}")

    # (frame_index, key_name, scale, rot_deg, alpha)
    anchors = [
        (0, "birth", 1.00, 0, 1.00),
        (2, "birth", 1.25, 8, 1.00),
        (4, "medium", 1.00, 0, 1.00),
        (6, "large", 0.95, 12, 1.00),
        (8, "peak", 1.00, 0, 1.00),
        (10, "roil", 1.02, -15, 1.00),
        (12, "peak", 1.05, 10, 1.00),
        (14, "roil", 1.00, 20, 0.95),
        (16, "dissipate", 1.00, 0, 0.90),
        (18, "dissipate", 0.85, 5, 0.65),
        (20, "gone", 0.90, 0, 0.50),
        (22, "gone", 0.55, 0, 0.30),
        (23, "gone", 0.30, 0, 0.12),
    ]

    print("Building 24 frames...")
    frames: list[Image.Image] = []
    for i in range(FRAME_COUNT):
        if i <= anchors[0][0]:
            _, n0, s0, r0, a0 = anchors[0]
            img = mul_alpha(scale_content(rotate_content(keys[n0], r0), s0), a0)
        elif i >= anchors[-1][0]:
            _, n0, s0, r0, a0 = anchors[-1]
            img = mul_alpha(scale_content(rotate_content(keys[n0], r0), s0), a0)
        else:
            img = None
            for j in range(len(anchors) - 1):
                i0, n0, s0, r0, a0 = anchors[j]
                i1, n1, s1, r1, a1 = anchors[j + 1]
                if i0 <= i <= i1:
                    t = 0.0 if i1 == i0 else (i - i0) / (i1 - i0)
                    t = t * t * (3 - 2 * t)
                    A = mul_alpha(scale_content(rotate_content(keys[n0], r0), s0), a0)
                    B = mul_alpha(scale_content(rotate_content(keys[n1], r1), s1), a1)
                    img = alpha_blend(A, B, t)
                    break
            assert img is not None
        if 6 <= i <= 14:
            pulse = 1.0 + 0.03 * math.sin(i * 1.7)
            img = scale_content(img, pulse)
        frames.append(img)
        path = OUT_FRAMES / f"flame-anim-{i:02d}.png"
        img.save(path, optimize=True)
        print(f"  frame {i:02d} -> {path.name} bytes={path.stat().st_size}")

    print("Compositing sheet...")
    sheet = Image.new("RGBA", (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
    for idx, fr in enumerate(frames):
        col = idx % COLS
        row = idx // COLS
        sheet.paste(fr, (col * CELL, row * CELL), fr)
    sheet.save(OUT_SHEET, optimize=True)
    print(f"Sheet: {OUT_SHEET} size={sheet.size} bytes={OUT_SHEET.stat().st_size}")

    peak64 = keys["peak"].resize((64, 64), Image.Resampling.LANCZOS)
    peak64 = ImageEnhance.Contrast(peak64).enhance(1.08)
    peak64 = ImageEnhance.Color(peak64).enhance(1.1)
    peak64.save(OUT_STATIC, optimize=True)
    print(f"Static flame: {OUT_STATIC} size={peak64.size}")

    preview = sheet.resize((CELL * COLS // 2, CELL * ROWS // 2), Image.Resampling.LANCZOS)
    prev_bg = Image.new("RGBA", preview.size, (20, 20, 28, 255))
    prev_bg.paste(preview, (0, 0), preview)
    prev_bg.convert("RGB").save(WORK / "preview-sheet.jpg", quality=90)
    print(f"Preview: {WORK / 'preview-sheet.jpg'}")

    # Bomb fuse spark on ORIGINAL top-down body (no AI re-projection)
    print("Enhancing bomb fuse spark on original top-down bomb...")
    bomb = Image.open(BOMB_PATH).convert("RGBA")
    draw = ImageDraw.Draw(bomb, "RGBA")
    cx, cy = 32, 10
    for radius, col in [
        (7, (255, 140, 40, 40)),
        (5, (255, 180, 60, 70)),
        (3, (255, 220, 100, 140)),
        (2, (255, 250, 200, 200)),
        (1, (255, 255, 255, 230)),
    ]:
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=col)
    for ang in (0, 45, 90, 135, 180, 225, 270, 315):
        rad = math.radians(ang)
        x2 = cx + math.cos(rad) * 6
        y2 = cy + math.sin(rad) * 6
        draw.line([(cx, cy), (x2, y2)], fill=(255, 200, 80, 160), width=1)
    bomb.save(BOMB_PATH, optimize=True)
    print(f"Bomb: {BOMB_PATH} size={bomb.size} bytes={BOMB_PATH.stat().st_size}")

    assert sheet.size == (CELL * COLS, CELL * ROWS)
    # alpha check corners of sheet
    c0 = sheet.getpixel((0, 0))
    assert c0[3] == 0, f"sheet corner not transparent: {c0}"
    print("DONE OK")


if __name__ == "__main__":
    main()
