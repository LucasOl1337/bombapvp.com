# Tournament Clean — top-down sprite tile pack (v3.2 crate fill)

Default continuous arena (`tournament-clean`). Warm limestone cobble, textured charcoal walls, orthographic wood crates.

## Runtime files (128×128)

| File | Catalog id | Notes |
|------|------------|--------|
| `floor-base.png` | `arena.theme.tournament-clean.floor.base` | Toroidal Voronoi cobble — seamless, finer stones |
| `floor-base-alt.png` | `…floor.base-alt` | 2nd layout; **mean-matched** to base (no tone checker) |
| `floor-lane.png` | `…floor.lane` | Brighter cobble only (no sticker frame) |
| `floor-spawn.png` | `…floor.spawn` | Cobble + solid open gold ring |
| `floor-portal.png` | `…floor.portal` | Cobble + **double dashed** open gold ring (strong @40px; ≠ spawn) |
| `wall.png` | `…wall` | Charcoal masonry (running-bond courses), soft dark rim + top lip (no gold frame) |
| `wall-alt.png` | `…wall-alt` | Offset bond layout; mean-matched; checker via `(x+y)%2` |
| `crate.png` | `…crate` | Top-down wood lid, iron cross-bands, RGBA, pad≈6 (solid cell fill) |
| `crate-alt.png` | `…crate-alt` | Micro-variant wood tint/grain; checker via `(x+y)%2` |

## How floor-base is made

Procedural wrap-around (toroidal) Voronoi cells so stones continue across tile edges. Seed search minimizes edge RGB delta. Lane/spawn derived from the same base for family match. baseAlt uses a different seed then brightness-matched so layout varies without light/dark checkerboard.

## QA

| Gate | Result |
|------|--------|
| 2×2 seam — hard bar | PASS (stones wrap; no join bar) |
| Tone checker base vs alt | PASS — cell mean delta ≈0.3 (was ~12) |
| Landmark motif in all 4 quadrants | PARTIAL — two layouts alternate; no broken edge stones |
| Edge delta (base seed 45) | lr≈6.8, tb≈4.3 mean abs/channel |
| Top-down crate + alpha | PASS |
| Readable at TILE_SIZE=40 | PASS — `_preview-arena-mock.png` |

## Palette anchors

Floor `#d8d0c2` / `#cec5b7` family · lane cream lift · spawn gold `#c49e4c` · wall charcoal + soft rim/top lip · crate warm brown.

## Render mode

`renderMode: "sprite"` + `tilePaths` in `arena-theme-library.ts`.
