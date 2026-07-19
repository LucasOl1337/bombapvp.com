# G6m DONE — wrap-portal floor tile (no gold square stroke)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

Wrap portals used lane cobble + `strokeRect` gold square → hard sticker frames at mid-edges (same defect class as G6j lanes / G6k walls).

## Fix

| Piece | Change |
| --- | --- |
| `floor-portal.png` | Cobble family + open **dashed** gold ring (distinct from solid spawn ring) |
| Catalog | `arena.theme.tournament-clean.floor.portal` |
| `ArenaThemeTilePaths.portal?` | optional |
| `assets.floor.portal` | load when theme provides |
| Draw | portal sprite; strokeRect only as fallback if no portal sprite |

Script: `game-assets/_work/g6m_floor_portal.py`

## Verify

- Live `_playtest-training.png`: 4 edge portals = dashed rings; spawn pads = solid rings; no gold squares  
- game-assets vitest: **98 passed**

## Pack status (G6–G6m)

Main arena still **ready for owner commit** (no push without order).
