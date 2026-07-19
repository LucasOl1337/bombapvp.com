# G6c DONE — seamless cobble floor (toroidal Voronoi)

**Status:** complete (workspace; no commit/push)  
**Scope:** `game-assets/arenas/themes/tournament-clean/floor-*.png` (+ seams/previews/MANIFEST)  
**Tool:** `game-assets/_work/seamless_cobble.py`

## Why

G6b Imagine cobble failed game-tilesets seam gate (hard tile grid, non-wrapping stones).

## What changed

- **floor-base**: procedural toroidal Voronoi cobble (seed 47), seamless by construction  
- **floor-lane / floor-spawn**: re-derived via PIL from new base  
- wall + crate unchanged  
- MANIFEST v2.2  

## Verify

- 2×2 seam: stones continue across joins  
- 40px arena mock cohesive  
- Catalog/library already sprite-wired (no code change)  
