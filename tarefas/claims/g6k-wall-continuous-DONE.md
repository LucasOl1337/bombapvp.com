# G6k DONE — continuous wall (no gold sticker frames)

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

`wall.png` had a full 4-edge sand/gold picture frame. Multi-cell wall clusters and the border ring looked like sticker squares (same class of defect as G6j lanes).

## Fix

Regenerated `tournament-clean/wall.png` (128×128 RGB):

- Charcoal stone grain (multi-scale value noise + micro pits), anonymous
- Soft dark outer rim for silhouette at 40px
- Soft top highlight + **muted sand hairline only on top** (theme lip)
- **No gold/sand rectangle on all 4 edges**
- Script: `game-assets/_work/g6k_wall_continuous.py`
- Backup: `game-assets/_work/wip-backup-g6k/`

## Verify

| Check | Result |
| --- | --- |
| 2×2 wall cluster | Continuous mass, soft grid only — no gold frames |
| Live playtest `_playtest-training.png` | Walls read as solid slabs; lanes/spawns/crates intact |
| game-assets vitest | **97 passed** |

## Pack status (G6–G6k)

Main arena `tournament-clean` candidate remains **ready for owner commit** (no push without order).
