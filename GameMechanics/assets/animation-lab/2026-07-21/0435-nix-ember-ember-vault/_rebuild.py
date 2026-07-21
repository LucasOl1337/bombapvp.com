"""Rebuild frames-512 (true 512), spritesheets, and previews. Sources untouched."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
GRID = ROOT / "source-grid-1248.png"
F512 = ROOT / "frames-512"
F256 = ROOT / "frames-256"
PREV = ROOT / "preview"


def clear_edge_alpha(im: Image.Image, px: int = 1) -> Image.Image:
    """Force transparent 1px border so alpha never touches cell edges."""
    out = im.convert("RGBA")
    w, h = out.size
    pxls = out.load()
    for y in range(h):
        for x in range(w):
            if x < px or y < px or x >= w - px or y >= h - px:
                r, g, b, a = pxls[x, y]
                if a:
                    pxls[x, y] = (r, g, b, 0)
    return out


def extract_native_from_grid() -> list[Image.Image]:
    grid = Image.open(GRID).convert("RGBA")
    w, h = grid.size
    assert w % 4 == 0 and h % 4 == 0, (w, h)
    cw, ch = w // 4, h // 4
    frames = []
    for idx in range(16):
        row, col = idx // 4, idx % 4
        cell = grid.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
        frames.append(cell)
    return frames


def rebuild_frames_512(native: list[Image.Image]) -> list[Image.Image]:
    F512.mkdir(exist_ok=True)
    out_frames = []
    for i, cell in enumerate(native):
        # Full-cell upscale 312 -> 512 (matches existing sheet intent)
        up = cell.resize((512, 512), Image.Resampling.LANCZOS)
        up = clear_edge_alpha(up, 1)
        path = F512 / f"frame-{i:02d}.png"
        up.save(path, optimize=True)
        out_frames.append(up)
        print(f"wrote {path.name} {up.size}")
    return out_frames


def rebuild_frames_256_from_512(frames512: list[Image.Image]) -> list[Image.Image]:
    F256.mkdir(exist_ok=True)
    out = []
    for i, fr in enumerate(frames512):
        down = fr.resize((256, 256), Image.Resampling.LANCZOS)
        down = clear_edge_alpha(down, 1)
        path = F256 / f"frame-{i:02d}.png"
        down.save(path, optimize=True)
        out.append(down)
        print(f"wrote {path.name} {down.size}")
    return out


def build_sheet(frames: list[Image.Image], cell: int, path: Path) -> None:
    sheet = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))
    for idx, fr in enumerate(frames):
        assert fr.size == (cell, cell), (idx, fr.size)
        row, col = idx // 4, idx % 4
        sheet.paste(fr, (col * cell, row * cell), fr)
    sheet.save(path, optimize=True)
    print(f"wrote {path.name} {sheet.size}")


def build_contact_sheet(frames: list[Image.Image], path: Path) -> None:
    """Labeled 4x4 contact sheet from 256 frames."""
    cell = 256
    pad = 16
    label_h = 28
    cols, rows = 4, 4
    bg = (18, 18, 22)
    w = cols * cell + (cols + 1) * pad
    h = rows * (cell + label_h) + (rows + 1) * pad
    sheet = Image.new("RGB", (w, h), bg)
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 16)
    except OSError:
        font = ImageFont.load_default()

    for idx, fr in enumerate(frames):
        row, col = idx // 4, idx % 4
        x = pad + col * (cell + pad)
        y = pad + row * (cell + label_h + pad)
        # dark cell plate
        plate = Image.new("RGBA", (cell, cell), (12, 12, 16, 255))
        rgba = fr.convert("RGBA")
        plate = Image.alpha_composite(plate, rgba)
        sheet.paste(plate.convert("RGB"), (x, y))
        label = f"FRAME {idx:02d}"
        # center-ish label under cell
        tw = draw.textlength(label, font=font) if hasattr(draw, "textlength") else len(label) * 8
        draw.text(
            (x + (cell - tw) / 2, y + cell + 6),
            label,
            fill=(212, 160, 48),
            font=font,
        )
    sheet.save(path, optimize=True)
    print(f"wrote {path.name} {sheet.size}")


def build_preview_gif(frames: list[Image.Image], path: Path, duration_ms: int = 90) -> None:
    # GIF needs palette; use disposal for transparency-ish dark bg
    imgs = []
    for fr in frames:
        bg = Image.new("RGBA", fr.size, (0, 0, 0, 255))
        comp = Image.alpha_composite(bg, fr.convert("RGBA"))
        imgs.append(comp.convert("P", palette=Image.Palette.ADAPTIVE, colors=255))
    imgs[0].save(
        path,
        save_all=True,
        append_images=imgs[1:],
        duration=duration_ms,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"wrote {path.name} frames={len(imgs)} size={imgs[0].size}")


def main() -> None:
    # Prefer re-extract from source-grid-1248 for exact cells
    native = extract_native_from_grid()
    print(f"native cells: {len(native)} x {native[0].size}")

    frames512 = rebuild_frames_512(native)
    frames256 = rebuild_frames_256_from_512(frames512)

    build_sheet(frames512, 512, ROOT / "spritesheet-512-4x4.png")
    build_sheet(frames256, 256, ROOT / "spritesheet-256-4x4.png")

    PREV.mkdir(exist_ok=True)
    build_contact_sheet(frames256, PREV / "contact-sheet.png")
    build_preview_gif(frames256, PREV / "preview.gif")

    # frame-order.txt already correct — leave if present
    order = PREV / "frame-order.txt"
    if not order.exists():
        order.write_text(
            "\n".join(
                [
                    "00: crouch-gather",
                    "01: low-flare",
                    "02: charge",
                    "03: wings-open",
                    "04: launch",
                    "05: upward-arc-1",
                    "06: upward-arc-2",
                    "07: apex-arc",
                    "08: apex-ring",
                    "09: descend-1",
                    "10: descend-2",
                    "11: falling",
                    "12: brake",
                    "13: impact-land",
                    "14: recover-crouch",
                    "15: stand-ready",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        print("wrote frame-order.txt")
    else:
        print("kept existing frame-order.txt")

    print("DONE rebuild")


if __name__ == "__main__":
    main()
