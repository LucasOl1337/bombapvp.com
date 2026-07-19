# G6s DONE — 4-way floor base layouts (baseAlt2/3)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

Only base + baseAlt (period-2 checker) → layout motif still scannable across large fields.

## Fix

| Piece | Change |
| --- | --- |
| `floor-base-alt2.png` | New seamless cobble seed 140, mean-matched |
| `floor-base-alt3.png` | New seamless cobble seed 172, mean-matched |
| Catalog | `…floor.base-alt2` / `…floor.base-alt3` |
| `tilePaths.baseAlt2/3` | optional |
| `pickBaseFloorSprite(x,y)` | `(x+2y) % n` over available base variants |

Cell mean max–min ≈0.57 (no tone grid). Script: `game-assets/_work/g6s_floor_4way.py`.

## Verify

- `_qa-floor-field-4way.png`: even tone, layout variety  
- Live playtest: floor continuous; lanes/portals/walls/crates intact  
- game-assets vitest: **102 passed**

## Pack status (G6–G6s)

Main arena still **ready for owner commit** (no push without order).
