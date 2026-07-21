from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parent
report = {"files": {}, "frames_512": {}, "frames_256": {}, "atlas": {}, "checks": {}}


def info(p: Path):
    if not p.exists():
        return {"exists": False}
    im = Image.open(p)
    im.load()
    w, h = im.size
    mode = im.mode
    bands = im.getbands()
    has_alpha = "A" in bands or mode in ("RGBA", "LA", "PA")
    nbytes = p.stat().st_size
    out = {
        "exists": True,
        "size": [w, h],
        "mode": mode,
        "nbytes": nbytes,
        "has_alpha": has_alpha,
        "nonempty": nbytes > 0,
    }
    rgba = im.convert("RGBA")
    a = rgba.split()[-1]
    extrema = a.getextrema()
    out["alpha_extrema"] = list(extrema)
    px = a.load()
    border_hits = 0
    border_max = 0
    for x in range(w):
        for y in (0, h - 1):
            v = px[x, y]
            if v > 0:
                border_hits += 1
                border_max = max(border_max, v)
    for y in range(1, h - 1):
        for x in (0, w - 1):
            v = px[x, y]
            if v > 0:
                border_hits += 1
                border_max = max(border_max, v)
    out["border_alpha_hits"] = border_hits
    out["border_alpha_max"] = border_max
    bbox = a.getbbox()
    out["alpha_bbox"] = list(bbox) if bbox else None
    opaque = sum(1 for v in a.getdata() if v > 10)
    out["near_opaque_pixels"] = opaque
    magentaish = 0
    high_magenta = 0
    for r, g, b, av in rgba.getdata():
        if av < 8:
            continue
        if r > 180 and b > 180 and g < 120:
            magentaish += 1
            if r > 220 and b > 220 and g < 80:
                high_magenta += 1
    out["magentaish_pixels"] = magentaish
    out["high_magenta_pixels"] = high_magenta
    return out


for name in [
    "source-generated-grid.png",
    "source-chromakey-removed.png",
    "source-grid-1248.png",
    "spritesheet-512-4x4.png",
    "spritesheet-256-4x4.png",
    "preview/contact-sheet.png",
    "preview/preview.gif",
]:
    report["files"][name] = info(root / name)

for folder, key, expected in [
    ("frames-512", "frames_512", 512),
    ("frames-256", "frames_256", 256),
]:
    issues = []
    frames = sorted((root / folder).glob("frame-*.png"))
    report[key]["count"] = len(frames)
    report[key]["names"] = [f.name for f in frames]
    details = []
    for f in frames:
        d = info(f)
        d["name"] = f.name
        details.append(d)
        if d["size"] != [expected, expected]:
            issues.append(f"{f.name} size {d['size']}")
        if not d.get("has_alpha"):
            issues.append(f"{f.name} no alpha")
        if d.get("border_alpha_hits", 0) > 0:
            issues.append(
                f"{f.name} border alpha hits={d['border_alpha_hits']} max={d['border_alpha_max']}"
            )
        if d.get("high_magenta_pixels", 0) > 0:
            issues.append(f"{f.name} high magenta={d['high_magenta_pixels']}")
        if d.get("near_opaque_pixels", 0) < 50:
            issues.append(f"{f.name} nearly empty opaque={d.get('near_opaque_pixels')}")
    report[key]["details"] = details
    report[key]["issues"] = issues


def check_atlas(sheet_path, frame_dir, cell):
    sheet = Image.open(sheet_path).convert("RGBA")
    sw, sh = sheet.size
    issues = []
    if sw % 4 or sh % 4:
        issues.append(f"atlas not divisible by 4: {sw}x{sh}")
    if sw != cell * 4 or sh != cell * 4:
        issues.append(f"expected {cell*4}x{cell*4}, got {sw}x{sh}")
    mismatches = []
    for i in range(16):
        row, col = i // 4, i % 4
        box = (col * cell, row * cell, (col + 1) * cell, (row + 1) * cell)
        cell_im = sheet.crop(box)
        fp = frame_dir / f"frame-{i:02d}.png"
        fr = Image.open(fp).convert("RGBA")
        if fr.size != (cell, cell):
            mismatches.append(f"frame {i} size mismatch")
            continue
        if list(cell_im.getdata()) != list(fr.getdata()):
            diff = sum(1 for a, b in zip(cell_im.getdata(), fr.getdata()) if a != b)
            mismatches.append(f"frame {i} pixel diffs={diff}")
    return {"sheet_size": [sw, sh], "issues": issues, "mismatches": mismatches}


report["atlas"]["512"] = check_atlas(
    root / "spritesheet-512-4x4.png", root / "frames-512", 512
)
report["atlas"]["256"] = check_atlas(
    root / "spritesheet-256-4x4.png", root / "frames-256", 256
)

gif_path = root / "preview" / "preview.gif"
if gif_path.exists():
    g = Image.open(gif_path)
    n = 0
    durations = []
    try:
        while True:
            durations.append(g.info.get("duration"))
            n += 1
            g.seek(n)
    except EOFError:
        pass
    g0 = Image.open(gif_path)
    report["gif"] = {
        "frames": n,
        "durations_ms": durations,
        "size": list(g0.size),
        "mode": g0.mode,
    }

cs = root / "preview" / "contact-sheet.png"
if cs.exists():
    cim = Image.open(cs)
    report["contact"] = {"size": list(cim.size), "mode": cim.mode}

fo = (root / "preview" / "frame-order.txt").read_text(encoding="utf-8", errors="replace")
report["frame_order_txt"] = fo

# summary table of frame bbox and magenta for 512
summary = []
for d in report["frames_512"]["details"]:
    summary.append(
        {
            "name": d["name"],
            "bbox": d.get("alpha_bbox"),
            "border": d.get("border_alpha_hits"),
            "magentaish": d.get("magentaish_pixels"),
            "high_mag": d.get("high_magenta_pixels"),
            "opaque": d.get("near_opaque_pixels"),
        }
    )
report["frame_summary_512"] = summary

# print compact first
compact = {
    "files": {
        k: {
            "exists": v.get("exists"),
            "size": v.get("size"),
            "mode": v.get("mode"),
            "has_alpha": v.get("has_alpha"),
            "nbytes": v.get("nbytes"),
            "border_alpha_hits": v.get("border_alpha_hits"),
            "magentaish": v.get("magentaish_pixels"),
            "high_mag": v.get("high_magenta_pixels"),
            "alpha_bbox": v.get("alpha_bbox"),
        }
        for k, v in report["files"].items()
    },
    "frames_512_count": report["frames_512"]["count"],
    "frames_512_issues": report["frames_512"]["issues"],
    "frames_256_count": report["frames_256"]["count"],
    "frames_256_issues": report["frames_256"]["issues"],
    "atlas": report["atlas"],
    "gif": report.get("gif"),
    "contact": report.get("contact"),
    "frame_order_txt": report["frame_order_txt"],
    "frame_summary_512": summary,
}
print(json.dumps(compact, indent=2))
