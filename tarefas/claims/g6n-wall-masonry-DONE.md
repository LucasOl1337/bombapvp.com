# G6n DONE — wall masonry readable at 40px

**Status:** complete (workspace; no commit/push)  
**Skill:** `game-tilesets` + `game-asset-core`

## Problem

G6k removed gold wall frames but the face was almost featureless at TILE_SIZE=40 (interior std ≈7.7) → walls read as flat UI squares.

## Fix

`wall.png` regenerated (`game-assets/_work/g6n_wall_masonry.py`):

- Running-bond stone courses (soft dark mortar, not gold)
- Multi-scale charcoal grain + micro pits
- Soft dark outer rim + top lip only (G6k contract kept)
- Backup: `game-assets/_work/wip-backup-g6n/`

## Verify

| Check | Result |
| --- | --- |
| wall40 interior std | ≈10.9 (was ≈7.7) |
| 2×2 cluster | masonry reads; no gold frames |
| Live playtest | walls show block courses; portals/lanes/spawns/crates intact |
| game-assets tests | portal assertions restored; suite green |

## Pack status (G6–G6n)

Main arena still **ready for owner commit** (no push without order).
