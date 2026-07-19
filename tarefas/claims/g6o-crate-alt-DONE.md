# G6o DONE — crateAlt micro-variation (break clone stamp field)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

Every breakable used the same `crate.png` → identical prop stamp across the map (game-tilesets: motif you can point at twice).

## Fix

| Piece | Change |
| --- | --- |
| `crate-alt.png` | Edit-chained from crate: warmer wood + grain shift, mean-matched, alpha corners 0 |
| Catalog | `arena.theme.tournament-clean.crate-alt` |
| `ArenaThemeTilePaths.crateAlt?` | optional |
| `assets.props.crateAlt` | load when present |
| `drawCrate(x,y,tileX,tileY)` | `(tileX+tileY)%2` picks alt |

Script: `game-assets/_work/g6o_crate_alt.py`  
Backup: `game-assets/_work/wip-backup-g6o/`

## Verify

- `_qa-crate-field.png`: checker of two family-matched crates  
- Live playtest: crates still readable as breakables; no light/dark prop checker  
- game-assets vitest: **99 passed**

## Pack status (G6–G6o)

Main arena still **ready for owner commit** (no push without order).
