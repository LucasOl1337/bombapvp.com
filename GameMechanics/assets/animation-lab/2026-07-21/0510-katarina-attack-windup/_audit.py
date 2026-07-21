"""Audit Katarina attack-windup animation-lab candidate (local only).

Checks: 16 frames, atlas consistency, alpha edges, green chroma residual.
Does not promote or touch files outside this directory.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
VERSIONS = [
    ("v1", "", ""),
    ("v2", "-v2", "-v2"),
    ("v3", "-v3", "-v3"),
    ("v4", "-v4", "-v4"),
]


def info(p: Path) -> dict:
    im = Image.open(p)
    im_rgba = im.convert("RGBA") if im.mode != "RGBA" else im
    a = im_rgba.getchannel("A")
    hist = a.histogram()
    return {
        "size": im.size,
        "mode": im.mode,
        "alpha_extrema": a.getextrema(),
        "pixels_alpha_gt0": int(sum(hist[1:])),
        "file_bytes": p.stat().st_size,
    }


def edge_alpha_hits(arr: np.ndarray) -> tuple[int, int]:
    """arr: HxWx4 uint8. Return (hits, max_a) on 1px border."""
    a = arr[:, :, 3]
    h, w = a.shape
    border = np.concatenate(
        [
            a[0, :],
            a[-1, :],
            a[1:-1, 0] if h > 2 else np.array([], dtype=a.dtype),
            a[1:-1, -1] if h > 2 else np.array([], dtype=a.dtype),
        ]
    )
    hits = int((border > 0).sum())
    max_a = int(border.max()) if border.size else 0
    return hits, max_a


def green_spill_stats(arr: np.ndarray) -> dict:
    """Detect green chroma residual near semi-transparent silhouette edges.

    Criteria for spill pixel (all must hold):
    - alpha in (8, 250)  (edge fringe, not solid body / empty)
    - G is dominant channel: G > R + 12 and G > B + 12
    - G >= 40
    - chroma vs red hair: G/R high when R is present
    """
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    a = arr[:, :, 3].astype(np.int16)

    fringe = (a > 8) & (a < 250)
    green_dom = (g > r + 12) & (g > b + 12) & (g >= 40)
    spill = fringe & green_dom

    # Strong spill: even greener (classic #00ff00 despill failure)
    strong = fringe & (g > r + 30) & (g > b + 30) & (g >= 60)

    # Opaque body green (should be near zero for Katarina red/black palette)
    opaque = a >= 250
    body_green = opaque & (g > r + 20) & (g > b + 20) & (g >= 50)

    spill_count = int(spill.sum())
    strong_count = int(strong.sum())
    body_green_count = int(body_green.sum())
    fringe_count = int(fringe.sum())

    # mean green excess on spill pixels
    excess = (g - np.maximum(r, b)).astype(np.float32)
    mean_excess = float(excess[spill].mean()) if spill_count else 0.0
    max_excess = float(excess[spill].max()) if spill_count else 0.0
    max_g_on_spill = int(g[spill].max()) if spill_count else 0

    return {
        "fringe_pixels": fringe_count,
        "spill_pixels": spill_count,
        "strong_spill_pixels": strong_count,
        "body_green_pixels": body_green_count,
        "spill_ratio_of_fringe": (spill_count / fringe_count) if fringe_count else 0.0,
        "mean_green_excess": mean_excess,
        "max_green_excess": max_excess,
        "max_g_on_spill": max_g_on_spill,
    }


def load_rgba(p: Path) -> np.ndarray:
    return np.asarray(Image.open(p).convert("RGBA"), dtype=np.uint8)


def audit_version(label: str, file_suffix: str, dir_suffix: str) -> dict:
    result: dict = {"version": label, "issues": [], "checks": {}}
    issues: list[str] = result["issues"]

    frames512 = ROOT / f"frames-512{dir_suffix}"
    frames256 = ROOT / f"frames-256{dir_suffix}"
    sheet512 = ROOT / f"spritesheet-512-4x4{file_suffix}.png"
    sheet256 = ROOT / f"spritesheet-256-4x4{file_suffix}.png"
    preview_dir = ROOT / f"preview{dir_suffix}"
    contact = preview_dir / "contact-sheet.png"
    gif = preview_dir / "preview.gif"
    order = preview_dir / "frame-order.txt"

    # source files: v1 unversioned for chromakey/grid when suffix empty
    if label == "v1":
        chromakey = ROOT / "source-chromakey-removed.png"
        grid = ROOT / "source-grid-1248.png"
        gen = ROOT / "source-generated-grid.png"
    else:
        chromakey = ROOT / f"source-chromakey-removed{file_suffix}.png"
        grid = ROOT / f"source-grid-1248{file_suffix}.png"
        gen = ROOT / "source-generated-grid.png"

    print(f"\n{'=' * 60}\nVERSION {label}\n{'=' * 60}")

    # --- sources ---
    for name, p in [
        ("source-generated-grid", gen if label == "v1" else gen),
        ("chromakey-removed", chromakey),
        ("grid-1248", grid),
        ("spritesheet-512", sheet512),
        ("spritesheet-256", sheet256),
        ("contact-sheet", contact),
        ("preview.gif", gif),
    ]:
        if not p.exists():
            # source-generated only expected once (shared)
            if name == "source-generated-grid" and label != "v1":
                continue
            print(f"  MISSING {p.name}")
            issues.append(f"missing {p.relative_to(ROOT)}")
            continue
        i = info(p)
        w, h = i["size"]
        print(
            f"  {p.name}: {w}x{h} mode={i['mode']} a_ext={i['alpha_extrema']} "
            f"a>0={i['pixels_alpha_gt0']}"
        )
        if "spritesheet" in name or "grid" in name or name == "chromakey-removed":
            if w % 4 or h % 4:
                issues.append(f"not_divisible_4 {p.name} {w}x{h}")

    # --- frames ---
    for size, folder in [(512, frames512), (256, frames256)]:
        print(f"\n  --- {folder.name} ---")
        present = 0
        empty = 0
        bad_size = 0
        edge_hits_total = 0
        spill_total = 0
        strong_total = 0
        body_green_total = 0
        worst_spill = 0
        worst_frame = None
        spill_by_frame: list[dict] = []

        for i in range(16):
            p = folder / f"frame-{i:02d}.png"
            if not p.exists():
                issues.append(f"missing {folder.name}/frame-{i:02d}.png")
                print(f"    MISSING frame-{i:02d}")
                continue
            present += 1
            arr = load_rgba(p)
            h, w = arr.shape[:2]
            a_gt0 = int((arr[:, :, 3] > 0).sum())
            is_empty = a_gt0 < 100
            size_ok = (w, h) == (size, size)
            if is_empty:
                empty += 1
                issues.append(f"empty {folder.name}/frame-{i:02d}")
            if not size_ok:
                bad_size += 1
                issues.append(f"size {folder.name}/frame-{i:02d}={w}x{h}")

            hits, max_a = edge_alpha_hits(arr)
            if hits:
                edge_hits_total += hits
                issues.append(
                    f"edge_alpha {folder.name}/frame-{i:02d} hits={hits} max_a={max_a}"
                )

            spill = green_spill_stats(arr)
            spill_total += spill["spill_pixels"]
            strong_total += spill["strong_spill_pixels"]
            body_green_total += spill["body_green_pixels"]
            if spill["spill_pixels"] > worst_spill:
                worst_spill = spill["spill_pixels"]
                worst_frame = i
            spill_by_frame.append({"frame": i, **spill})

            flag = ""
            if spill["strong_spill_pixels"] > 0:
                flag = " GREEN_HALO"
            elif spill["spill_pixels"] > 50:
                flag = " green_fringe"
            print(
                f"    frame-{i:02d}: {w}x{h} a>0={a_gt0} edge={hits} "
                f"spill={spill['spill_pixels']} strong={spill['strong_spill_pixels']} "
                f"bodyG={spill['body_green_pixels']} maxEx={spill['max_green_excess']:.1f}"
                f"{flag}"
            )

        # thresholds: any strong spill OR >50 mild spill on any 512 frame fails green
        if size == 512:
            frames_with_strong = [
                s for s in spill_by_frame if s["strong_spill_pixels"] > 0
            ]
            frames_with_mild = [
                s for s in spill_by_frame if s["spill_pixels"] > 50
            ]
            if frames_with_strong:
                issues.append(
                    f"GREEN_HALO strong_spill on frames: "
                    + ",".join(f"{s['frame']:02d}({s['strong_spill_pixels']})" for s in frames_with_strong)
                )
            if frames_with_mild:
                issues.append(
                    f"GREEN_FRINGE spill>50 on frames: "
                    + ",".join(f"{s['frame']:02d}({s['spill_pixels']})" for s in frames_with_mild)
                )
            if body_green_total > 20:
                issues.append(f"body_green_pixels total={body_green_total}")

        result["checks"][folder.name] = {
            "present": present,
            "empty": empty,
            "bad_size": bad_size,
            "edge_hits_total": edge_hits_total,
            "spill_total": spill_total,
            "strong_spill_total": strong_total,
            "body_green_total": body_green_total,
            "worst_spill_frame": worst_frame,
            "worst_spill_count": worst_spill,
            "spill_by_frame": spill_by_frame,
        }
        print(
            f"  SUMMARY {folder.name}: present={present}/16 empty={empty} "
            f"bad_size={bad_size} edge_hits={edge_hits_total} "
            f"spill={spill_total} strong={strong_total} bodyG={body_green_total}"
        )

    # --- atlas consistency ---
    print("\n  --- ATLAS CONSISTENCY ---")
    for size, sheet_path, folder in [
        (512, sheet512, frames512),
        (256, sheet256, frames256),
    ]:
        if not sheet_path.exists() or not folder.exists():
            continue
        sheet = load_rgba(sheet_path)
        sh, sw = sheet.shape[:2]
        ok = (sw, sh) == (size * 4, size * 4)
        print(f"  {sheet_path.name}: {sw}x{sh} expected {size*4}x{size*4} ok={ok}")
        if not ok:
            issues.append(f"sheet size {sheet_path.name} {sw}x{sh}")
        mismatches = 0
        for idx in range(16):
            row, col = idx // 4, idx % 4
            cell = sheet[row * size : (row + 1) * size, col * size : (col + 1) * size]
            fr_path = folder / f"frame-{idx:02d}.png"
            if not fr_path.exists():
                mismatches += 1
                continue
            fr = load_rgba(fr_path)
            if cell.shape != fr.shape:
                mismatches += 1
                continue
            diff = float(np.abs(cell.astype(np.int16) - fr.astype(np.int16)).mean())
            if diff > 1.0:
                mismatches += 1
                print(f"    mismatch frame-{idx:02d} mean_diff={diff:.2f}")
        print(f"    cell mismatches: {mismatches}/16")
        if mismatches:
            issues.append(f"sheet mismatch {sheet_path.name}: {mismatches}")
        result["checks"][sheet_path.name] = {
            "size": [int(sw), int(sh)],
            "size_ok": ok,
            "mismatches": mismatches,
        }

    # --- preview ---
    print("\n  --- PREVIEW ---")
    if order.exists():
        lines = [ln.strip() for ln in order.read_text(encoding="utf-8").splitlines() if ln.strip()]
        print(f"  frame-order.txt: {len(lines)} lines")
        if len(lines) != 16:
            issues.append(f"frame-order lines={len(lines)} expected 16")
        result["checks"]["frame_order_lines"] = len(lines)
    else:
        issues.append(f"missing {preview_dir.name}/frame-order.txt")

    if gif.exists():
        g = Image.open(gif)
        n = getattr(g, "n_frames", 1)
        durations = []
        try:
            for i in range(n):
                g.seek(i)
                durations.append(g.info.get("duration", None))
        except EOFError:
            pass
        print(f"  preview.gif: size={g.size} n_frames={n} durations={durations[:4]}...")
        if n < 16:
            issues.append(f"preview.gif frames={n} expected>=16")
        result["checks"]["preview_gif"] = {
            "size": list(g.size),
            "n_frames": n,
            "durations_ms_sample": durations[:4],
        }
    else:
        issues.append(f"missing {preview_dir.name}/preview.gif")

    if contact.exists():
        cs = Image.open(contact)
        print(f"  contact-sheet: {cs.size} mode={cs.mode}")
        # green spill on contact sheet (composited dark bg — still useful)
        cs_arr = np.asarray(cs.convert("RGBA"), dtype=np.uint8)
        cs_spill = green_spill_stats(cs_arr)
        print(
            f"  contact spill={cs_spill['spill_pixels']} strong={cs_spill['strong_spill_pixels']}"
        )
        result["checks"]["contact_sheet"] = {
            "size": list(cs.size),
            "spill": cs_spill,
        }
    else:
        issues.append(f"missing {preview_dir.name}/contact-sheet.png")

    # green failure flag for this version
    c512 = result["checks"].get(frames512.name, {})
    green_fail = (
        c512.get("strong_spill_total", 0) > 0
        or any(
            s.get("spill_pixels", 0) > 50
            for s in c512.get("spill_by_frame", [])
        )
        or c512.get("body_green_total", 0) > 20
    )
    technical_fail = any(
        not x.startswith("GREEN") and "green" not in x.lower() and "body_green" not in x
        for x in issues
    )
    # recompute cleaner
    non_green_issues = [
        x
        for x in issues
        if not x.startswith("GREEN_") and "body_green" not in x and "GREEN_FRINGE" not in x and "GREEN_HALO" not in x
    ]
    green_issues = [x for x in issues if x not in non_green_issues]

    result["green_fail"] = bool(green_issues)
    result["technical_fail"] = bool(non_green_issues)
    result["pass"] = not issues
    result["promote"] = False  # never auto-promote; orchestrator decides after FAIL/PASS

    print(f"\n  ISSUES ({len(issues)}):")
    if issues:
        for x in issues:
            print(f"   - {x}")
    else:
        print("   NONE")
    print(
        f"  RESULT: pass={result['pass']} green_fail={result['green_fail']} "
        f"technical_fail={result['technical_fail']}"
    )
    return result


def main() -> int:
    all_results = []
    for label, file_suf, dir_suf in VERSIONS:
        all_results.append(audit_version(label, file_suf, dir_suf))

    print("\n" + "=" * 60)
    print("ROLLUP")
    print("=" * 60)
    for r in all_results:
        c = r["checks"].get(
            "frames-512" if r["version"] == "v1" else f"frames-512-{r['version']}",
            {},
        )
        # folder name key
        key = "frames-512" if r["version"] == "v1" else f"frames-512-{r['version']}"
        c = r["checks"].get(key, {})
        print(
            f"  {r['version']}: pass={r['pass']} green_fail={r['green_fail']} "
            f"tech_fail={r['technical_fail']} issues={len(r['issues'])} "
            f"strong_spill={c.get('strong_spill_total', '?')} "
            f"spill_total={c.get('spill_total', '?')}"
        )

    # pick latest as primary candidate
    primary = all_results[-1]
    out = {
        "primary_version": primary["version"],
        "primary_pass": primary["pass"],
        "primary_green_fail": primary["green_fail"],
        "primary_technical_fail": primary["technical_fail"],
        "primary_issues": primary["issues"],
        "versions": [
            {
                "version": r["version"],
                "pass": r["pass"],
                "green_fail": r["green_fail"],
                "technical_fail": r["technical_fail"],
                "issue_count": len(r["issues"]),
                "issues": r["issues"],
                "checks_summary": {
                    k: (
                        {
                            "present": v.get("present"),
                            "empty": v.get("empty"),
                            "bad_size": v.get("bad_size"),
                            "edge_hits_total": v.get("edge_hits_total"),
                            "spill_total": v.get("spill_total"),
                            "strong_spill_total": v.get("strong_spill_total"),
                            "body_green_total": v.get("body_green_total"),
                            "worst_spill_frame": v.get("worst_spill_frame"),
                            "worst_spill_count": v.get("worst_spill_count"),
                        }
                        if isinstance(v, dict) and "spill_total" in v
                        else v
                    )
                    for k, v in r["checks"].items()
                },
            }
            for r in all_results
        ],
    }
    out_path = ROOT / "_audit-report.json"
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nWrote {out_path.name}")

    # exit 1 if primary fails
    return 0 if primary["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
