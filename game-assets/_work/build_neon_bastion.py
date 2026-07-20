"""Neon Bastion — procedural 128x128 arena tile pack (seamless / toroidal).

Palette contract (Nex Dark):
  floor  #151a26 (indigo-slate, dark & quiet)   — cool = structure
  lane   #1d2434 (same family lift)
  wall   #0d1119 (basalt monolith, cyan top rim-light)
  crate  #4a2c1a / #8a4b24 / #2b1a10 + ember #ffb46a — the ONLY warm category
  spawn  open thin cyan ring rgba(94,220,255,0.85)
  portal double dashed cyan ring (distinct from spawn)

Technique follows tournament-clean precedent (build_tournament_lane_spawn.py,
g6d_wall_and_alt.py, g6u_wall_pure_continuous.py):
  * toroidal value noise (wrap-indexed lattice) => zero seam by construction
  * alt tiles mean-matched per channel (additive offset) => checker delta < 1
  * wall is edge-to-edge (no per-cell rim box) => no lattice on multi-cell fields
QA numbers are printed at the end and mirrored into MANIFEST.md.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

OUT = Path(r"C:\projetos\bombpvp\game-assets\arenas\themes\neon-bastion")
SIZE = 128

# --- palette anchors -------------------------------------------------------
FLOOR_BASE = (21, 26, 38)       # #151a26
FLOOR_LANE = (29, 36, 52)       # #1d2434
WALL_BODY = (13, 17, 25)        # #0d1119
CYAN_THREAD = (94, 220, 255)    # spawn/joint light
CYAN_RIM = (104, 221, 255)      # wall rim-light
CRATE_BODY = (74, 44, 26)       # #4a2c1a
CRATE_PANEL = (138, 75, 36)     # #8a4b24
CRATE_BAND = (43, 26, 16)       # #2b1a10
EMBER_MARK = (255, 180, 106)    # #ffb46a


# --- toroidal noise --------------------------------------------------------
def toroidal_noise(size: int, cell: int, amp: float, rng: random.Random) -> np.ndarray:
    """Value noise whose lattice wraps -> perfectly seamless."""
    cols = max(1, size // cell)
    grid = np.array([[rng.uniform(-1, 1) for _ in range(cols)] for _ in range(cols)])
    out = np.zeros((size, size))
    for y in range(size):
        gy = y / cell
        y0 = int(gy) % cols
        y1 = (y0 + 1) % cols
        fy = gy - int(gy)
        sy = fy * fy * (3 - 2 * fy)
        for x in range(size):
            gx = x / cell
            x0 = int(gx) % cols
            x1 = (x0 + 1) % cols
            fx = gx - int(gx)
            sx = fx * fx * (3 - 2 * fx)
            v00 = grid[y0, x0]
            v10 = grid[y0, x1]
            v01 = grid[y1, x0]
            v11 = grid[y1, x1]
            v0 = v00 * (1 - sx) + v10 * sx
            v1 = v01 * (1 - sx) + v11 * sx
            out[y, x] = (v0 * (1 - sy) + v1 * sy) * amp
    return out


# --- helpers ---------------------------------------------------------------
def per_channel_mean(im: Image.Image) -> np.ndarray:
    return np.array(im.convert("RGB"), dtype=float).reshape(-1, 3).mean(0)


def mean_match(target: Image.Image, reference: Image.Image) -> Image.Image:
    """Additive per-channel offset so means match reference exactly."""
    a = np.array(target.convert("RGB"), dtype=float)
    ref = per_channel_mean(reference)
    cur = a.reshape(-1, 3).mean(0)
    a += (ref - cur)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def seam_delta(im: Image.Image) -> dict:
    a = np.array(im.convert("RGB"), dtype=float)
    lr = float(np.abs(a[:, 0] - a[:, -1]).mean())
    tb = float(np.abs(a[0, :] - a[-1, :]).mean())
    return {"lr": lr, "tb": tb}


def checker_delta(a: Image.Image, b: Image.Image) -> float:
    """Per-channel mean abs diff between two tiles (tone checker proxy)."""
    return float(np.abs(per_channel_mean(a) - per_channel_mean(b)).mean())


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
            if p.mode == "RGBA":
                grid.paste(p, (gx * size, gy * size), p)
            else:
                grid.paste(p, (gx * size, gy * size))
    grid.save(path, optimize=True)


# --- floor -----------------------------------------------------------------
def render_floor(seed: int, joint_offset: tuple[int, int]) -> Image.Image:
    """Dark indigo-slate slabs: 2x2 large slabs, hairline joints with a
    VERY low alpha cyan light thread. Toroidal noise => seamless."""
    rng = random.Random(seed)
    arr = np.zeros((SIZE, SIZE, 3))
    arr[:] = FLOOR_BASE

    n_coarse = toroidal_noise(SIZE, 16, 2.8, rng)
    n_fine = toroidal_noise(SIZE, 6, 1.6, rng)
    noise = n_coarse + n_fine

    # per-slab value offset (subtle, same family)
    jx, jy = joint_offset
    slab_of = {}
    for sy in range(2):
        for sx in range(2):
            slab_of[(sx, sy)] = rng.uniform(-2.0, 2.0)

    joints_x = {(jx + k * 64) % SIZE for k in range(2)}
    joints_y = {(jy + k * 64) % SIZE for k in range(2)}

    for y in range(SIZE):
        sy = 0 if (y - jy) % SIZE < 64 else 1
        for x in range(SIZE):
            sx = 0 if (x - jx) % SIZE < 64 else 1
            base = slab_of[(sx, sy)] + noise[y, x]
            r = FLOOR_BASE[0] + base
            g = FLOOR_BASE[1] + base * 1.02
            b = FLOOR_BASE[2] + base * 1.05
            arr[y, x] = (r, g, b)

    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    px = im.load()
    # hairline joints: slight darken + faint cyan thread (alpha ~0.05)
    for y in range(SIZE):
        for x in range(SIZE):
            on_joint = x in joints_x or y in joints_y
            # soften: also shade the pixel next to the joint slightly
            near = ((x - 1) % SIZE in joints_x or (x + 1) % SIZE in joints_x
                    or (y - 1) % SIZE in joints_y or (y + 1) % SIZE in joints_y)
            r, g, b = px[x, y]
            if on_joint:
                r = r * 0.82 + CYAN_THREAD[0] * 0.05
                g = g * 0.82 + CYAN_THREAD[1] * 0.05
                b = b * 0.82 + CYAN_THREAD[2] * 0.05
            elif near:
                r *= 0.94
                g *= 0.94
                b *= 0.94
            px[x, y] = (int(r), int(g), int(b))
    return im.filter(ImageFilter.SMOOTH_MORE)


def render_lane(base: Image.Image) -> Image.Image:
    """Same family, lifted toward #1d2434."""
    a = np.array(base, dtype=float)
    target = np.array(FLOOR_LANE, dtype=float)
    cur = a.reshape(-1, 3).mean(0)
    a += (target - cur) * 0.9
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")
    # slightly stronger cyan thread on lane joints for route read
    px = im.load()
    for y in range(SIZE):
        for x in range(SIZE):
            if x % 64 == 0 or y % 64 == 0:
                r, g, b = px[x, y]
                px[x, y] = (
                    int(r * 0.92 + CYAN_THREAD[0] * 0.08),
                    int(g * 0.92 + CYAN_THREAD[1] * 0.08),
                    int(b * 0.92 + CYAN_THREAD[2] * 0.08),
                )
    return im


def _ring(draw_im: Image.Image, r_inner: int, r_outer: int, color, alpha: float) -> Image.Image:
    cx = cy = SIZE // 2
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    mid = (r_inner + r_outer) / 2
    for r in range(r_inner, r_outer + 1):
        falloff = max(0.0, 1.0 - abs(r - mid) / ((r_outer - r_inner) / 2 + 0.01))
        d.ellipse([cx - r, cy - r, cx + r, cy + r],
                  outline=color + (int(255 * alpha * falloff),))
    base = draw_im.convert("RGBA")
    base.alpha_composite(overlay)
    return base.convert("RGB")


def render_spawn(base: Image.Image) -> Image.Image:
    im = ImageEnhance.Brightness(base).enhance(1.07)
    im = _ring(im, 33, 37, CYAN_THREAD, 0.85)
    return im.filter(ImageFilter.SMOOTH)


def render_portal(base: Image.Image) -> Image.Image:
    """Double DASHED cyan ring — distinct silhouette from the solid spawn ring."""
    im = ImageEnhance.Brightness(base).enhance(1.05)
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    cx = cy = SIZE // 2
    portal_col = (120, 228, 255)
    # outer dashed ring r=41
    for k in range(12):
        a0 = k * 30 + 5
        a1 = a0 + 20
        d.arc([cx - 41, cy - 41, cx + 41, cy + 41], a0, a1,
              fill=portal_col + (int(255 * 0.82),), width=2)
    # inner dashed ring r=29, phase-shifted
    for k in range(10):
        a0 = k * 36 + 20
        a1 = a0 + 22
        d.arc([cx - 29, cy - 29, cx + 29, cy + 29], a0, a1,
              fill=portal_col + (int(255 * 0.62),), width=2)
    out = im.convert("RGBA")
    out.alpha_composite(overlay)
    return out.convert("RGB").filter(ImageFilter.SMOOTH)


# --- wall ------------------------------------------------------------------
def render_wall(seed: int) -> Image.Image:
    """Basalt monolith, edge-to-edge. No per-cell frame. Soft horizontal
    strata + a gentle cyan rim-light on the TOP edge only (light from above),
    low alpha so multi-cell masses stay continuous (no lattice)."""
    rng = random.Random(seed)
    arr = np.zeros((SIZE, SIZE, 3))
    arr[:] = WALL_BODY
    noise = toroidal_noise(SIZE, 14, 3.4, rng) + toroidal_noise(SIZE, 5, 1.8, rng)
    for y in range(SIZE):
        for x in range(SIZE):
            n = noise[y, x]
            arr[y, x] = (WALL_BODY[0] + n, WALL_BODY[1] + n * 1.02, WALL_BODY[2] + n * 1.08)
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    px = im.load()
    # faint horizontal strata (soft, low contrast — no mortar bars)
    for band_y in (SIZE // 3, 2 * SIZE // 3):
        for dy in (-1, 0, 1):
            y = band_y + dy
            if 0 <= y < SIZE:
                f = 0.90 if dy == 0 else 0.95
                for x in range(SIZE):
                    r, g, b = px[x, y]
                    px[x, y] = (int(r * f), int(g * f), int(b * f))
    # cyan rim-light: top edge only, gradual 4px falloff, low alpha
    for y, alpha in ((0, 0.18), (1, 0.11), (2, 0.06), (3, 0.03)):
        for x in range(SIZE):
            r, g, b = px[x, y]
            px[x, y] = (
                int(r * (1 - alpha) + CYAN_RIM[0] * alpha),
                int(g * (1 - alpha) + CYAN_RIM[1] * alpha),
                int(b * (1 - alpha) + CYAN_RIM[2] * alpha),
            )
    return im.filter(ImageFilter.SMOOTH)


# --- crate -----------------------------------------------------------------
def render_crate(seed: int) -> Image.Image:
    """The ONLY warm category. Full-bleed RGBA: umber body, raised inner
    panel, dark bands, ember sigil glow at center."""
    rng = random.Random(seed)
    arr = np.zeros((SIZE, SIZE, 4), dtype=float)
    arr[..., 0] = CRATE_BODY[0]
    arr[..., 1] = CRATE_BODY[1]
    arr[..., 2] = CRATE_BODY[2]
    arr[..., 3] = 255
    # horizontal wood grain (streaky noise stretched on x)
    grain = toroidal_noise(SIZE, 8, 4.0, rng)
    stretch = toroidal_noise(SIZE, 32, 3.0, rng)
    for y in range(SIZE):
        for x in range(SIZE):
            n = grain[y, x] * 0.5 + stretch[y, x] * 0.5
            arr[y, x, 0] += n
            arr[y, x, 1] += n * 0.9
            arr[y, x, 2] += n * 0.7
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    draw = ImageDraw.Draw(im)
    # outer band frame
    draw.rectangle([0, 0, SIZE - 1, SIZE - 1], fill=CRATE_BAND + (255,), width=12)
    # mid body ring
    draw.rectangle([12, 12, SIZE - 13, SIZE - 13], outline=CRATE_BODY + (255,), width=6)
    # inner panel with soft bevel
    panel = [24, 24, SIZE - 25, SIZE - 25]
    draw.rectangle(panel, fill=CRATE_PANEL + (255,))
    # panel grain
    for _ in range(60):
        x = rng.randint(panel[0] + 2, panel[2] - 2)
        y = rng.randint(panel[1] + 2, panel[3] - 2)
        d = rng.randint(-10, -3)
        r, g, b, _a = im.getpixel((x, y))
        im.putpixel((x, y), (max(0, r + d), max(0, g + d), max(0, b + d // 2), 255))
    # bevel: top-left lighter, bottom-right darker
    draw.line([(panel[0], panel[1]), (panel[2], panel[1])],
              fill=(168, 98, 52, 255), width=2)
    draw.line([(panel[0], panel[1]), (panel[0], panel[3])],
              fill=(158, 88, 46, 255), width=2)
    draw.line([(panel[0], panel[3]), (panel[2], panel[3])],
              fill=(96, 50, 24, 255), width=2)
    draw.line([(panel[2], panel[1]), (panel[2], panel[3])],
              fill=(104, 56, 28, 255), width=2)
    # corner bolts on the band
    for cx, cy in ((16, 16), (SIZE - 17, 16), (16, SIZE - 17), (SIZE - 17, SIZE - 17)):
        draw.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(24, 14, 9, 255))
    im = im.filter(ImageFilter.SMOOTH)
    # ember sigil: soft glow + solid diamond mark
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    cx = cy = SIZE // 2
    for r in range(16, 0, -1):
        a = int(70 * (1 - r / 16) ** 2)
        dg.ellipse([cx - r, cy - r, cx + r, cy + r], fill=EMBER_MARK + (a,))
    im.alpha_composite(glow)
    mark = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    dm = ImageDraw.Draw(mark)
    dm.polygon([(cx, cy - 8), (cx + 8, cy), (cx, cy + 8), (cx - 8, cy)],
               fill=EMBER_MARK + (235,))
    dm.polygon([(cx, cy - 4), (cx + 4, cy), (cx, cy + 4), (cx - 4, cy)],
               fill=(255, 226, 178, 255))
    im.alpha_composite(mark)
    return im


# --- QA mocks ----------------------------------------------------------------
def build_arena_mock(tiles: dict) -> None:
    n, t = 11, 40
    def rs(name):
        return tiles[name].resize((t, t), Image.Resampling.LANCZOS)
    base, alt, alt2, alt3 = rs("base"), rs("alt"), rs("alt2"), rs("alt3")
    lane, spawn, portal = rs("lane"), rs("spawn"), rs("portal")
    wall, wall_alt = rs("wall"), rs("wall-alt")
    crate, crate_alt = rs("crate"), rs("crate-alt")
    floors = [base, alt, alt2, alt3]
    mock = Image.new("RGBA", (n * t, n * t), (0, 0, 0, 255))
    spawns = {(1, 1), (1, n - 2), (n - 2, 1), (n - 2, n - 2)}
    for y in range(n):
        for x in range(n):
            if x == 0 or y == 0 or x == n - 1 or y == n - 1:
                tile = wall_alt if (x + y) % 2 else wall
            elif x % 2 == 0 and y % 2 == 0:
                tile = wall_alt if (x + y) % 2 else wall  # interior pillars
            elif (x, y) in spawns:
                tile = spawn
            elif x == n // 2 and y == n // 2:
                tile = portal
            elif x == n // 2 or y == n // 2:
                tile = lane
            else:
                tile = floors[(x + 2 * y) % 4]
            mock.paste(tile, (x * t, y * t), tile if tile.mode == "RGBA" else None)
    rng = random.Random(7)
    for y in range(1, n - 1):
        for x in range(1, n - 1):
            if x % 2 == 1 and y % 2 == 1 and x != n // 2 and y != n // 2 \
                    and (x, y) not in spawns and rng.random() < 0.55:
                c = crate_alt if (x + y) % 2 else crate
                mock.paste(c, (x * t, y * t), c)
    mock.save(OUT / "_preview-arena-mock.png", optimize=True)


def wall_field_qa(wall: Image.Image, wall_alt: Image.Image) -> dict:
    """3x3 checker field at 40px: measure rim line prominence + column continuity."""
    t, n = 40, 3
    w40 = np.array(wall.resize((t, t), Image.Resampling.LANCZOS), dtype=float)
    a40 = np.array(wall_alt.resize((t, t), Image.Resampling.LANCZOS), dtype=float)
    field = Image.new("RGB", (t * n, t * n))
    for y in range(n):
        for x in range(n):
            tile = a40 if (x + y) % 2 else w40
            field.paste(Image.fromarray(tile.astype(np.uint8)), (x * t, y * t))
    field.save(OUT / "_qa-wall-field.png", optimize=True)
    f = np.array(field, dtype=float)
    row_means = f.mean(axis=(1, 2))
    # rim rows (0,40,80) vs their neighbours -> max horizontal line prominence
    rim_delta = max(
        abs(row_means[r] - row_means[r + 5]) for r in (0, t, 2 * t)
    )
    col_means = f.mean(axis=(0, 2))
    col_std = float(col_means.std())
    return {"rim_delta": float(rim_delta), "col_std": col_std}


def floor_checker_qa(base: Image.Image, alts: list[Image.Image]) -> list[float]:
    return [checker_delta(base, a) for a in alts]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    qa: dict = {}

    base = render_floor(seed=101, joint_offset=(0, 0))
    alt = mean_match(render_floor(seed=202, joint_offset=(32, 32)), base)
    alt2 = mean_match(render_floor(seed=303, joint_offset=(32, 0)), base)
    alt3 = mean_match(render_floor(seed=404, joint_offset=(0, 32)), base)
    lane = render_lane(base)
    spawn = render_spawn(base)
    portal = render_portal(base)
    wall = render_wall(seed=61)
    wall_alt = mean_match(render_wall(seed=77), wall)
    crate = render_crate(seed=11)
    crate_alt = render_crate(seed=23)
    # mean-match crate alt on RGB channels (keep alpha)
    crate_alt_rgb = mean_match(crate_alt.convert("RGB"), crate.convert("RGB"))
    crate_alt = crate_alt_rgb.convert("RGBA")
    crate_alt.putalpha(255)

    tiles = {
        "base": base, "alt": alt, "alt2": alt2, "alt3": alt3,
        "lane": lane, "spawn": spawn, "portal": portal,
        "wall": wall, "wall-alt": wall_alt,
        "crate": crate, "crate-alt": crate_alt,
    }
    names = {
        "base": "floor-base.png", "alt": "floor-base-alt.png",
        "alt2": "floor-base-alt2.png", "alt3": "floor-base-alt3.png",
        "lane": "floor-lane.png", "spawn": "floor-spawn.png",
        "portal": "floor-portal.png", "wall": "wall.png",
        "wall-alt": "wall-alt.png", "crate": "crate.png",
        "crate-alt": "crate-alt.png",
    }
    for key, fname in names.items():
        tiles[key].save(OUT / fname, optimize=True)
        downscale_preview(tiles[key], OUT / f"_preview40-{fname}")
    for key in ("base", "alt", "lane", "wall", "crate"):
        make_seam(tiles[key], OUT / f"_seam-{names[key]}")

    build_arena_mock(tiles)

    # --- QA measurements ---
    qa["seam"] = {k: seam_delta(tiles[k]) for k in ("base", "lane", "wall")}
    qa["checker_base_vs_alts"] = floor_checker_qa(base, [alt, alt2, alt3])
    qa["lane_vs_base_mean"] = float(np.abs(
        per_channel_mean(lane) - per_channel_mean(base)).mean())
    qa["floor_mean"] = per_channel_mean(base).round(2).tolist()
    qa["lane_mean"] = per_channel_mean(lane).round(2).tolist()
    qa["wall_mean"] = per_channel_mean(wall).round(2).tolist()
    qa["wall_field"] = wall_field_qa(wall, wall_alt)
    qa["crate_mean"] = per_channel_mean(crate).round(2).tolist()
    qa["crate_alt_checker"] = checker_delta(crate.convert("RGB"), crate_alt.convert("RGB"))
    qa["crate_alpha_min"] = int(np.array(crate)[..., 3].min())
    qa["wall_vs_floor_mean"] = float(
        per_channel_mean(base).mean() - per_channel_mean(wall).mean())

    import json
    print(json.dumps(qa, indent=2))
    print("OK")


if __name__ == "__main__":
    main()
