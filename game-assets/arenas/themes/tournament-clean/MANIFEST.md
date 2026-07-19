# Tournament Clean — top-down sprite tile pack (v3.9 floor edge flatten)

Default continuous arena (`tournament-clean`). Warm limestone cobble, textured charcoal walls, orthographic wood crates.

## Runtime files (128×128)

| File | Catalog id | Notes |
|------|------------|--------|
| `floor-base.png` | `arena.theme.tournament-clean.floor.base` | Toroidal Voronoi cobble — seamless, finer stones |
| `floor-base-alt.png` | `…floor.base-alt` | 2nd layout; mean-matched |
| `floor-base-alt2.png` | `…floor.base-alt2` | 3rd layout; mean-matched |
| `floor-base-alt3.png` | `…floor.base-alt3` | 4th layout; mean-matched; pick `(x+2y)%n` |
| `floor-lane.png` | `…floor.lane` | Brighter cobble only — pure cream lift, no edge darken |
| `floor-spawn.png` | `…floor.spawn` | Cobble + solid open gold ring |
| `floor-portal.png` | `…floor.portal` | Cobble + **double dashed** open gold ring (strong @40px; ≠ spawn) |
| `wall.png` | `…wall` | Charcoal masonry (running-bond courses), edge-to-edge — no rim / top lip |
| `wall-alt.png` | `…wall-alt` | Offset bond layout; mean-matched; checker via `(x+y)%2` |
| `crate.png` | `…crate` | Top-down wood lid, iron cross-bands, full-bleed; outer rim lifted (no dark frame grid) |
| `crate-alt.png` | `…crate-alt` | Micro-variant wood tint/grain; mean-matched; checker via `(x+y)%2` |

## How floor-base is made

Procedural wrap-around (toroidal) Voronoi cells so stones continue across tile edges. Seed search minimizes edge RGB delta. Lane/spawn derived from the same base for family match. baseAlt uses a different seed then brightness-matched so layout varies without light/dark checkerboard.

## QA

| Gate | Result |
|------|--------|
| 2×2 seam — hard bar | PASS (stones wrap; no join bar) |
| Tone checker base vs alt | PASS — cell mean delta ≈0.3 (was ~12) |
| Floor alt edge−inner | PASS — alt/alt3 ≈0.5–0.6 (was ~4.8–5.0) |
| Landmark motif in all 4 quadrants | PARTIAL — two layouts alternate; no broken edge stones |
| Edge delta (base seed 45) | lr≈6.8, tb≈4.3 mean abs/channel |
| Top-down crate + alpha | PASS |
| Readable at TILE_SIZE=40 | PASS — `_preview-arena-mock.png` |
| Wall multi-cell continuous | PASS — edge−inner ~3 (was ~46); no per-cell rim/lip |

## Palette anchors

Floor `#d8d0c2` / `#cec5b7` family · lane cream lift · spawn gold `#c49e4c` · wall charcoal masonry edge-to-edge · crate warm brown (full-bleed, lifted outer rim).

## Render mode

`renderMode: "sprite"` + `tilePaths` in `arena-theme-library.ts`.
