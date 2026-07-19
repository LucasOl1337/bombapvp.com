# G6r DONE — crate fill expand (pad 15→6) + soft rim

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

Intact crate opaque bbox pad≈15px (~77% fill) → breakables looked floaty/sticker-small in TILE_SIZE=40 cells.

## Fix

`game-assets/_work/g6r_crate_fill.py`:

| Asset | Change |
| --- | --- |
| `crate.png` | Scale body to pad≈6–7, soft outer alpha rim, corners α=0 |
| `crate-alt.png` | Re-derived from expanded crate (G6o micro-tint, mean-matched) |
| `crate-break-{0..3}.png` | Same expand so destroy FX matches intact size |

Backup: `game-assets/_work/wip-backup-g6r/`

## Verify

- Fill ≈0.89 (was 0.77); corners alpha 0  
- Live playtest: crates solidly fill cells; walls/portals/lanes intact  
- game-assets vitest: **100 passed**

## Pack status (G6–G6r)

Main arena still **ready for owner commit** (no push without order).
