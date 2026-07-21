from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
gif = Image.open(root / "preview" / "preview.gif")

print("n_frames", gif.n_frames, "size", gif.size)
print("info", gif.info)
print("transparency key", gif.info.get("transparency"))

for i in range(gif.n_frames):
    gif.seek(i)
    frame = gif.convert("RGBA")
    w, h = frame.size
    px = list(frame.getdata())
    opaque = sum(1 for r, g, b, a in px if a > 0)
    border_op = 0
    for x in range(w):
        if frame.getpixel((x, 0))[3] > 0:
            border_op += 1
        if frame.getpixel((x, h - 1))[3] > 0:
            border_op += 1
    for y in range(1, h - 1):
        if frame.getpixel((0, y))[3] > 0:
            border_op += 1
        if frame.getpixel((w - 1, y))[3] > 0:
            border_op += 1
    # sample corners and center
    corners = [frame.getpixel(p) for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, h // 2)]]
    print(f"f{i:02d}: opaque={opaque} border_op={border_op} duration={gif.info.get('duration')} corners/center={corners}")

# compare order: does gif frame i match frames-256 frame i roughly?
print("\n=== GIF vs frames-256 similarity (opaque count + hash of alpha mask) ===")
for i in range(16):
    gif.seek(i)
    g = gif.convert("RGBA")
    f = Image.open(root / "frames-256" / f"frame-{i:02d}.png").convert("RGBA")
    # mean absolute alpha diff
    gp = list(g.getdata())
    fp = list(f.getdata())
    a_diff = sum(abs(a1 - a2) for (_, _, _, a1), (_, _, _, a2) in zip(gp, fp)) / len(gp)
    # RGB diff on opaque union
    rgb_diff = 0
    n = 0
    for (r1, g1, b1, a1), (r2, g2, b2, a2) in zip(gp, fp):
        if a1 > 32 or a2 > 32:
            rgb_diff += abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)
            n += 1
    rgb_mean = rgb_diff / max(n, 1)
    print(f"i={i:02d} alpha_mad={a_diff:.2f} rgb_mad_opaque={rgb_mean:.2f}")
