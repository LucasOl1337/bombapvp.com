from PIL import Image
import numpy as np
from pathlib import Path

root = Path(__file__).resolve().parent


def analyze_frame(p, border=2):
    im = Image.open(p).convert("RGBA")
    a = np.array(im)
    rgb = a[:, :, :3]
    alpha = a[:, :, 3]
    h, w = alpha.shape
    nonempty = int((alpha > 10).sum())
    total = h * w
    top = int(alpha[:border, :].max()) if border else 0
    bot = int(alpha[-border:, :].max()) if border else 0
    left = int(alpha[:, :border].max()) if border else 0
    right = int(alpha[:, -border:].max()) if border else 0
    border_max = max(top, bot, left, right)
    mask = alpha > 20
    if mask.any():
        r = rgb[:, :, 0].astype(int)
        g = rgb[:, :, 1].astype(int)
        b = rgb[:, :, 2].astype(int)
        cyan = mask & (g > 180) & (b > 180) & (r < 120) & (((g + b) / 2 - r) > 80)
        cyan_px = int(cyan.sum())
        pure_cyan = mask & (r < 40) & (g > 200) & (b > 200)
        pure_cyan_px = int(pure_cyan.sum())
        semi = (alpha > 20) & (alpha < 180)
        semi_px = int(semi.sum())
        mean_semi = rgb[semi].mean(axis=0) if semi.any() else np.array([0, 0, 0])
    else:
        cyan_px = pure_cyan_px = semi_px = 0
        mean_semi = np.array([0, 0, 0])
    return {
        "name": p.name,
        "size": (w, h),
        "nonempty_px": nonempty,
        "fill_pct": 100 * nonempty / total,
        "border_max_alpha": border_max,
        "cyan_px": cyan_px,
        "pure_cyan_px": pure_cyan_px,
        "semi_px": semi_px,
        "mean_semi_rgb": tuple(mean_semi.astype(int)),
        "alpha_max": int(alpha.max()),
        "alpha_min": int(alpha.min()),
    }


print("=== FRAMES-512 DETAIL ===")
for p in sorted((root / "frames-512").glob("frame-*.png")):
    d = analyze_frame(p, border=2)
    print(
        f"{d['name']}: fill={d['fill_pct']:.1f}% borderA={d['border_max_alpha']} "
        f"cyan={d['cyan_px']} pureCyan={d['pure_cyan_px']} semi={d['semi_px']} "
        f"meanSemi={d['mean_semi_rgb']} aMax={d['alpha_max']}"
    )

print()
print("=== FRAMES-256 DETAIL ===")
for p in sorted((root / "frames-256").glob("frame-*.png")):
    d = analyze_frame(p, border=2)
    print(
        f"{d['name']}: fill={d['fill_pct']:.1f}% borderA={d['border_max_alpha']} "
        f"cyan={d['cyan_px']} pureCyan={d['pure_cyan_px']} semi={d['semi_px']} "
        f"meanSemi={d['mean_semi_rgb']} aMax={d['alpha_max']}"
    )

print()
print("=== ATLAS EXACT MATCH ===")


def check_atlas(sheet_path, frames_dir, cell):
    sheet = np.array(Image.open(sheet_path).convert("RGBA"))
    sh, sw = sheet.shape[:2]
    assert sw % 4 == 0 and sh % 4 == 0, (sw, sh)
    cw, ch = sw // 4, sh // 4
    print(f"{sheet_path.name}: {sw}x{sh} cell={cw}x{ch} expected={cell}")
    ok = True
    for i in range(16):
        r, c = divmod(i, 4)
        cell_img = sheet[r * ch : (r + 1) * ch, c * cw : (c + 1) * cw]
        frame = np.array(Image.open(frames_dir / f"frame-{i:02d}.png").convert("RGBA"))
        if frame.shape != cell_img.shape:
            print(f"  frame-{i:02d}: SHAPE MISMATCH {frame.shape} vs {cell_img.shape}")
            ok = False
            continue
        diff = np.abs(cell_img.astype(int) - frame.astype(int)).sum()
        if diff != 0:
            maxd = np.abs(cell_img.astype(int) - frame.astype(int)).max()
            mism = (np.abs(cell_img.astype(int) - frame.astype(int)).sum(axis=2) > 0).sum()
            print(f"  frame-{i:02d}: DIFF sum={diff} max={maxd} mism_px={mism}")
            ok = False
        else:
            print(f"  frame-{i:02d}: exact match")
    print(f"  RESULT: {'PASS' if ok else 'FAIL'}")
    return ok


check_atlas(root / "spritesheet-512-4x4.png", root / "frames-512", 512)
check_atlas(root / "spritesheet-256-4x4.png", root / "frames-256", 256)

print()
print("=== PREVIEW GIF ===")
gif = Image.open(root / "preview" / "preview.gif")
print(f"frames={gif.n_frames} size={gif.size} mode={gif.mode}")
durs = []
for i in range(gif.n_frames):
    gif.seek(i)
    durs.append(gif.info.get("duration", None))
print(f"durations_ms={durs}")
print(f"loop={gif.info.get('loop')}")

print()
print("=== SOURCE-GRID-1248 ===")
sg = Image.open(root / "source-grid-1248.png").convert("RGBA")
print(f"size={sg.size}")
arr = np.array(sg)
cell = 1248 // 4
print(f"cell={cell}")
for i in range(16):
    r, c = divmod(i, 4)
    cell_a = arr[r * cell : (r + 1) * cell, c * cell : (c + 1) * cell, 3]
    bmax = int(
        max(
            cell_a[:2, :].max(),
            cell_a[-2:, :].max(),
            cell_a[:, :2].max(),
            cell_a[:, -2:].max(),
        )
    )
    print(f"  cell {i:02d}: fill={(cell_a > 10).mean() * 100:.1f}% borderMax={bmax}")

print()
print("=== 256 vs 512 downscale consistency (MSE on alpha+rgb) ===")
for i in range(16):
    big = Image.open(root / "frames-512" / f"frame-{i:02d}.png").convert("RGBA")
    small = Image.open(root / "frames-256" / f"frame-{i:02d}.png").convert("RGBA")
    scaled = big.resize((256, 256), Image.Resampling.LANCZOS)
    a = np.array(scaled).astype(float)
    b = np.array(small).astype(float)
    mse = ((a - b) ** 2).mean()
    print(f"  frame-{i:02d}: mse={mse:.2f}")
