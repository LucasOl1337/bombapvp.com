# Arcane Citadel — G5 detail pass

**Goal:** G5 — enrich existing 128×128 sprite pack in place  
**Theme id:** `arcane-citadel`  
**Date:** 2026-07-19  
**Catalog change:** none (same filenames / same catalog ids)

## Palette family (kept)

Cool blue-gray fortress stone with restrained cyan-steel accents.

| Role | Target family |
| --- | --- |
| Floor base | `#0b1830`–`#143152` slate blue-gray |
| Floor lane | brighter cool slab + thin cyan-steel frame |
| Floor spawn | base stone + cyan-ice rune ring (`#52bfe2` family) |
| Wall | carved slate lip `#5b5d5f`–`#9c9d97` |
| Crate | oak wood + gunmetal blue-gray iron (not tournament beige metal) |

## Delivered tiles (replace in place)

| File | Size | Mode | Notes |
| --- | --- | --- | --- |
| `floor-base.png` | 128×128 | RGB | Seamless cobblestone craft; offset-blend seam fix |
| `floor-lane.png` | 128×128 | RGB | Brighter path slabs + cyan-steel riveted frame |
| `floor-spawn.png` | 128×128 | RGB | Open-center cyan rune ring, restrained |
| `wall.png` | 128×128 | RGB | Chunky carved slab, raised lip, geometric inner face |
| `crate.png` | 128×128 | RGBA | Isolated, no baked shadow; cool iron bands |

## Seam verification (mandatory 2×2)

| Composite | Path | Result |
| --- | --- | --- |
| floor-base | `_seam-floor-base.png` | Pass — no hard seam line; soft half-period blend |
| floor-lane | `_seam-floor-lane.png` | Pass-by-design — cyan frame grids (lane readability) |
| floor-spawn | `_seam-floor-spawn.png` | N/A field tile — center motif; spawn use only |
| wall | `_seam-wall.png` | N/A field tile — framed wall block |

## Backup

Previous pack copied to `_legacy-before-g5/` before overwrite:

- `floor-base.png`, `floor-lane.png`, `floor-spawn.png`, `wall.png`, `crate.png`

## Process notes

1. New floor-base anchor generated (cool blue-gray cobblestone craft).
2. Lane / spawn / wall edit-chained from that stone family.
3. Crate edit-chained from legacy crate, cooler iron, chroma-keyed to RGBA.
4. All final assets forced to 128×128.
5. Catalog ids unchanged (`arena.theme.arcane-citadel.*`).

## Known residuals / flags

- **floor-base:** cobblestone motifs remain somewhat recognizable across a 2×2 (inherent at 128px); offset-blend softens edge joins without perfect mortar continuity.
- **floor-lane:** full cyan frame intentionally creates a grid when tiled — matches prior lane readability contract.
- **crate:** silhouette fills most of the 128 cell (padding ~corners only); engines that need heavy inset may want a future pad pass.
- Work intermediates live under `_g5-work/` (not catalogued).

## Untouched (scope)

- `tournament-clean` and all other themes  
- HUD assets / `game-app` layout  
- `renderMode` of unrelated themes  
- No commit / push  
