# Tournament Clean — top-down sprite tile pack (v2.5 continuous wall)

Default continuous arena (`tournament-clean`). Warm limestone cobble, textured charcoal walls, orthographic wood crates.

## Runtime files (128×128)

| File | Catalog id | Notes |
|------|------------|--------|
| `floor-base.png` | `arena.theme.tournament-clean.floor.base` | Toroidal Voronoi cobble — seamless |
| `floor-base-alt.png` | `…floor.base-alt` | 2nd seamless cobble (darker); checker via `(x+y)%2` |
| `floor-lane.png` | `…floor.lane` | Brighter cobble only (no sticker frame) |
| `floor-spawn.png` | `…floor.spawn` | Cobble + open gold ring |
| `wall.png` | `…wall` | Charcoal stone slab, soft dark rim + top lip only (no gold frame) |
| `crate.png` | `…crate` | Top-down wood lid, iron cross-bands, RGBA |

## How floor-base is made

Procedural wrap-around (toroidal) Voronoi cells so stones continue across tile edges. Seed search minimizes edge RGB delta. Lane/spawn derived from the same base for family match.

## QA

| Gate | Result |
|------|--------|
| 2×2 seam — hard bar | PASS (stones wrap; no join bar) |
| Landmark motif in all 4 quadrants | PARTIAL — single tile repeats (inherent); no broken edge stones |
| Edge delta (seed 47) | lr≈6.0, tb≈12.8 mean abs/channel |
| Top-down crate + alpha | PASS |
| Readable at TILE_SIZE=40 | PASS — `_preview-arena-mock.png` |

## Palette anchors

Floor `#d8d0c2` / `#cec5b7` family · lane cream lift · spawn gold `#c49e4c` · wall charcoal + soft rim/top lip · crate warm brown.

## Render mode

`renderMode: "sprite"` + `tilePaths` in `arena-theme-library.ts`.
