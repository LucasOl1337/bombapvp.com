# G6p DONE — wallAlt offset masonry (break identical wall motif)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

G6n masonry courses used the same T-joint layout on every solid → motif you can point at twice across the map.

## Fix

| Piece | Change |
| --- | --- |
| `wall-alt.png` | Offset bond (top 0.55 / bot 0.40 splits), seed 77, mean-matched (delta ≈0.8) |
| Catalog | `arena.theme.tournament-clean.wall-alt` |
| `ArenaThemeTilePaths.wallAlt?` | optional |
| `assets.props.wallAlt` | load when present |
| `drawWall(x,y,tileX,tileY)` | `(tileX+tileY)%2` picks alt |

Script: `game-assets/_work/g6p_wall_alt.py`  
Backup: `game-assets/_work/wip-backup-g6p/`

## Verify

- `_qa-wall-field.png`: checker of two bond orientations  
- Live playtest: walls vary; no light/dark solid checker; portals/lanes/crates intact  
- game-assets vitest: **100 passed**

## Pack status (G6–G6p)

Main arena still **ready for owner commit** (no push without order).
