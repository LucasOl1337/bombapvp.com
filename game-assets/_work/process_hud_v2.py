"""Crop/key HUD chrome + icons into engine-ready PNGs."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

SRC = Path(
    r"C:\Users\user\.grok\sessions\C%3A%5Cprojetos%5Cbombpvp"
    r"\019f7aa2-1047-72f1-828b-0e119f193b9c\images"
)
CHROME = Path("game-assets/ui/hud/chrome")
ICONS = Path("game-assets/ui/hud/icons")


def to_rgba(im: Image.Image) -> Image.Image:
    return im.convert("RGBA")


def key_light_background(im: Image.Image, thr: int = 220) -> Image.Image:
    """Make near-white / light-gray checker transparent."""
    im = to_rgba(im)
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            avg = (r + g + b) / 3
            # pure white / light gray checker
            if avg >= thr and max(r, g, b) - min(r, g, b) < 18:
                px[x, y] = (0, 0, 0, 0)
            # soft fringe
            elif avg >= thr - 30 and max(r, g, b) - min(r, g, b) < 25:
                fade = int(255 * (thr - avg) / 30)
                px[x, y] = (r, g, b, max(0, min(255, fade)))
    return im


def content_bbox(im: Image.Image, alpha_thresh: int = 20):
    a = im.split()[-1]
    return a.point(lambda v: 255 if v > alpha_thresh else 0).getbbox()


def crop_to_content(im: Image.Image, pad: int = 2) -> Image.Image:
    bb = content_bbox(im)
    if not bb:
        return im
    l, t, r, b = bb
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def force_dark_center(im: Image.Image, border_frac: float = 0.12) -> Image.Image:
    im = to_rgba(im)
    w, h = im.size
    bx = max(8, int(w * border_frac))
    by = max(8, int(h * border_frac))
    px = im.load()
    for y in range(by, h - by):
        for x in range(bx, w - bx):
            r, g, b, a = px[x, y]
            if a < 200:
                px[x, y] = (10, 10, 15, 255)
            else:
                # clamp to night so text is always legible
                lum = (r + g + b) / 3
                if lum > 35:
                    px[x, y] = (12, 12, 18, 255)
                else:
                    px[x, y] = (min(r, 16), min(g, 16), min(b, 20), 255)
    return im


def process_panel(src_name: str, out_name: str, target: tuple[int, int] | None = None) -> None:
    im = Image.open(SRC / src_name)
    im = key_light_background(im)
    im = crop_to_content(im)
    im = force_dark_center(im)
    if target:
        im = im.resize(target, Image.Resampling.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    # Flatten any residual alpha on panel body to solid (edges can keep soft alpha)
    out = CHROME / out_name
    im.save(out, optimize=True)
    print(f"panel {out_name}: {im.size} bytes={out.stat().st_size} corner={im.getpixel((0,0))}")


def process_icon(src_name: str, out_name: str, size: int = 64) -> None:
    im = key_light_background(Image.open(SRC / src_name), thr=200)
    im = crop_to_content(im)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.ellipse(
        [1, 1, size - 2, size - 2],
        fill=(16, 16, 22, 255),
        outline=(200, 205, 215, 230),
        width=2,
    )
    bb = content_bbox(im)
    sub = im.crop(bb) if bb else im
    target = int(size * 0.68)
    scale = target / max(sub.width, sub.height)
    nw, nh = max(1, int(sub.width * scale)), max(1, int(sub.height * scale))
    sub = sub.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(sub, ((size - nw) // 2, (size - nh) // 2), sub)
    out = ICONS / out_name
    canvas.save(out, optimize=True)
    print(f"icon {out_name}: {canvas.size} bytes={out.stat().st_size}")


def main() -> None:
    process_panel("41.jpg", "panel-local-v1.png", target=(960, 120))
    process_panel("39.jpg", "panel-rival-v1.png", target=(480, 96))
    process_panel("38.jpg", "panel-center-v1.png", target=(192, 192))
    process_panel("37.jpg", "chip-ult-v1.png", target=(192, 72))

    process_icon("42.jpg", "icon-bomb-v1.png")
    process_icon("43.jpg", "icon-flame-v1.png")
    process_icon("40.jpg", "icon-speed-v1.png")
    print("DONE")


if __name__ == "__main__":
    main()
