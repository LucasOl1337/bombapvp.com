"""Process Imagine basalt walls into 128px engine tiles."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance

SRC = Path(
    r"C:\Users\user\.grok\sessions\C%3A%5Cprojetos%5Cbombpvp"
    r"\019f7aa2-1047-72f1-828b-0e119f193b9c\images"
)
OUT = Path("game-assets/arenas/themes/tournament-clean")


def key_light(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if (r + g + b) / 3 > 235 and max(r, g, b) - min(r, g, b) < 20:
                px[x, y] = (0, 0, 0, 0)
    return im


def crop_content(im: Image.Image) -> Image.Image:
    bb = im.split()[-1].point(lambda v: 255 if v > 20 else 0).getbbox()
    return im.crop(bb) if bb else im


def to_rgb128(im: Image.Image) -> Image.Image:
    im = im.resize((128, 128), Image.Resampling.LANCZOS)
    bg = Image.new("RGB", (128, 128), (16, 14, 16))
    if im.mode == "RGBA":
        bg.paste(im.convert("RGB"), mask=im.split()[-1])
    else:
        bg.paste(im.convert("RGB"))
    return bg


def harden(im: Image.Image) -> Image.Image:
    im = ImageEnhance.Color(im).enhance(0.45)
    im = ImageEnhance.Brightness(im).enhance(0.68)
    im = ImageEnhance.Contrast(im).enhance(1.2)
    return im


def offset_half_brick(im: Image.Image, step: int = 16, shift: int = 32) -> Image.Image:
    out = Image.new("RGB", im.size)
    w, h = im.size
    for row in range(0, h, step):
        band_h = min(step, h - row)
        band = im.crop((0, row, w, row + band_h))
        if (row // step) % 2 == 1:
            left = band.crop((shift, 0, w, band_h))
            right = band.crop((0, 0, shift, band_h))
            shifted = Image.new("RGB", band.size)
            shifted.paste(left, (0, 0))
            shifted.paste(right, (w - shift, 0))
            out.paste(shifted, (0, row))
        else:
            out.paste(band, (0, row))
    return out


def process(src: str, dest: str, do_offset: bool) -> None:
    im = key_light(Image.open(SRC / src))
    im = crop_content(im)
    im = to_rgb128(im)
    im = harden(im)
    if do_offset:
        im = offset_half_brick(im)
    path = OUT / dest
    im.save(path, optimize=True)
    print(dest, path.stat().st_size, im.getpixel((0, 0)), im.getpixel((64, 64)))
    # 2x2 seam check
    sheet = Image.new("RGB", (256, 256))
    for i in range(2):
        for j in range(2):
            sheet.paste(im, (i * 128, j * 128))
    sheet.save(OUT / f"_qa-{dest.replace('.png', '')}-2x2.png")


def main() -> None:
    # 48 = first gen (base), 47 = variant
    process("48.jpg", "wall.png", do_offset=False)
    process("47.jpg", "wall-alt.png", do_offset=True)


if __name__ == "__main__":
    main()
