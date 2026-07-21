from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent


def analyze(p: Path) -> dict:
    im = Image.open(p)
    w, h = im.size
    mode = im.mode
    has_alpha = "A" in mode or (mode == "P" and "transparency" in im.info)
    rgba = im.convert("RGBA")
    px = list(rgba.getdata())
    opaque = sum(1 for r, g, b, a in px if a > 0)
    fully_trans = sum(1 for r, g, b, a in px if a == 0)

    border_opaque = 0
    border_total = 0
    for x in range(w):
        for y in (0, h - 1):
            border_total += 1
            if rgba.getpixel((x, y))[3] > 0:
                border_opaque += 1
    for y in range(1, h - 1):
        for x in (0, w - 1):
            border_total += 1
            if rgba.getpixel((x, y))[3] > 0:
                border_opaque += 1

    mag = sum(
        1
        for r, g, b, a in px
        if a > 8
        and r >= 180
        and b >= 180
        and g <= 120
        and (r - g) > 60
        and (b - g) > 60
    )

    # near-border alpha (1px inset) for safety margin signal
    near_border_opaque = 0
    for x in range(w):
        for y in (1, h - 2):
            if 0 <= y < h and rgba.getpixel((x, y))[3] > 0:
                near_border_opaque += 1
    for y in range(2, h - 2):
        for x in (1, w - 2):
            if rgba.getpixel((x, y))[3] > 0:
                near_border_opaque += 1

    return {
        "file": str(p.relative_to(root)).replace("\\", "/"),
        "size": (w, h),
        "mode": mode,
        "has_alpha": has_alpha or mode in ("RGBA", "LA"),
        "opaque_px": opaque,
        "fully_trans": fully_trans,
        "border_opaque": border_opaque,
        "border_total": border_total,
        "near_border_opaque": near_border_opaque,
        "magenta_like": mag,
        "empty": opaque == 0,
        "file_bytes": p.stat().st_size,
    }


def main() -> None:
    print("=== SOURCE / SHEETS / PREVIEW ===")
    for name in [
        "source-generated-grid.png",
        "source-chromakey-removed.png",
        "source-grid-1248.png",
        "spritesheet-512-4x4.png",
        "spritesheet-256-4x4.png",
        "preview/contact-sheet.png",
        "preview/preview.gif",
    ]:
        p = root / name
        if not p.exists():
            print("MISSING", name)
            continue
        d = analyze(p)
        print(
            f"{d['file']}: size={d['size']} mode={d['mode']} alpha={d['has_alpha']} "
            f"opaque={d['opaque_px']} border_op={d['border_opaque']} mag={d['magenta_like']} "
            f"bytes={d['file_bytes']}"
        )

    for label, folder, expect in [("512", "frames-512", 512), ("256", "frames-256", 256)]:
        print(f"\n=== FRAMES {label} ===")
        fails = 0
        for i in range(16):
            p = root / folder / f"frame-{i:02d}.png"
            if not p.exists():
                print(f"frame-{i:02d}: MISSING")
                fails += 1
                continue
            d = analyze(p)
            ok_dim = d["size"] == (expect, expect)
            ok_alpha = d["has_alpha"]
            ok_border = d["border_opaque"] == 0
            ok_content = not d["empty"] and d["file_bytes"] > 0
            ok_mag = d["magenta_like"] == 0
            status = "OK" if all([ok_dim, ok_alpha, ok_border, ok_content, ok_mag]) else "FAIL"
            if status == "FAIL":
                fails += 1
            print(
                f"frame-{i:02d}: {status} size={d['size']} alpha={ok_alpha} "
                f"border_op={d['border_opaque']} near_border_op={d['near_border_opaque']} "
                f"opaque={d['opaque_px']} mag={d['magenta_like']} bytes={d['file_bytes']}"
            )
        print(f"fails_{label}={fails}")

    print("\n=== ATLAS GRID ===")
    for name, cell in [("spritesheet-512-4x4.png", 512), ("spritesheet-256-4x4.png", 256)]:
        im = Image.open(root / name)
        w, h = im.size
        print(
            f"{name}: {w}x{h} rem4=({w % 4},{h % 4}) "
            f"cell=({w // 4},{h // 4}) exact_4x4={w == cell * 4 and h == cell * 4}"
        )

        # per-cell border and content in atlas
        rgba = im.convert("RGBA")
        for cy in range(4):
            for cx in range(4):
                x0, y0 = cx * cell, cy * cell
                cell_im = rgba.crop((x0, y0, x0 + cell, y0 + cell))
                cpx = list(cell_im.getdata())
                opaque = sum(1 for r, g, b, a in cpx if a > 0)
                border_op = 0
                for x in range(cell):
                    if cell_im.getpixel((x, 0))[3] > 0:
                        border_op += 1
                    if cell_im.getpixel((x, cell - 1))[3] > 0:
                        border_op += 1
                for y in range(1, cell - 1):
                    if cell_im.getpixel((0, y))[3] > 0:
                        border_op += 1
                    if cell_im.getpixel((cell - 1, y))[3] > 0:
                        border_op += 1
                mag = sum(
                    1
                    for r, g, b, a in cpx
                    if a > 8
                    and r >= 180
                    and b >= 180
                    and g <= 120
                    and (r - g) > 60
                    and (b - g) > 60
                )
                idx = cy * 4 + cx
                flag = []
                if opaque == 0:
                    flag.append("EMPTY")
                if border_op:
                    flag.append(f"BORDER={border_op}")
                if mag:
                    flag.append(f"MAG={mag}")
                if flag:
                    print(f"  cell[{idx}] ({cx},{cy}): {','.join(flag)} opaque={opaque}")

    print("\n=== GIF ===")
    gif = Image.open(root / "preview" / "preview.gif")
    print(f"n_frames={getattr(gif, 'n_frames', 1)} size={gif.size} mode={gif.mode}")
    durations = []
    for i in range(gif.n_frames):
        gif.seek(i)
        durations.append(gif.info.get("duration"))
    print("durations_ms=", durations)
    uniq = set(durations)
    print("unique_durations=", uniq)

    # contact sheet rough readability
    cs = Image.open(root / "preview" / "contact-sheet.png")
    print(f"\ncontact-sheet: size={cs.size} mode={cs.mode}")


if __name__ == "__main__":
    main()
