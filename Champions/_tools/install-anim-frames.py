#!/usr/bin/env python3
"""Harvest + key + install champion animation frames.

Pipeline per action/dir:
  raw frames (ffmpeg) → pick N evenly → corner-flood key black → 124x124 PNG.

Usage examples:
  python Champions/_tools/install-anim-frames.py \\
    --raw Champions/ranni/rebuild/v2/raw/walk-south \\
    --out Champions/ranni/assets/animations --action walk --dir south --count 8

  python Champions/_tools/install-anim-frames.py --still still.jpg --out ... --dir south
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

from PIL import Image


def corner_flood_key(
    im: Image.Image,
    *,
    max_rgb: int = 28,
    fuzz: int = 18,
) -> Image.Image:
    """Make near-black background transparent via 4-corner flood fill."""
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    visited = [[False] * h for _ in range(w)]
    stack: list[tuple[int, int]] = []

    def is_bg(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a == 0:
            return True
        # Near pure black (background plate).
        return r <= max_rgb + fuzz and g <= max_rgb + fuzz and b <= max_rgb + fuzz

    for sx, sy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if is_bg(sx, sy):
            stack.append((sx, sy))

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or visited[x][y]:
            continue
        if not is_bg(x, y):
            continue
        visited[x][y] = True
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return rgba


def content_bbox(im: Image.Image, alpha_min: int = 16) -> tuple[int, int, int, int] | None:
    a = im.split()[-1]
    return a.getbbox() if a.getextrema()[1] >= alpha_min else None


def fit_square(
    im: Image.Image,
    size: int = 124,
    pad: float = 0.10,
    bottom_extra: float = 0.10,
) -> Image.Image:
    """Fit full-body subject into size×size with transparent pad.

    Leaves EXTRA empty space below the feet (like Ranni) so the
    selection card vignette never crops ankles/feet. Subject is scaled to
    fit height with bottom_extra reserved.
    """
    keyed = im if im.mode == "RGBA" else im.convert("RGBA")
    box = content_bbox(keyed)
    if not box:
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        return out
    subject = keyed.crop(box)
    sw, sh = subject.size
    # Usable height: leave pad top + pad+bottom_extra bottom.
    top_pad = pad
    bot_pad = pad + bottom_extra
    usable_h = size * (1.0 - top_pad - bot_pad)
    usable_w = size * (1.0 - pad * 2)
    scale = min(usable_w / sw, usable_h / sh)
    nw = max(1, int(round(sw * scale)))
    nh = max(1, int(round(sh * scale)))
    subject = subject.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = (size - nw) // 2
    # Sit on the reserved ground line (not vertically centered).
    oy = int(round(size * top_pad + (usable_h - nh) * 0.5))
    out.paste(subject, (ox, oy), subject)
    return out


def list_frames(raw_dir: Path) -> list[Path]:
    frames = sorted(
        [
            p
            for p in raw_dir.iterdir()
            if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
        ]
    )
    if not frames:
        raise SystemExit(f"no frames in {raw_dir}")
    return frames


def pick_indices(n_src: int, n_out: int) -> list[int]:
    if n_out <= 1:
        return [0]
    if n_out >= n_src:
        return list(range(n_src))
    # Skip first/last 8% (often settle/loop glitch), sample evenly.
    lo = int(n_src * 0.08)
    hi = max(lo + 1, int(n_src * 0.92))
    span = hi - lo
    return [lo + int(round(i * (span - 1) / (n_out - 1))) for i in range(n_out)]


def install_sequence(
    raw_dir: Path,
    out_dir: Path,
    action: str,
    direction: str,
    count: int,
    size: int,
    max_rgb: int,
    fuzz: int,
) -> list[Path]:
    frames = list_frames(raw_dir)
    idxs = pick_indices(len(frames), count)
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for i, src_i in enumerate(idxs):
        im = Image.open(frames[src_i])
        keyed = corner_flood_key(im, max_rgb=max_rgb, fuzz=fuzz)
        final = fit_square(keyed, size=size)
        dest = out_dir / f"{action}-{direction}-{i}.png"
        final.save(dest, optimize=True)
        written.append(dest)
        print(f"  wrote {dest.name} from {frames[src_i].name}")
    return written


def install_still(
    still: Path,
    out_dir: Path,
    direction: str,
    size: int,
    max_rgb: int,
    fuzz: int,
) -> Path:
    im = Image.open(still)
    keyed = corner_flood_key(im, max_rgb=max_rgb, fuzz=fuzz)
    final = fit_square(keyed, size=size)
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / f"{direction}.png"
    final.save(dest, optimize=True)
    print(f"  wrote still {dest}")
    return dest


def mirror_east_to_west(out_dir: Path, actions: list[str]) -> None:
    for action in actions:
        for east in sorted(out_dir.glob(f"{action}-east-*.png")):
            idx = east.stem.split("-")[-1]
            west = out_dir / f"{action}-west-{idx}.png"
            im = Image.open(east).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            im.save(west, optimize=True)
            print(f"  mirrored {east.name} -> {west.name}")
    east_still = out_dir / "east.png"
    if east_still.exists():
        west_still = out_dir / "west.png"
        Image.open(east_still).transpose(Image.Transpose.FLIP_LEFT_RIGHT).save(
            west_still, optimize=True
        )
        print(f"  mirrored east.png -> west.png")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", type=Path, help="raw frame directory")
    ap.add_argument("--still", type=Path, help="single still image")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--action", default="walk")
    ap.add_argument("--dir", dest="direction", required=True)
    ap.add_argument("--count", type=int, default=8)
    ap.add_argument("--size", type=int, default=124)
    ap.add_argument("--max-rgb", type=int, default=28)
    ap.add_argument("--fuzz", type=int, default=18)
    ap.add_argument("--mirror-west-from-east", action="store_true")
    ap.add_argument(
        "--mirror-actions",
        default="idle,walk,run,cast,attack,death",
        help="comma actions for --mirror-west-from-east",
    )
    args = ap.parse_args()

    if args.mirror_west_from_east:
        mirror_east_to_west(args.out, [a.strip() for a in args.mirror_actions.split(",") if a.strip()])
        return

    if args.still:
        install_still(args.still, args.out, args.direction, args.size, args.max_rgb, args.fuzz)
        return

    if not args.raw:
        ap.error("need --raw or --still or --mirror-west-from-east")
    install_sequence(
        args.raw,
        args.out,
        args.action,
        args.direction,
        args.count,
        args.size,
        args.max_rgb,
        args.fuzz,
    )


if __name__ == "__main__":
    main()
