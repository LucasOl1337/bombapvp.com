from pathlib import Path
from collections import Counter
from PIL import Image

root = Path(__file__).resolve().parent


def sample_mag(path: Path, limit: int = 20):
    rgba = Image.open(path).convert("RGBA")
    w, h = rgba.size
    samples = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = rgba.getpixel((x, y))
            if (
                a > 8
                and r >= 180
                and b >= 180
                and g <= 120
                and (r - g) > 60
                and (b - g) > 60
            ):
                samples.append((r, g, b, a, x, y))
    print(f"\n{path.name}: magenta_like={len(samples)}")
    # bucket by rounded color
    buckets = Counter((r // 8 * 8, g // 8 * 8, b // 8 * 8) for r, g, b, a, x, y in samples)
    print(" top buckets:", buckets.most_common(8))
    for s in samples[:limit]:
        print(" ", s)
    # pure-ish key magenta FF00FF-ish
    pure = [
        s
        for s in samples
        if s[0] >= 230 and s[2] >= 230 and s[1] <= 40
    ]
    print(f" pure_key_magenta={len(pure)}")
    # pink/magenta clothing-like vs key
    keyish = [
        s
        for s in samples
        if s[0] >= 200 and s[2] >= 200 and s[1] <= 80 and abs(s[0] - s[2]) < 40
    ]
    print(f" keyish_magenta={len(keyish)}")


for i in [0, 7, 8, 9, 10, 11, 15]:
    sample_mag(root / "frames-512" / f"frame-{i:02d}.png")

sample_mag(root / "spritesheet-512-4x4.png", limit=10)
sample_mag(root / "source-generated-grid.png", limit=5)
sample_mag(root / "source-chromakey-removed.png", limit=5)
