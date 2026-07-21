"""Validate Nix Ember animation candidate (local only)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

try:
    import numpy as np
except ImportError:
    np = None

ROOT = Path(__file__).resolve().parent
issues: list[str] = []


def info(p: Path) -> dict:
    im = Image.open(p)
    im_rgba = im.convert("RGBA") if im.mode != "RGBA" else im
    a = im_rgba.getchannel("A")
    hist = a.histogram()
    return {
        "size": im.size,
        "mode": im.mode,
        "alpha_extrema": a.getextrema(),
        "pixels_alpha_gt0": sum(hist[1:]),
        "file_bytes": p.stat().st_size,
    }


def edge_alpha_hits(p: Path) -> tuple[int, int]:
    im = Image.open(p).convert("RGBA")
    a = im.getchannel("A")
    w, h = im.size
    hits = 0
    max_a = 0
    for x in range(w):
        for y in (0, h - 1):
            v = a.getpixel((x, y))
            if v > 0:
                hits += 1
                max_a = max(max_a, v)
    for y in range(h):
        for x in (0, w - 1):
            v = a.getpixel((x, y))
            if v > 0:
                hits += 1
                max_a = max(max_a, v)
    return hits, max_a


def main() -> None:
    print("=== SOURCES / SHEETS ===")
    names = [
        "source-generated-grid.png",
        "source-chromakey-removed.png",
        "source-grid-1248.png",
        "spritesheet-256-4x4.png",
        "spritesheet-512-4x4.png",
        "preview/contact-sheet.png",
        "preview/preview.gif",
    ]
    for name in names:
        p = ROOT / name
        if not p.exists():
            print(f"MISSING {name}")
            issues.append(f"missing {name}")
            continue
        i = info(p)
        w, h = i["size"]
        print(
            f"{name}: {w}x{h} mode={i['mode']} a_ext={i['alpha_extrema']} "
            f"a>0={i['pixels_alpha_gt0']} bytes={i['file_bytes']}"
        )
        if name.startswith("source") or "4x4" in name:
            print(
                f"  div4: w%4=={w % 4 == 0} h%4=={h % 4 == 0} "
                f"cell_if_4x4={w // 4}x{h // 4}"
            )
            if w % 4 or h % 4:
                issues.append(f"not_divisible_4 {name} {w}x{h}")

    for size, folder in [(512, "frames-512"), (256, "frames-256")]:
        print(f"\n=== {folder.upper()} ===")
        for i in range(16):
            p = ROOT / folder / f"frame-{i:02d}.png"
            if not p.exists():
                issues.append(f"missing {folder}/frame-{i:02d}.png")
                print(f"  MISSING frame-{i:02d}")
                continue
            inf = info(p)
            w, h = inf["size"]
            empty = inf["pixels_alpha_gt0"] < 100
            bad_size = (w, h) != (size, size)
            print(
                f"  frame-{i:02d}: {w}x{h} mode={inf['mode']} "
                f"a_ext={inf['alpha_extrema']} a>0={inf['pixels_alpha_gt0']} "
                f"empty={empty} bad_size={bad_size}"
            )
            if empty:
                issues.append(f"empty {folder}/frame-{i:02d}")
            if bad_size:
                issues.append(f"size {folder}/frame-{i:02d}={w}x{h}")

    for size, folder in [(512, "frames-512"), (256, "frames-256")]:
        print(f"\n=== EDGE ALPHA ({folder}) ===")
        for i in range(16):
            p = ROOT / folder / f"frame-{i:02d}.png"
            if not p.exists():
                continue
            hits, max_a = edge_alpha_hits(p)
            status = "TOUCH" if hits else "OK"
            if hits:
                issues.append(
                    f"edge_alpha {folder}/frame-{i:02d} hits={hits} max_a={max_a}"
                )
            print(f"  frame-{i:02d}: {status} hits={hits} max_a={max_a}")

    print("\n=== SPRITESHEET CONSISTENCY ===")
    for size, sheet_name, folder in [
        (512, "spritesheet-512-4x4.png", "frames-512"),
        (256, "spritesheet-256-4x4.png", "frames-256"),
    ]:
        sheet_path = ROOT / sheet_name
        if not sheet_path.exists():
            issues.append(f"missing {sheet_name}")
            continue
        sheet = Image.open(sheet_path).convert("RGBA")
        sw, sh = sheet.size
        ok = (sw, sh) == (size * 4, size * 4)
        print(f"{sheet_name}: {sw}x{sh} expected {size * 4}x{size * 4} ok={ok}")
        if not ok:
            issues.append(f"sheet size {sheet_name} {sw}x{sh}")
        mismatches = 0
        for idx in range(16):
            row, col = idx // 4, idx % 4
            cell = sheet.crop(
                (col * size, row * size, (col + 1) * size, (row + 1) * size)
            )
            fr_path = ROOT / folder / f"frame-{idx:02d}.png"
            if not fr_path.exists():
                mismatches += 1
                continue
            fr = Image.open(fr_path).convert("RGBA")
            if cell.size != fr.size:
                mismatches += 1
                print(f"  size mismatch frame-{idx:02d}")
                continue
            if np is not None:
                a = np.asarray(cell, dtype=np.int16)
                b = np.asarray(fr, dtype=np.int16)
                diff = float(np.abs(a - b).mean())
                if diff > 1.0:
                    mismatches += 1
                    print(f"  mismatch frame-{idx:02d} mean_diff={diff:.2f}")
            else:
                if list(cell.getdata()) != list(fr.getdata()):
                    # allow tiny diffs via histogram sum
                    da = sum(
                        abs(x - y)
                        for x, y in zip(cell.histogram(), fr.histogram())
                    )
                    if da > 50:
                        mismatches += 1
                        print(f"  mismatch frame-{idx:02d} hist_diff={da}")
        print(f"  cell mismatches: {mismatches}/16")
        if mismatches:
            issues.append(f"sheet mismatch {sheet_name}: {mismatches}")

    print("\n=== PREVIEW ===")
    order_path = ROOT / "preview" / "frame-order.txt"
    if order_path.exists():
        order = order_path.read_text(encoding="utf-8", errors="replace")
        print("frame-order.txt:")
        print(order[:800])
    else:
        issues.append("missing preview/frame-order.txt")
        print("MISSING frame-order.txt")

    gif_path = ROOT / "preview" / "preview.gif"
    if gif_path.exists():
        gif = Image.open(gif_path)
        n = getattr(gif, "n_frames", 1)
        print(f"preview.gif size={gif.size} n_frames={n} mode={gif.mode}")
        if n < 16:
            issues.append(f"preview.gif frames={n} expected>=16")
    else:
        issues.append("missing preview/preview.gif")

    cs_path = ROOT / "preview" / "contact-sheet.png"
    if cs_path.exists():
        cs = Image.open(cs_path)
        print(f"contact-sheet.png size={cs.size} mode={cs.mode}")
        if cs.size[0] < 512 or cs.size[1] < 512:
            issues.append(f"contact-sheet small {cs.size}")
    else:
        issues.append("missing preview/contact-sheet.png")

    # source vs extracted cell size check
    print("\n=== SOURCE GRID DIVISIBILITY ===")
    for name in [
        "source-generated-grid.png",
        "source-chromakey-removed.png",
        "source-grid-1248.png",
    ]:
        p = ROOT / name
        if not p.exists():
            continue
        im = Image.open(p)
        w, h = im.size
        print(
            f"{name}: {w}x{h} div4={w % 4 == 0 and h % 4 == 0} "
            f"cell={w // 4}x{h // 4}"
        )

    print("\n=== ISSUES SUMMARY ===")
    if issues:
        for x in issues:
            print(" -", x)
    else:
        print("NONE")
    print("TOTAL ISSUES:", len(issues))


if __name__ == "__main__":
    main()
