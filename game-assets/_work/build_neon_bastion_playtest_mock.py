"""Neon Bastion playtest showcase mock (1280x800) — presentation only.

Composes a fake game screen: Nex Dark page backdrop, sketched top HUD bar
(big central timer "84", slots), 11x9 arena with the generated tiles,
character sprites + bomb with simple elliptical shadows.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(r"C:\projetos\bombpvp")
THEME = ROOT / "game-assets" / "arenas" / "themes" / "neon-bastion"
PLAYERS = ROOT / "public" / "Assets" / "Characters" / "Animations" / "default-players"
BOMB = ROOT / "game-assets" / "gameplay" / "bomb" / "sprites" / "bomb.png"
OUT = THEME / "_playtest-mock.png"

W, H = 1280, 800
COLS, ROWS = 11, 9
TILE = 62
HUD_H = 74

CYAN = (34, 199, 244)
CYAN_BRIGHT = (104, 221, 255)
TEXT = (245, 244, 239)
MUTED = (154, 163, 178)
EMBER = (255, 111, 60)


def tile(name: str) -> Image.Image:
    return Image.open(THEME / name).convert("RGBA").resize(
        (TILE, TILE), Image.Resampling.LANCZOS)


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except OSError:
            continue
    return ImageFont.load_default()


def elliptical_shadow(layer: Image.Image, cx: int, cy: int, rx: int, ry: int,
                      alpha: int = 110) -> None:
    sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(0, 0, 0, alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(4))
    layer.alpha_composite(sh)


def main() -> None:
    page = Image.new("RGBA", (W, H), (4, 6, 11, 255))

    # page backdrop: subtle cyan radial at top + vignette
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    for r in range(420, 0, -6):
        a = int(26 * (1 - r / 420) ** 2)
        dg.ellipse([W // 2 - r * 2, -r - 140, W // 2 + r * 2, r - 140],
                   fill=CYAN + (a,))
    page.alpha_composite(glow.filter(ImageFilter.GaussianBlur(30)))
    vig = Image.new("L", (W, H), 0)
    dv = ImageDraw.Draw(vig)
    dv.ellipse([-260, -180, W + 260, H + 180], fill=110)
    vig = vig.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    page = Image.composite(page, dark, vig.point(lambda v: 255 - v))

    arena_w, arena_h = COLS * TILE, ROWS * TILE
    ax, ay = (W - arena_w) // 2, HUD_H + (H - HUD_H - arena_h) // 2 + 8

    # arena frame glow (cold cyan, diluted)
    frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    df = ImageDraw.Draw(frame)
    df.rectangle([ax - 12, ay - 12, ax + arena_w + 12, ay + arena_h + 12],
                 outline=CYAN + (70,), width=2)
    df.rectangle([ax - 5, ay - 5, ax + arena_w + 5, ay + arena_h + 5],
                 outline=CYAN_BRIGHT + (46,), width=1)
    page.alpha_composite(frame.filter(ImageFilter.GaussianBlur(2)))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle(
        [ax - 14, ay - 8, ax + arena_w + 14, ay + arena_h + 22], fill=(0, 0, 0, 130))
    page.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))

    # --- arena tiles ---
    floors = [tile("floor-base.png"), tile("floor-base-alt.png"),
              tile("floor-base-alt2.png"), tile("floor-base-alt3.png")]
    lane = tile("floor-lane.png")
    spawn = tile("floor-spawn.png")
    wall = tile("wall.png")
    wall_alt = tile("wall-alt.png")
    crate = tile("crate.png")
    crate_alt = tile("crate-alt.png")
    spawns = {(1, 1), (1, ROWS - 2), (COLS - 2, 1), (COLS - 2, ROWS - 2)}
    crates = {(3, 1), (7, 1), (5, 2), (1, 3), (9, 3), (3, 5), (7, 5),
              (5, 6), (2, 7), (8, 7), (5, 4)}
    for y in range(ROWS):
        for x in range(COLS):
            if x == 0 or y == 0 or x == COLS - 1 or y == ROWS - 1:
                t = wall_alt if (x + y) % 2 else wall
            elif x % 2 == 0 and y % 2 == 0:
                t = wall_alt if (x + y) % 2 else wall
            elif (x, y) in spawns:
                t = spawn
            elif x == COLS // 2 or y == ROWS // 2:
                t = lane
            else:
                t = floors[(x + 2 * y) % 4]
            page.paste(t, (ax + x * TILE, ay + y * TILE), t)
    for (x, y) in crates:
        c = crate_alt if (x + y) % 2 else crate
        page.paste(c, (ax + x * TILE, ay + y * TILE), c)

    # --- actors (bomb + players) with elliptical shadows ---
    def cell_center(x: int, y: int) -> tuple[int, int]:
        return ax + x * TILE + TILE // 2, ay + y * TILE + TILE // 2

    bx, by = cell_center(4, 3)
    elliptical_shadow(page, bx, by + 18, 20, 7)
    bomb = Image.open(BOMB).convert("RGBA").resize((44, 44), Image.Resampling.LANCZOS)
    page.alpha_composite(bomb, (bx - 22, by - 24))

    for px_, py_, sprite in ((3, 3, "player1-south.png"), (7, 6, "player2-south.png")):
        cx, cy = cell_center(px_, py_)
        elliptical_shadow(page, cx, cy + 26, 26, 8)
        spr = Image.open(PLAYERS / sprite).convert("RGBA").resize(
            (70, 70), Image.Resampling.LANCZOS)
        page.alpha_composite(spr, (cx - 35, cy - 48))

    # --- HUD bar ---
    hud = Image.new("RGBA", (W, HUD_H), (0, 0, 0, 0))
    dh = ImageDraw.Draw(hud)
    dh.rectangle([0, 0, W, HUD_H], fill=(8, 12, 18, 235))
    # cyan footer line (gradient-ish: bright center)
    for x in range(W):
        d = 1 - abs(x - W / 2) / (W / 2)
        a = int(40 + 195 * d * d)
        dh.line([(x, HUD_H - 2), (x, HUD_H - 1)], fill=CYAN + (a,))
    dh.line([(0, 0), (W, 0)], fill=(255, 255, 255, 15))
    page.alpha_composite(hud)

    dh = ImageDraw.Draw(page)
    # central timer
    f_timer = font(44)
    label = "84"
    tw = dh.textlength(label, font=f_timer)
    dh.text(((W - tw) / 2, 12), label, font=f_timer, fill=TEXT)
    f_small = font(13, bold=False)
    sub = "ROUND 2 · FIRST TO 3"
    sw = dh.textlength(sub, font=f_small)
    dh.text(((W - sw) / 2, 54), sub, font=f_small, fill=MUTED)

    # left/right player slot chips
    f_chip = font(14)
    for i, (name, alive) in enumerate((("YOU · NIX", True), ("RANN", True),
                                       ("MIRELLE", False), ("K-BEE", True))):
        x0 = 26 + i * 150 if i < 2 else W - 26 - (4 - i) * 150
        y0 = 18
        dh.rounded_rectangle([x0, y0, x0 + 136, y0 + 38], radius=6,
                             fill=(16, 22, 32, 255),
                             outline=CYAN + (110,) if alive else (120, 126, 140, 90),
                             width=1)
        dh.rectangle([x0, y0, x0 + 3, y0 + 38], fill=CYAN if alive else (90, 96, 110))
        col = TEXT if alive else MUTED
        dh.text((x0 + 12, y0 + 10), name, font=f_chip, fill=col)

    # power slots bottom-left of arena (sketch)
    for i in range(3):
        x0 = ax + i * 44
        y0 = ay + arena_h + 16
        dh.rounded_rectangle([x0, y0, x0 + 36, y0 + 30], radius=5,
                             fill=(14, 18, 26, 220), outline=CYAN + (70,), width=1)

    page.convert("RGB").save(OUT, optimize=True)
    print("playtest mock:", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
