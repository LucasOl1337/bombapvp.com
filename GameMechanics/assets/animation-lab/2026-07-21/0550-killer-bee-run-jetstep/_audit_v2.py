"""Audit Killer Bee run jetstep v2 candidate: structure + magenta/purple halo."""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

BASE = Path(__file__).resolve().parent


def is_magenta_purple(r: int, g: int, b: int, a: int) -> bool:
    """Detect magenta/purple chromakey spill."""
    if a < 10:
        return False
    maxc = max(r, g, b)
    if maxc < 30:
        return False
    rb = (r + b) / 2.0
    green_deficit = rb - g
    is_mag = r >= 80 and b >= 80 and g < min(r, b) * 0.75 and green_deficit >= 40
    is_purp = (
        b >= 90
        and r >= 50
        and g < b * 0.7
        and g < r * 0.85
        and (b - g) >= 35
        and (r + b) > 1.4 * (g + 1)
    )
    is_pink_spill = a < 200 and r >= 100 and b >= 80 and g < r * 0.65 and (r - g) >= 40
    return bool(is_mag or is_purp or is_pink_spill)


def analyze_frame(path: Path) -> dict:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    a = arr[:, :, 3].astype(np.int16)

    opaque = a >= 200
    transparent = a == 0
    partial = (a > 0) & (a < 200)

    pad = np.pad(opaque, 1, constant_values=False)
    neigh = (
        pad[0:-2, 1:-1]
        | pad[2:, 1:-1]
        | pad[1:-1, 0:-2]
        | pad[1:-1, 2:]
        | pad[0:-2, 0:-2]
        | pad[0:-2, 2:]
        | pad[2:, 0:-2]
        | pad[2:, 2:]
    )
    interior = (
        pad[0:-2, 1:-1]
        & pad[2:, 1:-1]
        & pad[1:-1, 0:-2]
        & pad[1:-1, 2:]
    )
    edge = (neigh & (~opaque)) | (opaque & (~interior))
    edge_zone = edge | partial

    border = np.zeros((h, w), dtype=bool)
    border[:2, :] = True
    border[-2:, :] = True
    border[:, :2] = True
    border[:, -2:] = True
    border_alpha_nonzero = int(np.sum(border & (a > 0)))
    border_alpha_max = int(a[border].max()) if border.any() else 0

    # vectorized magenta-ish flags (approx of is_magenta_purple)
    maxc = np.maximum(np.maximum(r, g), b)
    rb = (r.astype(np.float32) + b.astype(np.float32)) / 2.0
    green_deficit = rb - g
    is_mag = (a >= 10) & (maxc >= 30) & (r >= 80) & (b >= 80) & (g < np.minimum(r, b) * 0.75) & (green_deficit >= 40)
    is_purp = (
        (a >= 10)
        & (maxc >= 30)
        & (b >= 90)
        & (r >= 50)
        & (g < b * 0.7)
        & (g < r * 0.85)
        & ((b - g) >= 35)
        & ((r + b) > 1.4 * (g + 1))
    )
    is_pink = (a >= 10) & (a < 200) & (r >= 100) & (b >= 80) & (g < r * 0.65) & ((r - g) >= 40)
    mag_mask = is_mag | is_purp | is_pink

    mag_total = int(mag_mask.sum())
    mag_edge = int((mag_mask & edge_zone).sum())
    mag_opaque = int((mag_mask & opaque).sum())

    # HSV-like hue for purple/magenta band
    rr = r / 255.0
    gg = g / 255.0
    bb = b / 255.0
    mx = np.maximum(np.maximum(rr, gg), bb)
    mn = np.minimum(np.minimum(rr, gg), bb)
    diff = mx - mn + 1e-9
    hue = np.zeros_like(mx)
    mask_r = (mx == rr) & (diff > 1e-8)
    mask_g = (mx == gg) & (diff > 1e-8)
    mask_b = (mx == bb) & (diff > 1e-8)
    hue[mask_r] = ((gg[mask_r] - bb[mask_r]) / diff[mask_r]) % 6
    hue[mask_g] = ((bb[mask_g] - rr[mask_g]) / diff[mask_g]) + 2
    hue[mask_b] = ((rr[mask_b] - gg[mask_b]) / diff[mask_b]) + 4
    hue = hue * 60.0
    sat = diff / (mx + 1e-9)
    hue_mag = (
        (((hue >= 270) & (hue <= 330)) | ((hue >= 300) & (hue <= 360)) | ((hue >= 0) & (hue <= 20) & (bb > gg)))
        & (sat > 0.25)
        & (mx > 0.15)
        & (a > 8)
        & (g < np.maximum(r, b) * 0.85)
    )
    hue_mag_count = int(hue_mag.sum())
    hue_mag_edge = int((hue_mag & edge_zone).sum())

    score = rb - g
    high_mag_edge = int(
        np.sum(
            (score >= 40)
            & edge_zone
            & (a > 5)
            & (r >= 60)
            & (b >= 60)
            & (g < np.minimum(r, b) * 0.8)
        )
    )
    edge_scores = score[edge_zone & (a > 5)]
    max_edge_mag_score = float(edge_scores.max()) if edge_scores.size else 0.0
    mean_edge_mag_score = float(edge_scores.mean()) if edge_scores.size else 0.0

    if partial.any():
        mean_partial = [
            float(r[partial].mean()),
            float(g[partial].mean()),
            float(b[partial].mean()),
            float(a[partial].mean()),
        ]
    else:
        mean_partial = None

    # Top magenta edge sample colors for diagnostics
    samples = []
    if mag_edge > 0:
        ys, xs = np.where(mag_mask & edge_zone)
        # take up to 5 highest score samples
        scores_s = score[ys, xs]
        order = np.argsort(-scores_s)[:5]
        for idx in order:
            yy, xx = int(ys[idx]), int(xs[idx])
            samples.append(
                {
                    "xy": [xx, yy],
                    "rgba": [int(r[yy, xx]), int(g[yy, xx]), int(b[yy, xx]), int(a[yy, xx])],
                    "score": float(score[yy, xx]),
                }
            )

    return {
        "path": path.name,
        "size": [w, h],
        "opaque_px": int(opaque.sum()),
        "transparent_px": int(transparent.sum()),
        "partial_px": int(partial.sum()),
        "border_alpha_nonzero": border_alpha_nonzero,
        "border_alpha_max": border_alpha_max,
        "mag_total": mag_total,
        "mag_edge": mag_edge,
        "mag_opaque": mag_opaque,
        "hue_mag_count": hue_mag_count,
        "hue_mag_edge": hue_mag_edge,
        "high_mag_edge": high_mag_edge,
        "max_edge_mag_score": max_edge_mag_score,
        "mean_edge_mag_score": mean_edge_mag_score,
        "mean_partial_rgba": mean_partial,
        "mag_samples": samples,
    }


def verify_sheet_vs_frames(sheet_path: Path, frames_dir: Path, cell: int) -> dict:
    sheet = Image.open(sheet_path).convert("RGBA")
    sw, sh = sheet.size
    expected = (cell * 4, cell * 4)
    ok_size = (sw, sh) == expected
    mismatches = []
    if ok_size:
        for i in range(16):
            row, col = divmod(i, 4)
            # row-major: i = row*4+col
            row = i // 4
            col = i % 4
            crop = sheet.crop((col * cell, row * cell, (col + 1) * cell, (row + 1) * cell))
            frame = Image.open(frames_dir / f"frame-{i:02d}.png").convert("RGBA")
            if list(crop.getdata()) != list(frame.getdata()):
                # allow tiny float differences via array
                a = np.array(crop)
                b = np.array(frame)
                diff = int(np.sum(a != b))
                if diff > 0:
                    mismatches.append({"frame": i, "diff_px_channels": diff})
    return {
        "sheet": sheet_path.name,
        "frames_dir": frames_dir.name,
        "sheet_size": [sw, sh],
        "expected_size": list(expected),
        "size_ok": ok_size,
        "mismatches": mismatches,
        "frames_match_sheet": ok_size and len(mismatches) == 0,
    }


def verify_frame_order(path: Path) -> dict:
    text = path.read_text(encoding="utf-8").strip().splitlines()
    expected_prefixes = [f"{i:02d}:" for i in range(16)]
    lines_ok = len(text) == 16
    order_ok = lines_ok and all(text[i].startswith(expected_prefixes[i]) for i in range(16))
    return {
        "path": str(path.relative_to(BASE)).replace("\\", "/"),
        "line_count": len(text),
        "lines": text,
        "order_ok": order_ok,
    }


def main() -> int:
    report: dict = {
        "candidate": "0550-killer-bee-run-jetstep",
        "version": "v2",
        "scope": str(BASE),
        "checks": {},
        "verdict": None,
        "failures": [],
        "passes": [],
    }

    # --- structure: 16 frames ---
    for folder, size in [("frames-256-v2", 256), ("frames-512-v2", 512)]:
        d = BASE / folder
        files = sorted(p.name for p in d.glob("frame-*.png"))
        expected = [f"frame-{i:02d}.png" for i in range(16)]
        sizes = {}
        modes = {}
        for f in expected:
            p = d / f
            if p.exists():
                im = Image.open(p)
                sizes[f] = list(im.size)
                modes[f] = im.mode
        count_ok = files == expected
        dim_ok = all(sizes.get(f) == [size, size] for f in expected)
        mode_ok = all(modes.get(f) == "RGBA" for f in expected)
        key = f"frames_{size}_v2"
        report["checks"][key] = {
            "count": len(files),
            "expected_count": 16,
            "files": files,
            "count_ok": count_ok,
            "dim_ok": dim_ok,
            "mode_ok": mode_ok,
            "sizes_sample": {k: sizes[k] for k in list(sizes)[:3]},
            "modes_unique": sorted(set(modes.values())),
        }
        if count_ok and dim_ok and mode_ok:
            report["passes"].append(f"{folder}: 16 RGBA {size}x{size} frames in order")
        else:
            report["failures"].append(f"{folder}: structure fail count_ok={count_ok} dim_ok={dim_ok} mode_ok={mode_ok}")

    # --- atlases ---
    atlas_specs = [
        ("spritesheet-256-4x4-v2.png", 1024, "frames-256-v2", 256),
        ("spritesheet-512-4x4-v2.png", 2048, "frames-512-v2", 512),
    ]
    for name, side, fdir, cell in atlas_specs:
        p = BASE / name
        im = Image.open(p)
        size_ok = im.size == (side, side)
        mode_ok = im.mode == "RGBA"
        match = verify_sheet_vs_frames(p, BASE / fdir, cell)
        report["checks"][name] = {
            "size": list(im.size),
            "mode": im.mode,
            "size_ok": size_ok,
            "mode_ok": mode_ok,
            "match": match,
        }
        if size_ok and mode_ok and match["frames_match_sheet"]:
            report["passes"].append(f"{name}: {side}x{side} RGBA matches {fdir}")
        else:
            report["failures"].append(
                f"{name}: atlas fail size_ok={size_ok} mode_ok={mode_ok} match={match['frames_match_sheet']} mismatches={len(match['mismatches'])}"
            )

    # source grids
    for name, side in [("source-grid-1248-v2.png", 1248), ("source-chromakey-removed-v2.png", 1254)]:
        p = BASE / name
        im = Image.open(p)
        report["checks"][name] = {"size": list(im.size), "mode": im.mode, "exists": True}
        if im.size == (side, side):
            report["passes"].append(f"{name}: {side}x{side} present")
        else:
            report["failures"].append(f"{name}: unexpected size {im.size}, expected {side}x{side}")

    # --- preview ---
    prev = BASE / "preview-v2"
    order = verify_frame_order(prev / "frame-order.txt")
    report["checks"]["frame_order"] = order
    if order["order_ok"]:
        report["passes"].append("preview-v2/frame-order.txt: 00..15 sequential labels")
    else:
        report["failures"].append("preview-v2/frame-order.txt: order invalid")

    cs = Image.open(prev / "contact-sheet.png")
    gif = Image.open(prev / "preview.gif")
    report["checks"]["preview"] = {
        "contact_sheet_size": list(cs.size),
        "contact_sheet_mode": cs.mode,
        "preview_gif_size": list(gif.size),
        "preview_gif_mode": gif.mode,
        "preview_gif_n_frames": getattr(gif, "n_frames", 1),
        "contact_exists": True,
        "gif_exists": True,
    }
    gif_ok = gif.size == (256, 256) and getattr(gif, "n_frames", 1) >= 16
    cs_ok = cs.size[0] >= 1024 and cs.size[1] >= 1024
    if gif_ok and cs_ok:
        report["passes"].append(
            f"preview-v2: contact-sheet {cs.size}, gif {gif.size} n_frames={getattr(gif,'n_frames',1)}"
        )
    else:
        report["failures"].append(f"preview-v2: contact/gif fail cs_ok={cs_ok} gif_ok={gif_ok}")

    # --- alpha edges + magenta halo on frames ---
    halo_details = {"frames-256-v2": [], "frames-512-v2": []}
    for folder, thr in [("frames-256-v2", {"mag_edge": 5, "hue_mag_edge": 10, "high_mag_edge": 5}),
                        ("frames-512-v2", {"mag_edge": 10, "hue_mag_edge": 20, "high_mag_edge": 10})]:
        failed = []
        for i in range(16):
            metrics = analyze_frame(BASE / folder / f"frame-{i:02d}.png")
            halo_details[folder].append(metrics)
            border_fail = metrics["border_alpha_nonzero"] > 0
            halo_fail = (
                metrics["mag_edge"] > thr["mag_edge"]
                or metrics["hue_mag_edge"] > thr["hue_mag_edge"]
                or metrics["high_mag_edge"] > thr["high_mag_edge"]
            )
            # mean partial R/B dominance also flags purple spill
            mp = metrics["mean_partial_rgba"]
            partial_spill = False
            if mp is not None and mp[3] > 5:
                # if mean partial is magenta-ish (R and B both clearly above G)
                if mp[0] >= 80 and mp[2] >= 80 and mp[1] < min(mp[0], mp[2]) * 0.75:
                    partial_spill = True
            metrics["border_fail"] = border_fail
            metrics["halo_fail"] = halo_fail or partial_spill
            metrics["partial_spill"] = partial_spill
            if border_fail or halo_fail or partial_spill:
                failed.append(metrics["path"])
        report["checks"][f"halo_{folder}"] = {
            "failed_frames": failed,
            "thresholds": thr,
            "per_frame": halo_details[folder],
        }
        if not failed and all(m["border_alpha_nonzero"] == 0 for m in halo_details[folder]):
            report["passes"].append(f"{folder}: no magenta/purple halo above thresholds; canvas borders clean")
        else:
            report["failures"].append(
                f"{folder}: HALO/ALPHA FAIL on {failed if failed else 'border'}"
            )

    # also analyze sheets for halo
    for sheet in [
        "spritesheet-256-4x4-v2.png",
        "spritesheet-512-4x4-v2.png",
        "source-grid-1248-v2.png",
        "source-chromakey-removed-v2.png",
    ]:
        m = analyze_frame(BASE / sheet)
        report["checks"][f"halo_{sheet}"] = m
        # sheets: higher tolerance absolute counts
        thr_mag = 40 if "512" in sheet or "1248" in sheet or "1254" in sheet or "chromakey" in sheet else 20
        if m["mag_edge"] > thr_mag or m["high_mag_edge"] > thr_mag:
            report["failures"].append(
                f"{sheet}: magenta edge spill mag_edge={m['mag_edge']} high={m['high_mag_edge']} samples={m['mag_samples'][:3]}"
            )
        else:
            report["passes"].append(
                f"{sheet}: mag_edge={m['mag_edge']} high={m['high_mag_edge']} within thr={thr_mag}"
            )

    # also check source-generated-grid for original key color (info only)
    src = BASE / "source-generated-grid.png"
    if src.exists():
        sim = Image.open(src).convert("RGBA")
        sarr = np.array(sim)
        # sample corners for key color
        corners = [
            sarr[5, 5].tolist(),
            sarr[5, -6].tolist(),
            sarr[-6, 5].tolist(),
            sarr[-6, -6].tolist(),
            sarr[sim.size[1] // 2, 5].tolist(),
        ]
        report["checks"]["source_key_color_samples"] = corners

    # Verdict
    structure_fail = any("structure fail" in f or "atlas fail" in f or "order invalid" in f or "contact/gif fail" in f for f in report["failures"])
    halo_fail = any("HALO" in f or "magenta" in f.lower() for f in report["failures"])

    if not report["failures"]:
        report["verdict"] = "PASS"
        report["promotion"] = False  # still lab only; promotion is separate decision
        report["summary"] = "v2 structural + halo checks passed. No Champions/runtime promotion performed."
    elif not structure_fail and halo_fail:
        report["verdict"] = "FAIL_HALO"
        report["promotion"] = False
        report["summary"] = (
            "Structural checks may pass, but magenta/purple chromakey halo or edge alpha issues persist. "
            "Do NOT promote. Recorded as failed cleanup."
        )
    else:
        report["verdict"] = "FAIL"
        report["promotion"] = False
        report["summary"] = "One or more structural/halo checks failed. Do NOT promote."

    out = BASE / "_audit-report-v2.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    # compact human summary
    print("VERDICT:", report["verdict"])
    print("PASSES:")
    for p in report["passes"]:
        print("  +", p)
    print("FAILURES:")
    for fl in report["failures"]:
        print("  -", fl)
    print("summary:", report["summary"])
    print("wrote", out)

    # print per-frame compact halo table
    for folder in ["frames-256-v2", "frames-512-v2"]:
        print(f"\n=== {folder} ===")
        for m in report["checks"][f"halo_{folder}"]["per_frame"]:
            flag = "FAIL" if m.get("halo_fail") or m.get("border_fail") else "ok"
            print(
                f"  {m['path']}: {flag} mag_e={m['mag_edge']} hue_e={m['hue_mag_edge']} "
                f"high={m['high_mag_edge']} max_sc={m['max_edge_mag_score']:.1f} "
                f"border_nz={m['border_alpha_nonzero']} partial={m['partial_px']} "
                f"mean_partial={m['mean_partial_rgba']}"
            )
            if m["mag_samples"]:
                print(f"    samples={m['mag_samples'][:3]}")

    return 0 if report["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
